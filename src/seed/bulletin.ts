import { catalogRowFromReport } from "./bizraport";
import { padKrs } from "../lib/normalize";
import type { CatalogRow } from "../store/catalog";
import type { Repository } from "../store/repository";
import type { IngestService } from "../pipeline/ingest";
import type { CatalogRepository } from "../store/catalog";

export interface BulletinDeps {
  ingest: IngestService;
  repository: Repository;
  catalog: CatalogRepository;
}

export interface BulletinResult {
  day: string;
  krsFound: number;
  ingested: number;
  catalogRows: number;
  failed: string[];
  detail: string[];
}

export async function seedBulletin(deps: BulletinDeps, day: string | null, limit: number): Promise<BulletinResult> {
  const target = day ?? yesterdayIso();
  const krsList = [...new Set(await deps.ingest.listBulletin(target, limit))];
  const rows: CatalogRow[] = [];
  const failed: string[] = [];
  const detail: string[] = [];
  for (const raw of krsList) {
    const krs = padKrs(raw);
    const outcome = await ingestOnce(deps, krs, failed);
    detail.push(`${raw}: ${outcome}`);
    if (!outcome.startsWith("ok")) {
      continue;
    }
    const report = await deps.repository.getReport(krs);
    if (report) {
      rows.push(catalogRowFromReport(report));
    }
  }
  if (rows.length > 0) {
    await deps.catalog.upsertCatalogRows(rows);
  }
  return { day: target, krsFound: krsList.length, ingested: rows.length, catalogRows: rows.length, failed, detail };
}

async function ingestOnce(deps: BulletinDeps, krs: string, failed: string[]): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await sleep(300);
    }
    try {
      const result = await deps.ingest.ingestCompany(krs);
      const report = await deps.repository.getReport(krs);
      if (report) {
        return `ok`;
      }
      const company = await deps.repository.getCompany(krs);
      return `no-report(processed=${result.processed}, failed=${result.failed}, company=${company ? "yes" : "no"})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 1) {
        failed.push(`${krs}: ${message}`);
        return `error: ${message}`;
      }
    }
  }
  return "error-unreachable";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yesterdayIso(): string {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
