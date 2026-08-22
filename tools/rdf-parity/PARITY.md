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
   random sample.
   → `tools/rdf-parity/characterize.ts` → `dump/characterize-bizraport.json`

## Dumps

| Dump | What | Status |
|---|---|---|
| `dump/sample-biuletyn.json` | 200 random KRS from 6 biuletyn days (16k unique) | ✅ |
| `dump/characterize-bizraport.json` | BizRaport coverage on 8 random companies | ✅ |
| `dump/pass1-structural.json` | RDF structural classification (200 companies) | ✅ |
| `dump/pass2-parity.json` | Value-by-value comparison (15 companies) | ✅ |
| `dump/pass1-structural-UNVALIDATED.json` | First (contaminated) run — challenge misread as NO_DOCS | ⚠️ reference only |

## Pass 1 — structural results (200 random companies)

| Status | Count | % |
|---|---|---|
| HAS_XML (parseable e-sprawozdanie) | 148 | **74%** |
| NO_DOCS (no financial documents in RDF) | 48 | 24% |
| XML_UNPARSEABLE (annual doc is PDF / detached sig) | 4 | 2% |

- Layout mix: `Bilans` (legacy) 68, `JednostkaMikro` 42, `JednostkaMala` 28,
  `JednostkaInna` 6, `JednostkaOp` 4.
- Latest-year: 111 companies at 2025, 23 at 2024 (mostly current filings).
- The 4 unparseable are **PDF submitted as the annual statement** (3×) and one
  detached XAdES signature (no inline data) → the real PDF/MSR gap is ~2%.
- **74% of recently-active random companies have free, parseable XML
  statements** — this is the coverage we can match BizRaport on.

## Pass 2 — parity results (15 random companies, 8 comparable)

Account budget was exhausted mid-run (BizRaport `/api/dane` went 78→89 credits,
then the account hit 100/100; 7 of 15 picks returned empty — rate-limit 429s
don't charge but block).

Comparable rows: **544** across 2018–2025.

| Outcome | Count | % |
|---|---|---|
| MATCH (exact) | 383 | **70%** |
| MISMATCH (value differs) | 91 | 17% |
| ONLY_THEIRS (we lack the indicator) | 51 | 9% |
| ONLY_OURS (they lack it) | 19 | 3.5% |

### What mismatches reveal (three real causes)

1. **Per-layout RZiS code alphabets.** Our canonical mapping assumes the
   SFJednostkaInna RZiS (A–L: A=przychody, ..., F=zysk operacyjny, L=zysk
   netto). Other layouts differ:
   - Fundacja/pożytku publicznego (SFPozostale) RZiS runs **A–O**;
     `O` = zysk netto (verified live: 0000617088, O=4045.87 = BizRaport's).
   - JednostkaMala / JednostkaInna variants shift letter meanings
     (e.g. 0000320584: `H`=zysk brutto, `I`=podatek dochodowy, not our F/L).
   → Fix is layout-aware mapping, needs more samples of each layout +
   BizRaport ground truth (new credits). **Deferred.**
2. **Document version / corrections.** Small `przychody` diffs (0.01–0.3%)
   on otherwise-correct companies → we sometimes pick a different document
   than BizRaport's "latest version" (corrections). Fix: resolve the latest
   non-corrected version per period. **Needs more analysis.**
3. **amortyzacja mapping.** `B_VIII` ("w tym: koszty amortyzacji") can be far
   off the `amortyzacja` indicator (0000176134: 31.5M vs 5.2k) — the real
   value often lives in the Wprowadzenie / dodatkowe informacje.
   → part of the full-extract + per-layout work. **Deferred.**

- `ONLY_THEIRS` (9%) is mostly `zatrudnienie`/`wynagrodzenia` — we don't parse
  the Wprowadzenie / footnotes yet (planned).
- `ONLY_OURS` (3.5%) — years/statements we extract that BizRaport omits.

## Parser fixes (found while checking random data)

1. **New 2025 RDF schema** wraps statements in `<Dokument>` (CRD wzor
   2025/08/12); section tags carry a layout suffix (`BilansJednostkaMikro`,
   `RZiSJednostkaInna`, ...). Fixed via prefix matching.
2. **XAdES-wrapped statements** (JPK_SF, `.xml.xades`) put the statement
   inside `<ds:Signature><ds:Object>` which fast-xml-parser renders as an
   array. `findNode` did not recurse into arrays. Fixed.
   Fixture: `test/fixtures/rdf-xades-jpk.xml`.

## Incapsula throttling reality

One cookie survived ~18 fast sequential searches before being challenged.
`pass1.ts` is resilient (challenge detection → 40s backoff → retry, resume,
stop after 3 consecutive challenges). At ~1.5s pacing, 200 companies ran with
**0 challenges** on a fresh cookie. Expect 1–3 captcha re-solves for a 200-pass
on a rotating-VPN IP.

## BizRaport account ledger

- `***REMOVED***`: reached **100/100 credits**
  (89 `/dane`, 11 `/sprawozdania`) on 2026-08-22.
- `pass2.ts` now retries on HTTP 429 (rate limit) with backoff — ready for a
  fresh account.

## How to run (needs a fresh RDF cookie + a fresh BizRaport account)

```bash
# 1. structural pass (free, resumable)
RDF_COOKIE="..." npx tsx tools/rdf-parity/pass1.ts
# 2. parity pass (BizRaport credits; BUDGET = companies to check)
RDF_COOKIE="..." BUDGET=11 npx tsx tools/rdf-parity/pass2.ts
```

`creds.local.json` (gitignored) holds the accounts. Cookie is IP-bound.
