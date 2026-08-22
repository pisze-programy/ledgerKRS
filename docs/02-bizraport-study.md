# 02 — BizRaport study

This document records what we learned from BizRaport.
BizRaport is a Polish company-data aggregator.
We studied their site and their API.
We used their data model as inspiration.

This is not a copy. This is our own design.

## What BizRaport is

BizRaport collects data about Polish companies.
The data comes from public registers.
The registers are:

- KRS. The National Court Register.
- REGON. The GUS statistical register.
- MSiG. The Court and Economic Monitor.
- KRZ. The National Debtors Register.

BizRaport adds value to the raw data.
They sell:

- Company reports.
- Financial indicators.
- Risk models.
- Industry benchmarks.
- Ownership graphs.
- AI descriptions.
- A paid API.

## The model that works

The raw data is public. It is not the moat.
The moat is the derived value layer.

The derived value layer has these parts:

1. Parsing. They parse financial statements into structured positions.
2. Indicators. They calculate EBIT, EBITDA, margins, ROE, ROA.
3. Models. They predict insolvency and creditworthiness.
4. Benchmarks. They compare a company to its industry.
5. Graph. They link people and companies together.
6. AI. They write company descriptions with an LLM.

## What we confirmed about the data

- One company equals one report page.
- The API returns the same structure for all legal forms.
- Ownership percentages exist only for forms with shares.
- Partners go to connections. They do not go to ownership.
- KRS numbers are 10 digits. The API returns them with an underscore.
- The API accepts a short KRS and pads it with zeros.

## The public sources are free

We verified these sources live:

| Source | URL | Auth |
|---|---|---|
| KRS OpenAPI | `https://api-krs.ms.gov.pl` | none |
| RDF documents | `https://rdf-przegladarka.ms.gov.pl` | Incapsula protection |
| REGON API | `https://wyszukiwarkaregon.stat.gov.pl/wsBIR` | key |
| CEIDG open data | `https://dane.gov.pl` | none |
| PRS (MSiG/KRZ) | `https://prs.ms.gov.pl` | none |

See [03-sources.md](03-sources.md).

## Anti-patterns we must avoid

We found these mistakes in BizRaport.

1. Credentials in the URL. They put email and password in the query string.
2. No rate limits. The API has no rate limit headers.
3. No pagination. The catalog returns up to 1 million rows.
4. Client-side paywall. The report data is in the HTML. The paywall is only a blur.
5. No scoped API keys. Email and password are the only credentials.

We must avoid all of these.
See [07-security.md](07-security.md).

## The bottom line

The data is public. The moat is the work on the data.
We build the same derived value layer from the public sources.
We do it with clean code and tests.
