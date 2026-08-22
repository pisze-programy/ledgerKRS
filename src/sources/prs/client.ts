export interface KrzEntry {
  krs: string;
  date: string | null;
  category: string | null;
  announcementNumber: string | null;
  title: string | null;
  caseNumber: string | null;
  court: string | null;
  content: string | null;
}

export interface PrsClientOptions {
  baseUrl: string;
  transport: (url: string) => Promise<unknown>;
}

export function createPrsClient(options: PrsClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  return {
    async getKrzEntries(krs: string): Promise<KrzEntry[]> {
      const body = await options.transport(`${baseUrl}/api/krz/${krs}`);
      return parseKrz(krs, body);
    },
  };
}

export function parseKrz(krs: string, body: unknown): KrzEntry[] {
  const data = extractArray(body);
  return data.map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      krs,
      date: asString(record.data_krz) ?? asString(record.data) ?? null,
      category: asString(record.kategoria_tytul) ?? null,
      announcementNumber: asString(record.numer_obwieszczenia) ?? null,
      title: asString(record.tytul_obwieszczenia) ?? null,
      caseNumber: asString(record.sygnatura_akt) ?? null,
      court: asString(record.sad) ?? null,
      content: asString(record.tresc) ?? null,
    };
  });
}

function extractArray(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (isRecord(body)) {
    const data = body.data ?? body["dane"] ?? body["Obwieszczenia"];
    return Array.isArray(data) ? data : [];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
