# 09 — BizRaport API coverage

This document explains how we covered the BizRaport API.
We used a test account with a free limit.
The limit is 100 queries, counted for the lifetime of the account.

We tracked every query.
The live ledger is in `test/fixtures/bizraport/ledger.json`.
A human-readable copy is in the recon folder.

## The API surface

| Endpoint | Purpose | Free cases |
|---|---|---|
| `/api/dane` | Full company report | 200 with empty `data` |
| `/api/sprawozdania` | Full financial statements | 200 with empty `data` |
| `/api/katalog` | Filter companies | 200 with empty `data` |
| `/api/szukaj` | Full-text search | 200 with empty `data` |
| `/api/zuzycie` | Usage counter | always free |

Only a 200 response with data costs one credit.
All errors and empty results are free.

## Credit usage

| Stage | Used | Available |
|---|---|---|
| Start of the task | 61 / 100 | 39 |
| After the live battery | 91 / 100 | 9 |

The battery spent about 30 credits.
The remaining runs reused the saved fixtures.
They spent 0 credits.

## The battery

The battery lives in `test/integration/bizraport/battery.test.ts`.
Run it with `npm run test:bizraport`.
It needs `BIZRAPORT_EMAIL` and `BIZRAPORT_PASSWORD`.
It skips itself when the variables are absent.
It never runs in the default `npm test`.

Each probe saves the response as a fixture.
Then it appends the call to the ledger.
Use `BIZRAPORT_REUSE_FIXTURES=1` to reuse saved fixtures.
This lets you re-run the battery without spending credits.

## Coverage matrix

| BizRaport surface | API | Our counterpart | Status |
|---|---|---|---|
| Company report | `/api/dane` | KRS parser + report | Covered |
| Financial indicators | `dane_finansowe` | `metrics/indicators.ts` | Covered |
| Risk model | `wiarygodnosc`, `niewyplacalnosc_24m` | `metrics/risk.ts` | Covered |
| Valuation | `wartosc_firmy_*` | `metrics/valuation.ts` | Covered |
| Credit limit | `kredyt_kupiecki_*` | `metrics/valuation.ts` | Covered |
| Industry position | `pozycja_na_tle_branzy` | `metrics/benchmarks.ts` | Covered |
| Statements | `/api/sprawozdania` | `sources/rdf/parser.ts` | Covered |
| Monitor entries | `monitor_sadowy` | `monitor_entries` table | Covered |
| KRZ entries | `krz` | `krz_entries` table | Covered |
| Statement history | `historia_sprawozdan` | `statement_history` table | Covered |
| Catalog filters | `/api/katalog` | documented filter list | Covered |
| Search | `/api/szukaj` | documented modes | Covered |
| AI description | `opisy_firmy` | future (LLM) | Deferred |
| Export | `/pobierz-dane` | future endpoint | Deferred |

## Legal forms verified live

| Form | KRS | Result |
|---|---|---|
| SA | 0000222483 | parses |
| sp. z o.o. | 0000795513 | parses |
| komandytowa | 0000597711 | parses |
| jawna | 0000005714 | parses |
| S.K.A. | 0000781241 | parses |
| PSA | 0001023457 | parses, no statements |
| spółdzielnia | 0000166742 | parses |
| oddział zagraniczny | 0001207691 | parses |
| fundacja | 0000670940 | parses |
| stowarzyszenie | 0000003409 | parses |
| likwidacja | 0000498819 | BizRaport only, no odpis |

## Findings from the battery

- The API has 36 financial indicator names. We put all of them in one enum.
- The API has 10 benchmark indicators. The revenue row has three extra fields.
- Connections have more types than documented:
  `likwidator`, `syndyk`, `powiązanie zwrotne`,
  `podmioty o identycznym NIP`, `podmioty o identycznym REGON`,
  `powstanie organizacji`.
- A PSA files no financial statements. Statements are empty and free.
- `wiarygodnosc` uses scale 1 to 5. 1 is the best credit rating.
- Percentages in `udzialy` are on scale 0 to 100.
- Percentiles in `pozycja_na_tle_branzy` are fractions 0 to 1.
- `katalog` requires at least one filter.
- `szukaj` truncates above about 100 000 results.
  The field `dane_uciete` says when this happens.
- Statement positions can have a `null` amount.
  The hierarchy comes from row order and `poziom_zaglebienia`.
- Reporting periods can be irregular.
  For example `01-03-2024_28-02-2025`.

## Deferred probes

These need more credits. We recorded them, not the data.

- A search query with more than 100 000 results (`dane_uciete`).
  The behavior is documented in the API docs.
- A NIP that maps to more than one KRS.
  Rare. We handle it from the documented semantics.
- Statements filed in thousands.
  The conversion logic is documented by BizRaport.

## Verified parity work (2026-08-24)

Against a live BizRaport report for KRS 0000951852:

- **Persons are unmasked via MSiG**: the KRS OpenAPI masks names, but the
  public court announcements carry the full odpis text. `sources/msig/persons.ts`
  parses `Rub. Dane wspólników` / `Dane osób wchodzących w skład organu` and
  `report/msigEnrich.ts` merges the real names into connections and ownership.
  PESELs are masked at the report boundary and never returned.
- **Main PKD**: the report now keeps the odpis order (przeważająca activity
  first) — `pkd_codes` is read by insertion id, not alphabetical.
- **pozycja_na_tle_branzy** and **podobne_organizacje** fill after
  `/ingest/benchmarks` + `/ingest/catalog`, but their quality depends on the
  corpus population (currently ~158 firms vs BizRaport's full registry).
- **Zatrudnienie**: null when not reported — matches BizRaport's "brak".
- **Wynagrodzenia**: BizRaport reports the porównawczy RZiS `Wynagrodzenia` +
  `Ubezpieczenia` (137 340); our RZiS code mapping for this company yields a
  kalkulacyjny-style `B_V` label, so `wages` stays null — documented RDF
  dict/variant gap, to fix in the RDF pass.

### Model differences (intentional — our own models)

- **Niewypłacalność 24m**: ours 25.4% (logistic on debt/liquidity/margin +
  signals) vs BizRaport 0.62%. Different calibration; theirs is proprietary.
- **Wiarygodność**: ours 5 (najniższa) vs BizRaport D — same direction.
- **Wycena**: ours = revenue×0.5 when EBITDA ≤ 0 (141 121) vs BizRaport
  189 330. Different method. The project trains its own deterministic models;
  an ML model is the planned next step (see 08-whats-left).

## Fixtures

All fixtures are in `test/fixtures/bizraport/`.
The name explains the case.

| Fixture group | What it covers |
|---|---|
| `jeronimo`, `baselinker`, `komandytowa`, `jawna`, `stowarzyszenie` | Main forms |
| `cit-estonski`, `krz-upadlosc`, `fundacja-opp`, `rozwiazana` | Special cases |
| `jer-onimo-graf`, `baselinker-graf` | Expanded connections |
| `psa`, `ska`, `spoldzielnia`, `oddzial`, `likwidacja` | New legal forms |
| `strata`, `mikro` | Financial extremes |
| `sprawozdania-*` | Statements |
| `katalog-*` | Filter results |
| `szukaj-*` | Search modes |
| `error-*`, `not-found-empty` | Error semantics |

## Related documents

- [01-overview.md](01-overview.md) — the project
- [03-sources.md](03-sources.md) — the public sources
- [04-data-model.md](04-data-model.md) — the data model
- [05-pipeline.md](05-pipeline.md) — the pipeline
- [08-whats-left.md](08-whats-left.md) — what is left
- [10-api-mcp-billing.md](10-api-mcp-billing.md) — how the API and MCP expose this data
