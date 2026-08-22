---
name: raporty-firmowe
description: Paid MCP server with public data about Polish companies (KRS). Query company reports, financial statements, a filterable company catalog, PKD industry branches and benchmarks. Credits are pay-as-you-go: 1000 credits for 9.99 PLN, one credit per data call. Use when the user asks for Polish company data, financials, company catalog filters, or industry reports.
---

# raporty-firmowe — paid company data MCP

Public data about Polish companies from KRS.
The agent serves the data. The agent composes the view.

## First run

1. Create an account with a REST call (no API key needed):

   ```
   POST /api/account
   { "email": "you@example.com" }
   ```

   The response contains `api_key` and 100 free credits.
2. Keep the `api_key`. Send it as the `X-API-Key` header
   on every MCP request.
3. Check balance with the `get_balance` tool.

## Buying credits

Call `buy_credits`.
It returns a Stripe checkout URL for 1000 credits (9.99 PLN).
The user pays on the Stripe page.

In the mock billing mode, the credits arrive automatically
about 5 seconds after the checkout is created.
Check `get_balance` again after a moment.

## Pricing

- 1000 credits for 9.99 PLN.
- One credit per call that returns data.
- Empty results and errors cost nothing.
- 100 free credits on signup.
- A company report is one credit. A statement download is one credit.
- A catalog filter result is one credit. A PKD report is one credit.

## Tools

| Tool | What it does |
|---|---|
| `get_company` | Full company report by krs or nip |
| `get_statements` | Full financial statements, position by position |
| `search_companies` | Full-text search by name, NIP, KRS, REGON |
| `filter_catalog` | Filter companies by finances, PKD, location, ratios |
| `list_branches` | PKD taxonomy: sections and divisions |
| `get_pkd_report` | Industry report for a PKD code |
| `get_balance` | Current credit balance |
| `buy_credits` | Checkout URL for a credit package |
| `get_usage` | Credits spent per endpoint, transactions |

## Common flows

### Verify a company before a contract

1. `get_company` with a NIP.
2. Read `informacje_o_firmie`, `dane_finansowe`, `krz`, `monitor_sadowy`.
3. Note `wiarygodnosc` (1 is the best) and `niewyplacalnosc_lub_restrukturyzacja_24m`.

### Build a lead list

1. `filter_catalog` with revenue and PKD filters.
2. Read the `count` field. The response rows carry the four key metrics:
   `aktywa`, `przychody`, `zysk_netto`, `wartosc_firmy`.
3. Use the KRS values to fetch full reports with `get_company`.

### Industry analysis

1. `list_branches` to find a section or division.
2. `get_pkd_report` with the code (for example `62` or `62.01.Z`).
3. Read `summary`, `size`, `top`, `geo`, `percentiles`.
   Percentiles use the scale where `10` means "the top 10% of firms are above this value".

## Notes

- KRS numbers are 10 digits.
- Percentages in the report are fractions. `0.15` means 15%.
- Ownership percentages are on a 0 to 100 scale.
- When a tool returns an empty result, no credit is spent.
- Keep the API key in a header. Never send it in a tool argument.
