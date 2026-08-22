# 05 — Pipeline

This document explains how data flows through the system.

## The flow

1. Download raw data from a public source.
2. Parse the raw data into the domain model.
3. Store the model in the database.
4. Calculate indicators and benchmarks.
5. Serve the data through the API.

## Ingestion

The ingestion code is in `src/pipeline/ingest.ts`.

Two operations exist.

### Ingest one company

`ingestCompany(krs)`

1. The KRS client downloads the registry extract.
2. The parser changes it into a `CompanyReport`.
3. The repository stores the company and its data.

### Ingest a bulletin day

`ingestBulletin(day)`

1. The KRS client downloads the list of changed KRS numbers.
2. For each KRS, it ingests the company.
3. It stores the last processed day.

## Metrics

The metrics code is in `src/metrics/indicators.ts`.

`ingestFinancials(krs, financials)`

1. It computes the metrics.
2. It stores the metrics as indicators.

The metrics are:

| Metric | Formula |
|---|---|
| EBIT | Operating profit |
| EBITDA | Operating profit + amortization |
| Operating margin | Operating profit / revenue |
| Net margin | Net profit / revenue |
| ROE | Net profit / equity |
| ROA | Net profit / total assets |
| Debt ratio | Liabilities / total assets |
| Current liquidity | Current assets / current liabilities |

## Benchmarks

The benchmark code is in `src/metrics/benchmarks.ts`.

Two functions exist.

`percentile(values, value)` returns the fraction of values below a value.

`marketShare(groupRevenue, companyRevenue)` returns a company share of a group.

## How the pipeline will run

The full automatic pipeline is not finished.
The RDF transport is not live yet.
Without RDF, we cannot read financial statements.

When RDF works, the flow will be:

1. Read the bulletin for the day.
2. Ingest every changed company.
3. Read the financial statements from RDF.
4. Compute metrics from the statements.
5. Store indicators and benchmarks.

See [08-whats-left.md](08-whats-left.md).
