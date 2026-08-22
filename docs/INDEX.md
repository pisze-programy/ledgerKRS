# Index of documents

This project collects public data about Polish companies.
These documents explain everything about it.

Read them in this order.

| Doc | What it explains |
|---|---|
| [01-overview.md](01-overview.md) | What the project does and why |
| [02-bizraport-study.md](02-bizraport-study.md) | What we learned from BizRaport |
| [03-sources.md](03-sources.md) | The public data sources |
| [04-data-model.md](04-data-model.md) | The data model and legal forms |
| [05-pipeline.md](05-pipeline.md) | How data flows through the system |
| [06-api.md](06-api.md) | The local API |
| [07-security.md](07-security.md) | Security rules we must follow |
| [08-whats-left.md](08-whats-left.md) | What is not finished yet |
| [09-bizraport-coverage.md](09-bizraport-coverage.md) | BizRaport API coverage and credit ledger |
| [10-api-mcp-billing.md](10-api-mcp-billing.md) | API, MCP server and credits |
| [rdf-state-of-knowledge.md](rdf-state-of-knowledge.md) | RDF: decoded pipeline, storage model, scale numbers |
| [rdf-scraping-infra.md](rdf-scraping-infra.md) | RDF scraping: Incapsula, proxy, 2captcha, Playwright solver — findings & production recommendations |

## Where the source code lives

| Path | Purpose |
|---|---|
| `src/sources/` | Clients and parsers for public sources |
| `src/metrics/` | Financial indicators and benchmarks |
| `src/pipeline/` | Data ingestion |
| `src/store/` | Database schema and repository |
| `src/api/` | HTTP routes |
| `test/` | Unit tests and integration tests |
| `test/fixtures/` | Real data used in tests |

## How the pieces connect

1. `src/sources/` downloads raw data from public sources.
2. `src/sources/` parses the raw data into the domain model.
3. `src/pipeline/` ingests the model into the database.
4. `src/metrics/` computes indicators from the data.
5. `src/api/` serves the data over HTTP.

See [05-pipeline.md](05-pipeline.md) for the flow.
