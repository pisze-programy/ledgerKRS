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

## Request examples (REST)

Same data, plain HTTP. Base URL `https://raporty-firmowe.dev`.
Send the key in the header `X-API-Key`.

### Company report

```bash
curl "https://raporty-firmowe.dev/api/dane?krs=0000222483" -H "x-api-key: $KEY"
```

```json
{ "data": [{
    "krs": "0000222483_",
    "nip": 7791011327,
    "informacje_o_firmie": [ { "nazwa_pola": "nazwa", "wartosc": "JERONIMO MARTINS POLSKA S.A." } ],
    "dane_finansowe": [ { "rok": 2024, "nazwa_wskaznika": "przychody", "kwota": 108317454729 } ],
    "powiazania": [ … ]
}]}
```

### Statements

```bash
curl "https://raporty-firmowe.dev/api/sprawozdania?krs=0000597711" -H "x-api-key: $KEY"
```

```json
{ "data": [{
    "krs": "0000597711_",
    "okresy": [ { "okres_sprawozdawczy": "01-03-2024_28-02-2025", "sekcje": [ … ] } ]
}]}
```

### Catalog filter

```bash
curl "https://raporty-firmowe.dev/api/katalog?przychody_od=10000000000&wojewodztwo=WIELKOPOLSKIE" -H "x-api-key: $KEY"
```

```json
{ "count": 4, "fetchedCount": 4,
  "data": [ { "krs": "0000222483", "name": "JERONIMO MARTINS POLSKA S.A.", "przychody": 108317454729 } ] }
```

### Search

```bash
curl "https://raporty-firmowe.dev/api/szukaj?q=baseli" -H "x-api-key: $KEY"
```

```json
{ "data": [ { "krs": "0000795513" }, { "krs": "0000581581" } ], "dane_uciete": false }
```

### Branches

```bash
curl "https://raporty-firmowe.dev/api/branze" -H "x-api-key: $KEY"
```

```json
{ "data": [ { "code": "A", "name": "Rolnictwo, leśnictwo, łowiectwo i rybactwo", "divisions": [ … ] } ] }
```

### PKD report

```bash
curl "https://raporty-firmowe.dev/api/pkd/47.11.Z?rok=2024" -H "x-api-key: $KEY"
```

```json
{ "data": [ { "code": "47.11.Z", "summary": { "count": 3400 },
    "percentiles": { "przychody": { "50": 1500000, "90": 23000000 } } } ] }
```

### Balance

```bash
curl "https://raporty-firmowe.dev/api/balance" -H "x-api-key: $KEY"
```

```json
{ "balance": 98 }
```

### Usage

```bash
curl "https://raporty-firmowe.dev/api/zuzycie" -H "x-api-key: $KEY"
```

```json
{ "model": "payg", "balance": 98, "zuzycie": { "/dane": 1, "/katalog": 1 } }
```

## Agents and harnesses

MCP works with any agent that speaks JSON-RPC.
Popular agents: Claude (Anthropic), ChatGPT / OpenAI, Gemini,
Microsoft Copilot, DeepSeek / Qwen / Kimi, Llama / Mistral / Bielik,
opencode, Perplexity.

Popular harnesses: OpenAI Agents SDK, Claude Agent SDK, LangChain,
LlamaIndex, CrewAI, AutoGen, n8n, Make, Zapier, Flowise, Dify.

To connect:

1. `POST /api/account` with an email. Keep the `api_key`.
2. Add the MCP server `https://raporty-firmowe.dev/mcp`
   and send `api_key` in the `X-API-Key` header.
3. The agent calls the tools.

Prefer plain HTTP instead? Define one tool and point it at the REST
endpoint. Example function-calling schema:

```json
{
  "name": "sprawdz_firme",
  "description": "Dane firmy z KRS po NIP",
  "parameters": {
    "type": "object",
    "properties": { "nip": { "type": "string" } },
    "required": ["nip"]
  }
}
```

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
