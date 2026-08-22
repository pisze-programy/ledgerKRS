# 10 — API, MCP and billing

This document explains the delivery surface.
There is no web UI. We serve data only.
Two clients consume the data:

1. A REST API.
2. An MCP server for AI agents.

## Accounts

Create an account with one REST call. No API key is needed to create it.

```bash
curl -X POST https://raporty-firmowe.dev/api/account \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com"}'
```

The response:

```json
{
  "account_id": 1,
  "email": "you@example.com",
  "api_key": "5c52...",
  "balance": 100
}
```

Every other call sends the key in the header `X-API-Key`.
A missing or wrong key returns 401.

## Credits and pricing

- One credit per call that returns data.
- Empty results and errors cost nothing.
- 100 free credits on signup.
- One package: 1000 credits for 9.99 PLN.
- The price is pay-as-you-go. There is no subscription.

A data response carries two extra fields:

- `credits_spent` — always 1 when data was returned.
- `credits_remaining` — the balance after the call.

When the balance is zero, a data call returns 402.

## Buying credits

```bash
curl -X POST https://raporty-firmowe.dev/api/billing/checkout \
  -H "x-api-key: $KEY"
```

The response contains a Stripe checkout URL.

In `mock` billing mode, no real Stripe account is needed.
The credits arrive automatically about 5 seconds after checkout.
Check the balance again after a moment.

In `live` billing mode, Stripe confirms the payment
through the webhook at `/api/billing/webhook`.

## Balance and usage

```bash
curl https://raporty-firmowe.dev/api/balance -H "x-api-key: $KEY"
curl https://raporty-firmowe.dev/api/zuzycie -H "x-api-key: $KEY"
```

`/api/zuzycie` returns credits spent per endpoint and the transactions.

## REST API

| Method | Path | What it does | Costs |
|---|---|---|---|
| POST | `/api/account` | Creates an account | 0 |
| GET | `/api/balance` | Balance | 0 |
| GET | `/api/zuzycie` | Usage per endpoint | 0 |
| POST | `/api/billing/checkout` | Checkout URL | 0 |
| POST | `/api/billing/webhook` | Stripe confirmation | 0 |
| GET | `/api/dane?krs\|nip` | Full company report | 1 |
| GET | `/api/sprawozdania?krs` | Financial statements | 1 |
| GET | `/api/katalog?...` | Filter companies | 1 |
| GET | `/api/szukaj?q` | Full-text search | 1 |
| GET | `/api/branze` | PKD taxonomy | 1 |
| GET | `/api/pkd/:code?rok` | Industry report | 1 |

The company report contains:

- `company` — registry data.
- `financials` — computed indicators by reporting period.
- `connections`, `ownership`, `pkdCodes` — structure.
- `monitor`, `krz`, `history` — announcements and statement history.

## Catalog filters

`/api/katalog` accepts the same filter names as the BizRaport catalog:

- Financial ranges: `przychody_od/_do`, `zysk_netto_od/_do`,
  `ebit_od/_do`, `ebitda_od/_do`, `aktywa_*`, `gotowka_*`,
  `kapital_wlasny_*`, `zobowiazania_*`, `podatek_dochodowy_*`,
  `wynagrodzenia_*`, `amortyzacja_*`, `estymowana_wartosc_firmy_*`.
- Ratios in whole percentages: `roa_od`, `roe_od`, `marza_netto_od`,
  `marza_operacyjna_od`, `wskaznik_zadluzenia_od`,
  `srednioroczny_wzrost_przychodow_{1,3,5}_lat_od/_do`.
- PKD: `pkd_sekcja`, `pkd_dzial`, `pkd_podklasa`.
- Location: `wojewodztwo`, `miasto`, `adres`, `gmina`, `powiat`,
  `kod_pocztowy_poczatek`, `kod_pocztowy_koncowka`.
- Flags: `nie_wykreslona=tak`, `czy_status_opp=tak`, `cit_estonski=tak`.
- Recency: `ostatni_krz=N`, `ostatni_monitor=N`.
- Sorting: `sort`, `order`, `limit`, `offset`.

At least one filter is required. Without one, the call returns 400.

The response:

```json
{
  "data": [{ "krs": "...", "name": "...", "przychody": 123, "zysk_netto": 4, "aktywa": 5, "wartosc_firmy": 6 }],
  "count": 437,
  "fetchedCount": 437
}
```

Each row carries the four key metrics:
`aktywa`, `przychody`, `zysk_netto`, `wartosc_firmy`.

## PKD industry report

`/api/pkd/62.01.Z` returns one report:

- `summary` — count, total revenue, average revenue, average profit.
- `size` — count, total revenue, growth, CAGR.
- `top` — the biggest companies by revenue.
- `geo` — company count by voivodeship.
- `percentiles` — revenue, profit and valuation thresholds.
  The `10` value means "the top 10% of firms are above this value".

Pass `?rok=2024` to pick a year.

## MCP server

The MCP server runs on the same worker.
It speaks JSON-RPC over HTTP at `/mcp`.

`GET /mcp` lists the tools.
`POST /mcp` runs JSON-RPC methods:
`initialize`, `tools/list`, `tools/call`.

Send the API key in the `X-API-Key` header.

Tools:

| Tool | Arguments |
|---|---|
| `get_company` | `krs` or `nip` |
| `get_statements` | `krs` |
| `search_companies` | `q` |
| `filter_catalog` | the catalog filters |
| `list_branches` | none |
| `get_pkd_report` | `code`, `rok` |
| `get_balance` | none |
| `buy_credits` | none |
| `get_usage` | none |

A `tools/call` that returns data spends one credit.
The tool result includes `credits_spent` and `credits_remaining`.

The file `SKILL.md` documents the MCP for an AI agent.
Paste it into the agent prompt or use it as a skill.

## REGON without a key

The REGON source works in mock mode by default.
The mock returns canned answers based on the last digit of the NIP:

- 0 or 1 — service error.
- 9 — no data.
- 2 to 4 — small sole trader.
- 5 to 7 — medium sole trader.
- 8 — large company.

Set `REGON_MODE=live` and add a real key to use the real service.
See [03-sources.md](03-sources.md).

## Seed data

`POST /seed` loads the demo dataset into the database:

1. The full PKD taxonomy (1037 entries).
2. About 24 real companies from the KRS OpenAPI.
3. Real financials for 13 of them, from our fixtures.
4. Branch statistics per PKD class.

The seed makes the catalog filters, the PKD reports and the
company reports work with real data. See the ingest pipeline
in [05-pipeline.md](05-pipeline.md) for the full coverage plan.

## Related documents

- [01-overview.md](01-overview.md) — the project
- [08-whats-left.md](08-whats-left.md) — what is left
- [09-bizraport-coverage.md](09-bizraport-coverage.md) — BizRaport coverage
