/**
 * Production-simulation seed for the RDF full population.
 *
 * The phone tunnel is gone and Webshare is ONLY used to solve the small
 * reese84 cookie (a few hundred KB per solve). The searches themselves are
 * cross-IP: they run from the LOCAL IP with a webshare-solved cookie, so the
 * search traffic is free and never consumes Webshare bandwidth.
 *
 * The probe runs in SMALL BATCHES (BATCH env, default 120) with pacing
 * (SLEEP_MS env, default 400ms) — no bursts. State and metrics persist
 * between runs so the pool advances without a long-running loop.
 *
 * Run:   npx tsx tools/rdf-parity/seed-probe.ts
 * Env:   BATCH=120 SLEEP_MS=400 MAX_SOLVES=2
 * Reset: rm tools/rdf-parity/dump/seed-probe-state.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { loadCreds } from "./creds";
import { encryptNrKrs } from "../../src/sources/rdf/client";
import { createLogger } from "../../src/lib/logger";

const RDF_BASE = "https://rdf-przegladarka.ms.gov.pl";
const SEARCH_URL = `${RDF_BASE}/services/rdf/przegladarka-dokumentow-finansowych/dokumenty/wyszukiwanie`;
const SOLVE_URL = `${RDF_BASE}/wyszukaj-podmiot`;
const CHROMIUM =
  process.env.CHROMIUM ??
  "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const DUMP_DIR = join(process.cwd(), "tools", "rdf-parity", "dump");
const STATE_PATH = join(DUMP_DIR, "seed-probe-state.json");
const METRICS_PATH = join(DUMP_DIR, "seed-probe.json");

const log = createLogger("seed-probe");

export interface ProbeState {
  offset: number;
  cookie: string | null;
  reqsOnCookie: number;
}

export interface ProbeMetrics {
  started: string;
  last_run: string;
  pool: number;
  firms_probed: number;
  cookie_solves: number;
  solve_bytes: number;
  search_requests: number;
  search_bytes: number;
  challenges: number;
  empty_no_xml: number;
  failed_requests: number;
  requests_per_cookie: number[];
  wall_ms: number;
}

export interface SearchOutcome {
  kind: "ok" | "empty" | "challenge" | "error";
  bytes: number;
  message?: string;
}

const creds = loadCreds();

function emptyState(): ProbeState {
  return { offset: 0, cookie: null, reqsOnCookie: 0 };
}

function emptyMetrics(poolSize: number): ProbeMetrics {
  return {
    started: new Date().toISOString(),
    last_run: new Date().toISOString(),
    pool: poolSize,
    firms_probed: 0,
    cookie_solves: 0,
    solve_bytes: 0,
    search_requests: 0,
    search_bytes: 0,
    challenges: 0,
    empty_no_xml: 0,
    failed_requests: 0,
    requests_per_cookie: [],
    wall_ms: 0,
  };
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Deterministic pool: the biuletyn seed pool plus the corpus lists. */
export function buildPool(): string[] {
  const krs = new Set<string>();
  const seedPool = readJson<string[]>(join(DUMP_DIR, "seed-pool.json"));
  for (const key of seedPool ?? []) {
    krs.add(key);
  }
  const biuletyn = readJson<{ sample: { krs: string }[] }>(join(DUMP_DIR, "sample-biuletyn.json"));
  for (const s of biuletyn?.sample ?? []) {
    krs.add(s.krs);
  }
  for (const file of ["corpus.json", "corpus2.json"]) {
    const data = readJson<Record<string, unknown> | { sample: { krs: string }[] }>(join(process.cwd(), "tools", "rdf-parity", file));
    if (!data) {
      continue;
    }
    if (Array.isArray(data.sample)) {
      for (const s of data.sample) {
        krs.add(s.krs);
      }
    } else {
      for (const key of Object.keys(data)) {
        krs.add(key);
      }
    }
  }
  return [...krs];
}

/** Solve reese84 over the given Webshare sticky user; sum the transferred bytes. */
async function solveMetered(user: string, pass: string): Promise<{ cookie: string; bytes: number } | null> {
  let bytes = 0;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM,
      proxy: { server: "http://p.webshare.io:80", username: user, password: pass },
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (error) {
    log.error("chromium launch failed", { user, error: String(error) });
    return null;
  }
  try {
    const ctx = await browser.newContext({ userAgent: CHROME_UA });
    const page = await ctx.newPage();
    page.on("response", (resp) => {
      const type = resp.request().resourceType();
      if (type === "document" || type === "script" || type === "xhr" || type === "fetch") {
        const n = Number(resp.headers()["content-length"] ?? 0);
        bytes += Number.isFinite(n) ? n : 0;
      }
    });
    try {
      await page.goto(SOLVE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (error) {
      log.warn("solve page load failed; cookies may still be set", { error: String(error) });
    }
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const cookies = await ctx.cookies();
      const reese = cookies.find((c) => c.name === "reese84");
      if (reese) {
        const kept = cookies
          .filter((c) => /reese84|incap_ses|visid_incap|nlbi|f5avr/i.test(c.name))
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
        return { cookie: kept, bytes };
      }
      await page.waitForTimeout(1500);
    }
    log.warn("reese84 not set within timeout (captcha shown?)", { user });
    return null;
  } catch (error) {
    log.error("solve failed", { user, error: String(error) });
    return null;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** One search from the LOCAL IP (cross-IP) with a webshare-solved cookie; the traffic is free. */
async function searchLocal(cookie: string, token: string): Promise<SearchOutcome> {
  try {
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
        Referer: `${RDF_BASE}/wyszukaj-podmiot`,
        "User-Agent": CHROME_UA,
      },
      body: JSON.stringify({
        metadaneStronicowania: {
          numerStrony: 0,
          rozmiarStrony: 50,
          metadaneSortowania: [{ atrybut: "rodzajDokumentu.nazwa", kierunek: "ROSNACO" }],
        },
        nrKRS: token,
      }),
    });
    const text = await response.text();
    if (text === "") {
      return { kind: "error", bytes: 0, message: `empty body HTTP ${response.status}` };
    }
    if (text.trim().startsWith("<")) {
      return { kind: "challenge", bytes: text.length };
    }
    try {
      const parsed = JSON.parse(text) as { content?: unknown[] };
      if (parsed.content !== undefined) {
        return { kind: "ok", bytes: text.length };
      }
      return { kind: "empty", bytes: text.length };
    } catch {
      return { kind: "challenge", bytes: text.length, message: "unparseable response" };
    }
  } catch (error) {
    return { kind: "error", bytes: 0, message: error instanceof Error ? error.message : String(error) };
  }
}

async function ensureCookie(state: ProbeState, metrics: ProbeMetrics, users: string[], pass: string): Promise<boolean> {
  const user = `${creds.wsUserPrefix ?? "mdtduclo-"}${users[metrics.cookie_solves % Math.max(1, users.length)]}`;
  const sol = await solveMetered(user, pass);
  metrics.cookie_solves += 1;
  if (sol) {
    state.cookie = sol.cookie;
    state.reqsOnCookie = 0;
    metrics.solve_bytes += sol.bytes;
    log.info("cookie solved", { user, solveBytes: sol.bytes, solveNo: metrics.cookie_solves });
    return true;
  }
  log.error("cookie solve FAILED", { user, solveNo: metrics.cookie_solves });
  state.cookie = null;
  return false;
}

function save(state: ProbeState, metrics: ProbeMetrics): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 1));
  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 1));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const batchSize = Number(process.env.BATCH ?? 120);
  const sleepMs = Number(process.env.SLEEP_MS ?? 400);
  const maxSolves = Number(process.env.MAX_SOLVES ?? 2);
  const pool = buildPool();

  const state = readJson<ProbeState>(STATE_PATH) ?? emptyState();
  const metrics = readJson<ProbeMetrics>(METRICS_PATH) ?? emptyMetrics(pool.length);
  metrics.last_run = new Date().toISOString();
  metrics.pool = pool.length;
  metrics.wall_ms = metrics.wall_ms ?? 0;

  if (state.offset >= pool.length) {
    log.info("pool exhausted — seed complete", { offset: state.offset, pool: pool.length });
    return;
  }
  const batch = pool.slice(state.offset, state.offset + batchSize);
  const users = creds.wsUsers ?? [];
  const pass = creds.wsPassword ?? "";
  const runStart = Date.now();

  log.info("batch start", { batch: batch.length, offset: state.offset, pool: pool.length, sleepMs, maxSolves });

  for (const krs of batch) {
    if (state.cookie === null) {
      if (metrics.cookie_solves >= maxSolves) {
        log.warn("solve budget reached — stopping batch", { solves: metrics.cookie_solves });
        break;
      }
      if (users.length === 0) {
        log.error("no webshare users configured");
        break;
      }
      if (!(await ensureCookie(state, metrics, users, pass))) {
        await sleep(3000);
        continue;
      }
    }

    let token: string;
    try {
      token = await encryptNrKrs(krs);
    } catch (error) {
      log.error("encryptNrKrs failed", { krs, error: String(error) });
      metrics.failed_requests += 1;
      metrics.firms_probed += 1;
      state.offset += 1;
      save(state, metrics);
      continue;
    }

    let outcome = await searchLocal(state.cookie, token);
    metrics.search_requests += 1;
    metrics.search_bytes += outcome.bytes;

    if (outcome.kind === "error") {
      log.warn("search error — retry once", { krs, error: outcome.message });
      outcome = await searchLocal(state.cookie, token);
      metrics.search_requests += 1;
      metrics.search_bytes += outcome.bytes;
    }

    switch (outcome.kind) {
      case "ok":
        break;
      case "empty":
        metrics.empty_no_xml += 1;
        break;
      case "challenge":
        metrics.challenges += 1;
        metrics.requests_per_cookie.push(state.reqsOnCookie);
        log.warn("challenge received — rotating cookie", { krs, reqsOnCookie: state.reqsOnCookie });
        state.cookie = null;
        state.reqsOnCookie = 0;
        await sleep(2000);
        break;
      case "error":
        metrics.failed_requests += 1;
        log.error("search failed after retry", { krs, error: outcome.message });
        break;
    }

    state.reqsOnCookie += 1;
    metrics.firms_probed += 1;
    state.offset += 1;
    save(state, metrics);
    await sleep(sleepMs);
  }

  metrics.wall_ms += Date.now() - runStart;
  save(state, metrics);
  log.info("batch done", {
    offset: state.offset,
    firmsProbed: metrics.firms_probed,
    searchRequests: metrics.search_requests,
    searchBytesKB: Math.round(metrics.search_bytes / 1024),
    solveBytesKB: Math.round(metrics.solve_bytes / 1024),
    challenges: metrics.challenges,
    failed: metrics.failed_requests,
    wallSeconds: Math.round(metrics.wall_ms / 1000),
  });
}

main().catch((error) => {
  log.error("seed crashed", { error: String(error) });
  process.exit(1);
});
