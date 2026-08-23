import type { MonitorEntry } from "../../domain/types";

const SEARCH_BASE = "https://wyszukiwarka-msig.ms.gov.pl";

export interface MsigSearchItem {
  id: number;
  sequenceNumber: number;
  monitorNumber: string;
  dateOfPublication: string;
  entityName: string;
  signatureOfCase: string | null;
  signatureKRS: string | null;
}

export interface MsigDetail {
  entityName: string;
  numberOfNotice: string;
  signatureOfCase: string | null;
  krs: string | null;
  nip: string | null;
  page: number;
  chapterName: string;
  monitorNumber: string;
  dateOfPublication: string;
  textInPosition: string;
  textInBody: string;
  id: number;
}

type MsigSignatureType = "A" | "B";

function searchUrl(krs: string, signatureType: MsigSignatureType, page: number, pageSize: number, from: string, to: string): string {
  const params = new URLSearchParams({
    signatureType,
    krs,
    page: String(page),
    pageSize: String(pageSize),
    from,
    to,
    entityName: "",
  });
  return `${SEARCH_BASE}/api/Monitor/Search?${params.toString()}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`MSiG HTTP ${response.status} for ${url.slice(0, 120)}`);
  }
  return (await response.json()) as T;
}

/** Search the public MSiG announcements for a KRS. signatureType B = KRS registry entries (wpisy). */
export async function searchMsig(krs: string, signatureType: MsigSignatureType = "B"): Promise<MsigSearchItem[]> {
  const from = "2000-01-01";
  const to = new Date().toISOString().slice(0, 10);
  const items: MsigSearchItem[] = [];
  let page = 1;
  const pageSize = 100;
  for (let round = 0; round < 50; round += 1) {
    const body = await getJson<{ countPages: number; list: MsigSearchItem[] }>(searchUrl(krs, signatureType, page, pageSize, from, to));
    items.push(...(body.list ?? []));
    const countPages = body.countPages ?? page;
    if (page >= countPages) {
      break;
    }
    page += 1;
  }
  return items;
}

/** Fetch the full announcement detail (pozycja, treść, rozdział). */
export async function msigDetail(id: number): Promise<MsigDetail> {
  return getJson<MsigDetail>(`${SEARCH_BASE}/api/Monitor/Detalis?Id=${id}`);
}

/** Fetch full monitor entries (wpisy + ogłoszenia) for a KRS, mapped to the domain model. */
export async function fetchMonitorForKrs(krs: string): Promise<MonitorEntry[]> {
  const entries: MonitorEntry[] = [];
  for (const signatureType of ["B", "A"] as MsigSignatureType[]) {
    const items = await searchMsig(krs, signatureType);
    for (const item of items) {
      try {
        const detail = await msigDetail(item.id);
        entries.push({
          numerOgloszenia: detail.numberOfNotice ?? null,
          sygnaturaSprawy: item.signatureKRS ?? detail.signatureOfCase ?? null,
          trescNaglowka: detail.textInPosition ?? null,
          trescOgloszenia: detail.textInBody ?? null,
          nrMonitora: detail.monitorNumber ?? null,
          rozdzial: detail.chapterName ?? null,
          dataPublikacji: detail.dateOfPublication?.slice(0, 10) ?? null,
          nazwaPodmiotu: detail.entityName ?? null,
        });
      } catch {
        // skip a failed detail; keep the rest
      }
    }
  }
  return entries;
}
