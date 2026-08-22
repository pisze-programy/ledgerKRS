# 06 — Local API

This document explains the local API.
The API is for development.
It has no frontend.

## How to run it

```bash
npm install
npm run db:migrate
npm run dev
```

The API runs at `http://localhost:8787`.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Returns status |
| GET | `/companies?limit=&offset=` | Lists companies |
| GET | `/companies/:krs` | Gets one company |
| POST | `/ingest/krs/:krs` | Ingests a company from KRS |
| POST | `/ingest/krs/:krs/financials` | Stores metrics for a company |
| POST | `/ingest/bulletin/:day` | Ingests a bulletin day |

## Examples

### Health check

```bash
curl http://localhost:8787/health
```

### Ingest one company

```bash
curl -X POST http://localhost:8787/ingest/krs/0000222483
```

### Store metrics

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"revenue":1000,"operatingCosts":800,"operatingProfit":200,"netProfit":150,"totalAssets":1000,"equity":500,"liabilities":500,"currentAssets":200,"currentLiabilities":100,"amortization":50}' \
  http://localhost:8787/ingest/krs/0000222483/financials
```

### List companies

```bash
curl http://localhost:8787/companies
```

## Notes

- The API reads and writes to Cloudflare D1.
- The API has no authentication. It is for local development.
- Add authentication before you deploy it.

See [07-security.md](07-security.md).
