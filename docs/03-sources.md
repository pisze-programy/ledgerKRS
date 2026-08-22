# 03 — Public data sources

This project collects data from official Polish registers.
The data is public and free.

## Source list

| Source | What it gives | Access |
|---|---|---|
| KRS OpenAPI | Company registry data | REST, no auth |
| RDF | Financial statements in XML | Behind Incapsula |
| REGON | Company identifiers | API key needed |
| CEIDG | Sole proprietors (JDG) | Open data |
| MSiG | Court announcements | Through PRS |
| KRZ | Debtor announcements | Through PRS |

## KRS OpenAPI

KRS OpenAPI gives company registry data.
The base URL is `https://api-krs.ms.gov.pl`.

Endpoints:

| Endpoint | What it does |
|---|---|
| `/api/krs/OdpisAktualny/{krs}?rejestr=P&format=json` | Current registry extract |
| `/api/krs/OdpisPelny/{krs}?rejestr=P&format=json` | Full registry extract |
| `/api/Krs/Biuletyn/{day}` | List of KRS changed that day |
| `/api/Krs/BiuletynGodzinowy/{day}` | Same, per hour |

Notes:

- `rejestr` is `P` for companies and `S` for organizations.
- The client tries `P` first. Then it tries `S`.
- The bulletin returns short KRS numbers. We pad them to 10 digits.
- The registry extract has sections called `dzial1` to `dzial6`.
- Person names are masked. The API returns things like `S**********`.

The client is in `src/sources/krs/client.ts`.
The parser is in `src/sources/krs/parser.ts`.

## RDF

RDF is the Repository of Financial Documents.
It stores financial statements filed to KRS.
The base URL is `https://rdf-przegladarka.ms.gov.pl`.

The site is behind Incapsula. Incapsula is a bot protection service.
Direct requests from code are blocked.
We need a browser transport to fetch the XML files.

The parser is ready. It is in `src/sources/rdf/parser.ts`.
It parses the official XML schema into statement positions.
See [04-data-model.md](04-data-model.md).

## REGON

REGON is the GUS statistical register.
It gives identifiers like NIP and REGON.
The API needs a key. Registration is manual.
It takes about a week.

We do not need REGON for companies in KRS.
The KRS OpenAPI already returns NIP and REGON in the registry extract.
We need REGON only for companies outside KRS.

The client is ready. It is in `src/sources/regon/client.ts`.
The API returns XML. The client must parse XML.
The XML structure is in the `docs/` folder.

## CEIDG

CEIDG is the register of sole proprietors (JDG).
Sole proprietors have no KRS number.
CEIDG is open data on `https://dane.gov.pl`.
The client uses a pluggable transport.
The transport endpoint needs confirmation.

The client is in `src/sources/ceidg/client.ts`.

## MSiG and KRZ

MSiG is the Court and Economic Monitor.
KRZ is the National Debtors Register.
Both are announcements.
Both are available through PRS. PRS is `https://prs.ms.gov.pl`.

The client is in `src/sources/prs/client.ts`.
It parses announcements into a clean model.
