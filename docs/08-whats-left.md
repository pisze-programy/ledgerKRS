# 08 — What is left

This document explains what is not finished.
It also explains what to do next.

## Real Stripe billing

Billing runs in mock mode by default.
The mock adds credits about 5 seconds after checkout.
To go live, set `BILLING_MODE=live` and add:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` for the 1000-credit package

## Live REGON

REGON runs in mock mode by default.
The mock returns canned answers based on the last digit of the NIP.
To go live, get a GUS key and set `REGON_MODE=live`.

## RDF transport

RDF stores financial statements.
The site is behind Incapsula. Incapsula blocks direct requests.

The browser transport works (Playwright + Webshare residential for cookies).
A first seed measured 720 firms with 0 challenges: searches are cross-IP and
run from the local IP for free; Webshare only solves the small cookie
(~$3 for the full 1.2M-firm seed). See
[rdf-scraping-infra.md](rdf-scraping-infra.md) section 8 for the model.

Open: the XML/PDF download phase (`tresc` is bound to the solving IP) needs a
free bulk channel — the phone was it (off), the local IP works with retries.
Decision pending. The corpus currently grows via pb.pl (plain HTTP) and
BizRaport validation.

## CEIDG endpoint

CEIDG covers sole proprietors.
The client has a pluggable transport.
The transport endpoint needs confirmation.

Find the real endpoint on `https://dane.gov.pl`.

## The full automatic pipeline

The demo seed loads about 24 real companies.
The full pipeline loads everything through the bulletin:

1. Read the bulletin for the day.
2. Ingest every changed company.
3. Read the statements from RDF.
4. Compute metrics from the statements.
5. Rebuild catalog rows and branch statistics.

See [05-pipeline.md](05-pipeline.md).

## Risk and valuation models

The models are implemented and deterministic.
The next step is to train a real ML model.
Use KRZ and MSiG entries as labels.
Keep the same types and indicator names.

## What works now

- REST API: accounts, credits, billing, reports, catalog,
  search, branches, PKD reports.
- MCP server: 9 tools over JSON-RPC at `/mcp`.
- Billing: pay-as-you-go, 1000 credits for 9.99 PLN,
  one credit per data call, 100 free credits on signup.
- REGON mock: several BIR variants.
- PKD taxonomy: 1037 entries.
- Catalog filters: full BizRaport filter vocabulary.
- KRS parser: all main legal forms.
- Demo seed: 24 real companies, real financials for 13.
- 141 tests pass. Type check passes.
