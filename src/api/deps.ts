import type { AppConfig } from "../config";
import type { Repository } from "../store/repository";
import type { BillingRepository } from "../store/billing";
import type { CatalogRepository } from "../store/catalog";
import type { IngestService } from "../pipeline/ingest";
import type { FetchAsset } from "../web/landing";

export interface ApiDeps {
  repository: Repository;
  ingest: IngestService;
  billing: BillingRepository;
  catalog: CatalogRepository;
  config: AppConfig;
  fetchAsset: FetchAsset;
}

export interface AppEnv {
  Variables: {
    accountId: number;
    charged?: boolean;
  };
}
