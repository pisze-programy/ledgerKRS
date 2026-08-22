import { parseSprawozdanie, type ParsedStatement } from "./parser";

export interface RdfClientOptions {
  baseUrl: string;
  transport: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface RdfDocument {
  krs: string;
  statements: ParsedStatement[];
}

export interface RdfSearchHit {
  id: string;
  rodzaj: string;
  status: string;
  okresSprawozdawczyPoczatek: string | null;
  okresSprawozdawczyKoniec: string | null;
}

const PERM_KEY = "6a5Qm4W&MkiD=hwo";
const SEARCH_PATH = "/services/rdf/przegladarka-dokumentow-finansowych/dokumenty/wyszukiwanie";
const DOC_PATH = "/services/rdf/przegladarka-dokumentow-finansowych/dokumenty";

export function createRdfClient(options: RdfClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const transport = options.transport;
  return {
    async searchDocuments(krs: string): Promise<RdfSearchHit[]> {
      const token = await encryptNrKrs(krs);
      const hits: RdfSearchHit[] = [];
      for (let page = 0; page < 50; page += 1) {
        const response = await transport(`${baseUrl}${SEARCH_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Referer: `${baseUrl}/wyszukaj-podmiot`,
          },
          body: JSON.stringify({
            metadaneStronicowania: {
              numerStrony: page,
              rozmiarStrony: 50,
              metadaneSortowania: [{ atrybut: "rodzajDokumentu.nazwa", kierunek: "ROSNACO" }],
            },
            nrKRS: token,
          }),
        });
        const body = (await response.json()) as { content?: RdfSearchHit[] };
        const content = body.content ?? [];
        hits.push(...content);
        if (content.length < 50) {
          break;
        }
      }
      return hits;
    },
    async listXmlStatements(krs: string): Promise<RdfSearchHit[]> {
      const hits = await this.searchDocuments(krs);
      const result: RdfSearchHit[] = [];
      for (const hit of hits) {
        const document = await this.documentMeta(hit.id);
        if (document && isXmlCapable(document)) {
          result.push(hit);
        }
      }
      return result;
    },
    async documentMeta(id: string): Promise<Record<string, unknown> | null> {
      const response = await transport(`${baseUrl}${DOC_PATH}/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json", Referer: `${baseUrl}/wyszukaj-podmiot` },
      });
      if (response.status !== 200) {
        return null;
      }
      return (await response.json()) as Record<string, unknown>;
    },
    async downloadXml(id: string): Promise<string | null> {
      const response = await transport(`${baseUrl}${DOC_PATH}/${encodeURIComponent(id)}/tresc?bezPodpisu=false`, {
        headers: { Accept: "application/json", Referer: `${baseUrl}/wyszukaj-podmiot` },
      });
      if (response.status !== 200) {
        return null;
      }
      const text = await response.text();
      return text.includes("<") && text.includes("<?xml") ? text : null;
    },
    async fetchStatements(krs: string): Promise<RdfDocument> {
      const hits = await this.listXmlStatements(krs);
      const statements: ParsedStatement[] = [];
      for (const hit of hits) {
        const xml = await this.downloadXml(hit.id);
        if (!xml) {
          continue;
        }
        const statement = parseSprawozdanie(xml);
        if (statement) {
          statements.push(statement);
        }
      }
      return { krs, statements };
    },
  };
}

export function isXmlCapable(document: Record<string, unknown>): boolean {
  const rodzaj = document["rodzajDokumentu"] as Record<string, unknown> | undefined;
  const extensions = (rodzaj?.["dopuszczalneRozszerzenia"] as string | undefined) ?? "";
  return /\.XML/i.test(extensions);
}

const encoder = new TextEncoder();

export async function encryptNrKrs(krs: string): Promise<string> {
  const plain = krs.replace(/\D/g, "").padStart(10, "0").slice(0, 10);
  const n = randomHex16();
  const keyInner = await importKey(encoder.encode(n));
  const innerIv = encoder.encode(n);
  const innerCipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv: innerIv }, keyInner, encoder.encode(plain));
  const a = toBase64(new Uint8Array(innerCipher));
  const permKey = await importKey(encoder.encode(PERM_KEY));
  const permIv = encoder.encode(PERM_KEY);
  const outerCipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv: permIv }, permKey, encoder.encode(`${a}.${n}`));
  return toBase64(new Uint8Array(outerCipher));
}

function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-CBC" }, false, ["encrypt"]);
}

function randomHex16(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = new DataView(bytes.buffer).getUint32(0, true);
  return value.toString().padStart(16, "0");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
