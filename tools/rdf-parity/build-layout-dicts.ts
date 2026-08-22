import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";

const CRD = "http://crd.gov.pl/xml/schematy/dziedzinowe";

export const LAYOUTS: Record<string, { wzor: string; label: string }> = {
  SFJINZ: { wzor: "2025/08/07/13817", label: "JednostkaInna (w złotych)" },
  SFJMAZ: { wzor: "2025/08/07/13818", label: "JednostkaMala (w złotych)" },
  SFJMIZ: { wzor: "2025/08/12/13821", label: "JednostkaMikro (w złotych)" },
  SFJOPZ: { wzor: "2025/08/12/13822", label: "Jednostka poz. publicznego (w złotych)" },
  SFBNKZ: { wzor: "2025/08/12/13826", label: "Bank (w złotych)" },
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const SECTION_NAMES = ["Bilans", "RZiS", "ZestZmianWKapitale", "RachPrzeplywow", "Naglowek", "WprowadzenieDoSprawozdaniaFinansowego", "DodatkoweInformacjeIObjasnienia", "InformacjaDodatkowa"];
const RZIS_VARIANTS = ["RZiSKalk", "RZiSPor"];

function sectionOf(name: unknown): string | null {
  if (typeof name !== "string") return null;
  for (const s of SECTION_NAMES) {
    if (name.startsWith(s)) return s;
  }
  return null;
}

function extractNames(xsd: string): Record<string, string> {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });
  const root = parser.parse(xsd) as any;
  const out: Record<string, string> = {};
  const walk = (node: any, section: string | null, variant: string | null): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, section, variant));
      return;
    }
    const name = node["@_name"];
    const ownSection = sectionOf(name) ?? section;
    const ownVariant = typeof name === "string" && RZIS_VARIANTS.includes(name) ? name : variant;
    let doc: string | null = null;
    if (node.annotation) {
      const d = Array.isArray(node.annotation) ? node.annotation[0] : node.annotation;
      const docs = d?.documentation;
      doc = typeof docs === "string" ? docs : Array.isArray(docs) ? (docs[0] ?? null) : null;
    }
    if (typeof name === "string" && typeof doc === "string" && doc.trim().length > 0) {
      const key = ownSection ? (ownSection === "RZiS" && ownVariant ? `${ownSection}.${ownVariant}.${name}` : `${ownSection}.${name}`) : name;
      out[key] = doc.replace(/\s+/g, " ").trim();
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") walk(v, ownSection, ownVariant);
    }
  };
  walk(root, null, null);
  return out;
}

async function main() {
  const result: Record<string, { label: string; names: Record<string, string> }> = {};
  for (const [key, { wzor, label }] of Object.entries(LAYOUTS)) {
    try {
      const base = `https://crd.gov.pl/wzor/${wzor}`;
      const schemat = await fetchText(`${base}/schemat.xsd`);
      const structureUrls = [...schemat.matchAll(/schemaLocation="([^"]+)"/g)].map((m) => m[1]!).filter((u) => u.includes("eD/"));
      const names: Record<string, string> = {};
      for (const url of structureUrls) {
        try {
          const xsd = await fetchText(url.startsWith("http") ? url : `https:${url}`);
          Object.assign(names, extractNames(xsd));
        } catch (e) {
          console.warn(`  skip ${url}: ${(e as Error).message}`);
        }
      }
      result[key] = { label, names };
      console.log(`${key}: ${Object.keys(names).length} names`);
    } catch (e) {
      console.warn(`${key} FAILED: ${(e as Error).message}`);
    }
  }
  mkdirSync(join(process.cwd(), "tools", "rdf-parity", "dump"), { recursive: true });
  writeFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "layout-dicts.json"), JSON.stringify(result, null, 1));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
