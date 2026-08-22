# raporty-firmowe

A collector of public data about Polish companies.
It runs on Cloudflare Workers.

The project has three parts:
1. A collector. It downloads public company data.
2. A parser. It changes raw data into a clean model.
3. A local API. It serves the collected data.

This README is the main entry point.
Read the docs in this order:

| Doc | What it explains |
|---|---|
| [docs/INDEX.md](docs/INDEX.md) | Index of all documents |
| [docs/01-overview.md](docs/01-overview.md) | What the project does and why |
| [docs/02-bizraport-study.md](docs/02-bizraport-study.md) | What we learned from BizRaport |
| [docs/03-sources.md](docs/03-sources.md) | The public data sources |
| [docs/04-data-model.md](docs/04-data-model.md) | The data model and legal forms |
| [docs/05-pipeline.md](docs/05-pipeline.md) | How data flows through the system |
| [docs/06-api.md](docs/06-api.md) | The local API |
| [docs/07-security.md](docs/07-security.md) | Security rules we must follow |
| [docs/08-whats-left.md](docs/08-whats-left.md) | What is not finished yet |
| [docs/09-bizraport-coverage.md](docs/09-bizraport-coverage.md) | BizRaport API coverage and credit ledger |
| [docs/10-api-mcp-billing.md](docs/10-api-mcp-billing.md) | API, MCP server and credits |

## Quick start

```bash
npm install
npm run db:migrate
npm run dev
# load the demo dataset (taxonomy + 24 real companies)
curl -X POST http://localhost:8787/seed
# create an account and get an api key (100 free credits)
curl -X POST -H 'Content-Type: application/json' \
  -d '{"email":"demo@test.pl"}' http://localhost:8787/api/account
```

The product has no web UI. It serves data through:
- a REST API (`/api/*`),
- an MCP server (`/mcp`) for AI agents.

See [docs/10-api-mcp-billing.md](docs/10-api-mcp-billing.md).
The file [SKILL.md](SKILL.md) documents the MCP for an agent.

## Test status

- 141 tests pass. The BizRaport battery is skipped without credentials.
- Type check passes.
- Smoke test works. It seeds the database and exercises
  accounts, credits, catalog, reports, PKD and MCP.

## Project structure

```
src/
  index.ts            entry point
  config.ts           environment config
  domain/types.ts     domain model
  domain/vocab.ts     shared vocabulary enums
  lib/                http, retry, errors, normalize
  metrics/            indicators, risk, valuation, benchmarks, branch, report
  sources/            krs, rdf, regon (mock), ceidg, prs, pkd
  search/             catalog filters, catalog query, fulltext
  store/              schema, d1, d1-read, billing, catalog
  pipeline/           ingest
  api/                routes, middleware, services, account, billing, data, branches
  mcp/                server, tools
  seed/               demo dataset
  billing/            stripe
test/
  unit/               unit tests + parity tests
  integration/        real KRS OpenAPI test + BizRaport battery
  fixtures/           real odpis data, BizRaport data, statement data
```

## The key idea

Polish company data is public and free.
The data comes from official registers.
Anyone can download it.

The value is not in the data.
The value is in what we do with the data.
We parse it. We calculate metrics. We build benchmarks.
We build a graph of connections.
This is the "derived value layer".
It is our moat.

Learn more in [docs/01-overview.md](docs/01-overview.md).
