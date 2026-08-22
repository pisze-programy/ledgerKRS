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

## Layout-aware indicator mapping (official MF structures)

The root cause of the RZiS mismatches is that position codes are
section-scoped and layout-specific. The official e-sprawozdanie structures
(which include Polish names in `<xsd:documentation>`) are published in
**CRWDE** (`crd.gov.pl/wzor/{wzor}/schemat.xsd`). We now build dictionaries
directly from them:

- `tools/rdf-parity/build-layout-dicts.ts` — downloads the wzor schema,
  follows its imports, extracts `element name → Polish name` keyed by section.
  Output: `dump/layout-dicts.json` (SFJINZ 709, SFJMAZ 747, SFJMIZ 760,
  SFJOPZ 715, SFBNKZ 591 names).
- `tools/rdf-parity/map-indicators.ts` — matches the canonical indicators
  against the documentation → `dump/layout-indicator-map.json`:
  `suma_bilansowa→Bilans.Aktywa`, `przychody→RZiS.A`,
  `zysk_operacyjny→RZiS.F`, `zysk_brutto→RZiS.I`, `zysk_netto→RZiS.L`,
  `podatek_dochodowy→RZiS.J`, **`amortyzacja→RZiS.B_I`**, and the bank layout
  maps to different codes (`zysk_brutto→RZiS.XX`, `zysk_netto→RZiS.XXIII`).

**Validated** on `rdf-jednostka-inna.xml` and `rdf-xades-jpk.xml` (SFJINZ):
all values correct, and for 0000176134 the fixed `amortyzacja` (RZiS.B_I =
5241.08) **exactly matches BizRaport's** value that previously mismatched by
6000×. The 2025 schema uses `RZiS.B_I` for amortyzacja (not the old `B_VIII`).

Remaining: detect the RZiS variant (kalkulacyjny vs porównawczy, from
`WariantSprawozdania`) — the porównawczy variant reuses the same letters with
different meanings (explains e.g. CONNER's 2025 mismatches). Deferred until a
live pass verifies it.

## Dumps

| Dump | What | Status |
|---|---|---|
| `dump/sample-biuletyn.json` | 200 random KRS from 6 biuletyn days (16k unique) | ✅ |
| `dump/characterize-bizraport.json` | BizRaport coverage on 8 random companies | ✅ |
| `dump/pass1-structural.json` | RDF structural classification (200 companies) | ✅ |
| `dump/pass2-parity.json` | Value-by-value comparison (15 companies) | ✅ |
| `dump/layout-dicts.json` | Official per-layout position dictionaries (CRWDE) | ✅ |
| `dump/layout-indicator-map.json` | Canonical indicator codes per layout | ✅ |
| `dump/pass1-structural-UNVALIDATED.json` | First (contaminated) run | ⚠️ reference only |

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

1. **Per-layout RZiS code alphabets.** The 2025 CRWDE structures split RZiS
   into two variants — `RZiSKalk` (A=przychody, F=zysk ze sprzedaży,
   I=operacyjny, L=brutto, M=podatek) and `RZiSPor` (A=przychody,
   F=operacyjny, I=brutto, J=podatek, L=netto) — but a statement's
   `WariantSprawozdania` does **not** map 1:1 (GOING `Wariant=1` uses the
   `RZiSPor` letters; old-schema companies use yet other letters, e.g.
   CONNER: `H`=brutto, `I`=podatek, `J`=netto).
2. **Document version / corrections.** Small `przychody` diffs (0.01–0.3%)
   on otherwise-correct companies → we sometimes pick a different document
   than BizRaport's "latest version" (corrections). Fix: resolve the latest
   non-corrected version per period. **Needs more analysis.**
3. **amortyzacja mapping.** `B_VIII` ("w tym: koszty amortyzacji") can be far
   off the `amortyzacja` indicator (0000176134: 31.5M vs 5.2k). **Fixed** via
   the CRWDE dict: the 2025 schema puts `amortyzacja` at `RZiS.B_I` — now
   exactly matches BizRaport (5241.08).

### Match rate by schema/layout (after the layout-aware mapping)

| Group | Firms | Rows | Match % |
|---|---|---|---|
| **LEGACY (plain `Bilans`)** | 3 | 271 | **88%** |
| **New schema — JednostkaInna** | 2 | 159 | **93%** |
| New schema — JednostkaOp (poż. publicznego) | 2 | 222 | 40% |
| New schema — JednostkaMala | 2 | 172 | 63% |
| New schema — JednostkaMikro | 2 | 80 | 60% |

Core cases are strong (legacy 88%, new JednostkaInna 93–94%). The remaining
mismatches concentrate in the exotic layouts (JednostkaOp statutory RZiS, and
porównawczy/old-schema variants in Mala/Mikro) — these need per-schema-version
dictionaries or a robust value-chain inference. **Deferred.**

- `ONLY_THEIRS` is mostly `zatrudnienie`/`wynagrodzenia` — we don't parse
  the Wprowadzenie / footnotes yet (planned).
- `ONLY_OURS` — years/statements we extract that BizRaport omits.

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
