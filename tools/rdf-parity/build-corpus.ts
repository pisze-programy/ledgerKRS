import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadCreds } from "./creds";
import { createRdfClient } from "../../src/sources/rdf/client";
import { solveReese84, type SolvedSession } from "./pw-solver";
import { fetchBizraportDane } from "./bizraport";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const PHONE_SOCKS = "socks5://127.0.0.1:1080";

const creds = loadCreds();
const WS_PREFIX = creds.wsUserPrefix ?? "";
const WS_PASS = creds.wsPassword ?? "";
const WS_USERS = creds.wsUsers ?? [];



type Channel = "phone" | "webshare";

interface Session {
  channel: Channel;
  cookie: string;
  wsUser?: string;
  wsPass?: string;
}

let session: Session = { channel: "phone", cookie: "" };
let wsIdx = 0;
let refreshCount = 0;

function curlRdf(url: string, method: string, body: string | undefined): { status: number; text: string } {
  const args = ["-s", "-m", "60", "-L", "-X", method];
  if (session.channel === "webshare") {
    const user = session.wsUser!;
    args.push("--proxy", `http://${user}:${session.wsPass}@p.webshare.io:80/`);
  } else {
    args.push("--socks5-hostname", "127.0.0.1:1080");
  }
  args.push("-H", `Cookie: ${session.cookie}`);
  args.push("-H", `User-Agent: ${CHROME_UA}`);
  args.push('-H', 'sec-ch-ua: "Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"');
  args.push("-H", "sec-ch-ua-mobile: ?0");
  args.push('-H', 'sec-ch-ua-platform: "macOS"');
  args.push("-H", "Accept: application/json");
  args.push("-H", "Content-Type: application/json");
  args.push("-H", "Origin: https://rdf-przegladarka.ms.gov.pl");
  if (body) args.push("--data-raw", body);
  args.push(url);
  try {
    const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    return { status: 200, text: out };
  } catch {
    return { status: 0, text: "" };
  }
}

async function solveVia(channel: Channel): Promise<boolean> {
  let sol: SolvedSession | null = null;
  if (channel === "phone") {
    sol = await solveReese84({ server: PHONE_SOCKS }, undefined, 25000);
  } else {
    const user = `${WS_PREFIX}${WS_USERS[wsIdx % WS_USERS.length]!}`;
    wsIdx += 1;
    sol = await solveReese84({ server: "http://p.webshare.io:80", username: user, password: WS_PASS }, undefined, 25000);
    if (sol) {
      session.wsUser = user;
      session.wsPass = WS_PASS;
    }
  }
  if (!sol) return false;
  session.channel = channel;
  session.cookie = sol.cookieString;
  refreshCount += 1;
  console.error(`[refresh #${refreshCount}] ${channel} → ${sol.cookies.map((c) => c.name).join(",")}`);
  return true;
}

async function refresh(): Promise<boolean> {
  if (await solveVia("phone")) return true;
  console.error("  phone solve failed (IP flagged?) → fallback webshare");
  return solveVia("webshare");
}

function clientSearch(krsToken: string): string {
  return curlRdf(
    "https://rdf-przegladarka.ms.gov.pl/services/rdf/przegladarka-dokumentow-finansowych/dokumenty/wyszukiwanie",
    "POST",
    JSON.stringify({
      metadaneStronicowania: {
        numerStrony: 0,
        rozmiarStrony: 50,
        metadaneSortowania: [{ atrybut: "rodzajDokumentu.nazwa", kierunek: "ROSNACO" }],
      },
      nrKRS: krsToken,
    }),
  ).text;
}

function clientDocMeta(id: string): string {
  return curlRdf(`https://rdf-przegladarka.ms.gov.pl/services/rdf/przegladarka-dokumentow-finansowych/dokumenty/${encodeURIComponent(id)}`, "GET", undefined).text;
}

function clientTresc(id: string): string {
  return curlRdf(`https://rdf-przegladarka.ms.gov.pl/services/rdf/przegladarka-dokumentow-finansowych/dokumenty/${encodeURIComponent(id)}/tresc?bezPodpisu=false`, "GET", undefined).text;
}

const isChallenge = (text: string) => !text.includes("<?xml") && text.startsWith("<");

async function searchAnnual(krs: string) {
  const { encryptNrKrs } = await import("../../src/sources/rdf/client");
  const token = await encryptNrKrs(krs);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const body = clientSearch(token);
      if (!body.startsWith("<")) {
        const j = JSON.parse(body) as { content?: { id: string; rodzaj: string; okresSprawozdawczyPoczatek: string | null; okresSprawozdawczyKoniec: string | null }[] };
        const annual = (j.content ?? []).filter((h) => h.rodzaj === "18");
        const xml: typeof annual = [];
        for (const hit of annual) {
          const meta = clientDocMeta(hit.id);
          try {
            const doc = JSON.parse(meta) as { rodzajDokumentu?: { dopuszczalneRozszerzenia?: string } };
            if (/\.XML/i.test(doc.rodzajDokumentu?.dopuszczalneRozszerzenia ?? "")) {
              xml.push(hit);
            }
          } catch {
            // skip; will retry via refresh on next attempt
          }
        }
        return xml;
      }
    } catch {
      // parse error
    }
    await refresh();
  }
  return null;
}

async function downloadTresc(id: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const text = clientTresc(id);
    if (text.includes("<?xml")) return text;
    if (attempt === 0) console.error(`    tresc fail (${text.length}B, ${text.slice(0, 40).replace(/\n/g, " ")}) — refresh`);
    await refresh();
  }
  return null;
}

function countXml(dir: string): number {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".xml")).length;
  } catch {
    return 0;
  }
}

async function main() {
  if (!(await refresh())) {
    console.error("initial cookie solve failed");
    process.exit(1);
  }
  const corpusList = JSON.parse(readFileSync(join(process.cwd(), "tools", "rdf-parity", "corpus.json"), "utf8")) as Record<string, unknown>;
  let list = Object.keys(corpusList).sort();
  const manifestPath = join(process.cwd(), "tools", "rdf-parity", "dump", "corpus-manifest.json");
  let manifest: Record<string, number> = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    // no manifest yet
  }
  const isComplete = (krs: string, dir: string) =>
    existsSync(join(dir, "bizraport.json")) && countXml(dir) >= (manifest[krs] ?? 0) && manifest[krs] !== undefined;
  const limit = Number(process.env.LIMIT ?? 0);
  if (limit > 0) {
    const pending = list.filter((krs) => !isComplete(krs, join(CORPUS, krs)));
    console.error(`[pending] ${pending.length} firms, batch=${Math.min(limit, pending.length)}`);
    list = pending.slice(0, limit);
    if (list.length === 0) {
      console.log("no pending companies — corpus complete");
      return;
    }
  }

  const isComplete = (krs: string, dir: string) =>
    existsSync(join(dir, "bizraport.json")) && countXml(dir) >= (manifest[krs] ?? 0) && manifest[krs] !== undefined;

  let complete = 0;
  for (const krs of list) {
    const dir = join(CORPUS, krs);
    mkdirSync(dir, { recursive: true });
    const bizPath = join(dir, "bizraport.json");
    if (isComplete(krs, dir)) {
      complete += 1;
      continue;
    }
    const annual = await searchAnnual(krs);
    if (annual === null) {
      console.log(`${krs}: search failed after refreshes`);
      continue;
    }
    if (annual.length === 0) {
      console.log(`${krs}: no XML annual statements (PDF-only?)`);
      if (!existsSync(bizPath)) {
        const biz = await fetchBizraportDane(creds, krs);
        if (biz) writeFileSync(bizPath, JSON.stringify(biz, null, 1));
      }
      continue;
    }
    manifest[krs] = annual.length;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    let got = 0;
    let failed = 0;
    for (const hit of annual) {
      const name = `${(hit.okresSprawozdawczyPoczatek ?? "x").replace(/-/g, "")}_${(hit.okresSprawozdawczyKoniec ?? "x").replace(/-/g, "")}.xml`;
      const path = join(dir, name);
      if (existsSync(path)) {
        got += 1;
        continue;
      }
      const xml = await downloadTresc(hit.id);
      if (xml) {
        writeFileSync(path, xml);
        got += 1;
        await new Promise((r) => setTimeout(r, 700));
      } else {
        failed += 1;
      }
    }
    if (!existsSync(bizPath)) {
      const biz = await fetchBizraportDane(creds, krs);
      if (biz) writeFileSync(bizPath, JSON.stringify(biz, null, 1));
    }
    const done = got > 0 && failed === 0 && existsSync(bizPath);
    if (done) complete += 1;
    console.log(`${krs}: got=${got}/${annual.length} failed=${failed}${done ? " DONE" : ""}`);
  }
  console.log(`PROGRESS: ${complete}/${list.length} complete | refreshes=${refreshCount} | channel=${session.channel}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
