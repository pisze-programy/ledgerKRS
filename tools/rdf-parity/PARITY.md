# RDF parity — working document

Status of the effort to match BizRaport coverage with our free RDF pipeline,
verified on a **random** sample (not hand-picked KRS).

## Method (why random)

Hand-picking known companies (Jerónimo, Orlen, PKO BP) shows only ideal cases.
To know the true coverage we draw a random sample from the KRS biuletyn
(companies that actually change in the registry) and:

1. **Pass 1 (structural, free)** — for each KRS: does RDF have documents?
   XML-capable annual statements? what layout? what years?
   → `tools/rdf-parity/pass1.ts` → `dump/pass1-structural.json`
2. **Pass 2 (parity, BizRaport credits)** — for a random XML subset: download
   all annual XML, parse, compute our canonical indicators; fetch BizRaport
   `/api/dane`; compare value-by-value, year-by-year.
   → `tools/rdf-parity/pass2.ts` → `dump/pass2-parity.json`
3. **Characterization (BizRaport side)** — what BizRaport itself covers on the
   random sample (pre-XML years, employment, layout variance).
   → `tools/rdf-parity/characterize.ts` → `dump/characterize-bizraport.json`

## Dumps

| Dump | What | Status |
|---|---|---|
| `dump/sample-biuletyn.json` | 200 random KRS from 6 biuletyn days (16k unique) | ✅ saved |
| `dump/characterize-bizraport.json` | BizRaport coverage on 8 random companies | ✅ saved |
| `dump/pass1-structural.json` | RDF structural classification | ⏳ needs fresh RDF cookie |
| `dump/pass2-parity.json` | Value-by-value comparison | ⏳ needs fresh RDF cookie |

## Findings so far (random sample, BizRaport side)

Source: `characterize-bizraport.json` (8 random companies, 8 credits).

- **2/8 had no financial data** (new company without filings; foreign branch).
- **2/8 had pre-2018 years** (2017) — the PDF-era gap is real and not only for
  big blue chips.
- Indicator sets vary by layout: 26–36 indicators (fundacja → 36, with
  `zysk_brutto_ze_sprzedazy`, `koszty_sprzedazy_i_zarzadu`).
- `zatrudnienie` present in 4/8, `wynagrodzenia` in 6/8.
- Earliest year across the sample: 2017.

## Known gaps (vs BizRaport)

| Gap | Free path? | Status |
|---|---|---|
| Pre-2018 statements (PDF/scanned) | ✗ | permanent — BizRaport hand-processes |
| MSR/MSSF statements (PDF) | ✗ | permanent |
| Employment/salary extraction (Wprowadzenie + footnotes) | ✓ | to build (needs real XML samples) |
| Bank / special layouts (names + indicator mapping) | ✓ | to build |
| Manual magnitude/format error fixes | ✗ | permanent (small %) |

## Credit ledger (BizRaport)

- Account `***REMOVED***` started at 100, was 81 used.
- 2026-08-22 characterization: −8 → **89 used, 11 left**.
- New accounts will extend the budget for pass 2.

## How to run (when a fresh RDF cookie is available)

```bash
# 1. structural pass (free)
RDF_COOKIE="..." npx tsx tools/rdf-parity/pass1.ts
# 2. parity pass (uses BizRaport credits; LIMIT by budget)
RDF_COOKIE="..." BUDGET=11 npx tsx tools/rdf-parity/pass2.ts
```

Cookie is IP-bound; must be solved from a stable IP (or a fixed VPN endpoint).
`creds.local.json` (gitignored) holds the accounts.
