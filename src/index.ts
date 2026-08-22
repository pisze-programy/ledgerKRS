import { createApp } from "./api/routes";
import { loadConfig, type Bindings } from "./config";
import { createD1Repository } from "./store/d1";
import { createD1BillingRepository } from "./store/billing-d1";
import { createD1CatalogRepository } from "./store/catalog-d1";
import { createIngest } from "./pipeline/ingest";
import { createKrsClient } from "./sources/krs/client";
import { createRdfClient } from "./sources/rdf/client";
import { createRdfFetchTransport } from "./sources/rdf/transport";

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const config = loadConfig(env);
    if (!env.DB) {
      throw new Error("DB binding missing");
    }
    const repository = createD1Repository(env.DB);
    const krsClient = createKrsClient({ baseUrl: config.krsApiBase });
    const rdfClient = config.rdfCookie
      ? createRdfClient({ baseUrl: config.rdfBase, transport: createRdfFetchTransport(config.rdfCookie) })
      : undefined;
    const ingest = createIngest({ krsClient, rdfClient, repository });
    const app = createApp({
      repository,
      ingest,
      billing: createD1BillingRepository(env.DB),
      catalog: createD1CatalogRepository(env.DB),
      config,
      fetchAsset: assetsFetcher(request, env),
    });
    return app.fetch(request, env);
  },
} satisfies ExportedHandler<Bindings>;

function assetsFetcher(request: Request, env: Bindings) {
  return async (path: string): Promise<string | null> => {
    if (!env.ASSETS) {
      return null;
    }
    const url = new URL(path, request.url);
    const response = await env.ASSETS.fetch(url);
    return response.ok ? response.text() : null;
  };
}
