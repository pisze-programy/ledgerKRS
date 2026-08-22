# 04 — Data model and legal forms

This document explains the data model.
It also explains how the parser handles different legal forms.

## The domain model

The core types are in `src/domain/types.ts`.

| Type | What it holds |
|---|---|
| `Company` | KRS, NIP, REGON, name, legal form, address, capital, status |
| `Connection` | A person or organization linked to the company |
| `OwnershipShare` | A shareholder and their percentage |
| `PkdCode` | A PKD activity code |
| `StatementReference` | A filed financial statement |
| `CompanyReport` | A company with all its data |

## The registry extract

The KRS OpenAPI returns a registry extract.
The extract has header data and six sections.
The sections are called `dzial1` to `dzial6`.

| Section | What it holds |
|---|---|
| `dzial1` | Company data, address, capital, owners |
| `dzial2` | Management, supervisory organ, proxies |
| `dzial3` | Activity codes (PKD), filed documents |
| `dzial4` | Shares and capital details |
| `dzial5` | Court proceedings |
| `dzial6` | Mergers, divisions, transformations |

## Legal forms

The registry extract changes with the legal form.
The parser handles these forms.

| Legal form | Owner field | Ownership | Connections |
|---|---|---|---|
| sp. z o.o. | `wspolnicySpzoo` | yes, with percent | yes |
| SA | `jedynyAkcjonariusz` | yes | yes |
| sp. komandytowa | `wspolnicyPartnerzy` | no | yes, partners |
| sp. jawna | `wspolnicyPartnerzy` | no | yes, partners |
| fundacja | none | no | yes, supervisory organ |
| stowarzyszenie | none | no | yes, supervisory organ |

Rules:

- Partners go to connections. They do not go to ownership.
- Ownership percent is derived from the number of shares.
- Organizations (fundacje, stowarzyszenia) have no PKD codes.
- The client tries register `P` first. Then it tries register `S`.

## The financial statement

The financial statement has four sections.

| Section | What it holds |
|---|---|
| Bilans | Balance sheet |
| Rachunek zyskow i strat | Profit and loss |
| Rachunek przeplywow | Cash flow |
| Zestawienie zmian w kapitale | Equity changes |

Not every company files every section.
A small company may file only the balance sheet and profit and loss.
The parser must handle this.

Each position has:

| Field | What it holds |
|---|---|
| `kod_pozycji` | Official schema code |
| `poziom_zaglebienia` | Depth in the tree |
| `nazwa_pozycji` | Position name |
| `kwota` | Amount in PLN |

## The database schema

The schema is in `src/store/schema.sql`.

| Table | What it holds |
|---|---|
| `companies` | One row per company |
| `connections` | People and organizations linked to companies |
| `ownership` | Shareholders |
| `pkd_codes` | Activity codes |
| `statements` | Filed statements |
| `statement_positions` | Statement positions |
| `indicators` | Financial indicators |
| `benchmarks` | Industry benchmarks |
| `ingest_state` | Last processed bulletin day |
