# RDF — state of knowledge

Current working knowledge about the RDF (Repozytorium Dokumentów Finansowych)
source, the full pipeline we decoded, the storage model, and the scale numbers.

This document is the single source of truth for anything RDF-related.

## What RDF is

RDF is the Polish Ministry of Justice repository of financial documents.
It holds every financial statement a company files to KRS (annual reports,
auditor opinions, resolutions, etc.). Base URL:
`https://rdf-przegladarka.ms.gov.pl` (SPA, behind Incapsula + hCaptcha).

- Total documents in RDF: ~15M (all types: XML, PDF, signatures).
- e-sprawozdania XML (2018+, XML became mandatory): ~2.5-3M documents
  for ~350-400k filing companies.
- Companies registered in KRS: ~1.36M; only ~350-400k are required to file.

## The full RDF pipeline (solved and verified live)

### 1. KRS encryption (`src/sources/rdf/client.ts`)

The search API requires an encrypted KRS. The portal encrypts it with
AES-128-CBC (double layer) using `crypto.subtle` (works in Workers).

```js
plain  = krs padded to 10 digits
n      = random 16-digit string (hex-free, from a uint32)
inner  = AES-CBC(plain,   key = utf8(n),            iv = utf8(n))
a      = base64(inner)
outer  = AES-CBC(`${a}.${n}`, key = utf8(permKey),  iv = utf8(permKey))
token  = base64(outer)   // 64 chars
permKey = "6a5Qm4W&MkiD=hwo"  // extracted from main-*.js bundle
```

Verified: the search endpoint accepts tokens produced by our `encryptNrKrs`.
Round-trip decrypt test lives in `test/unit/rdf.test.ts`.

### 2. Endpoints (`/services/rdf/przegladarka-dokumentow-finansowych`)

| Endpoint | Method | Purpose |
|---|---|---|
| `dokumenty/wyszukiwanie` | POST | Search documents by encrypted KRS, paginated (`metadaneStronicowania`, `nrKRS`) |
| `dokumenty/{id}` | GET | Document metadata (type, filename, allowed extensions, periods, KRS, signers) |
| `dokumenty/{id}/tresc?bezPodpisu=false` | GET | The native file — e-sprawozdanie XML for annual statements, PDF otherwise |
| `dokumenty/szczegolyDokumentu` | POST | Extended details (signers, filenames) |
| `podmioty/wyszukiwanie/dane-podstawowe` | POST | Subject lookup (`{"numerKRS": ...}` → name, legal form, found flag) |

Document types: `rodzaj 18` = "Roczne sprawozdanie finansowe" (XML-capable).
Others: 19 = auditor opinion (PDF), 1/3/4/5/20 = resolutions and filings.
`dopuszczalneRozszerzenia` in metadata decides XML capability
(`isXmlCapable` in the client).

### 3. e-sprawozdanie XML format (`src/sources/rdf/parser.ts`)

Root element is layout-specific (`JednostkaInna`, etc.), namespaces `jin:`/`dtsf:`.
`Naglowek` holds `OkresOd`/`OkresDo` and `KodSprawozdania` with `wersjaSchemy`.

Four statement sections:
- `Bilans` → "Bilans"
- `RZiS` → "Rachunek zysków i strat"
- `ZestZmianWKapitale` → "Zestawienie zmian w kapitale"
- `RachPrzeplywow` → "Rachunek przepływów pieniężnych"

Since the new RDF (23.02.2026, CRD wzor 2025/08/12) the file may be wrapped in
`<Dokument>` (with `<TrescDokumentu>` holding the layout element) and section
tags carry a layout suffix: `BilansJednostkaMikro`, `BilansJednostkaMala`,
`RZiSJednostkaInna`, ... Also, submitted files are often XAdES-signed
(`.xml.xades`, JPK_SF), with the statement inside `<ds:Signature><ds:Object>`
(which fast-xml-parser renders as an array). The parser handles all three:
wrapper, suffixed sections (prefix match), and XAdES object arrays.

Each position is an element like `<jin:Aktywa_A_I_3>` containing
`<dtsf:KwotaA>` (current year) and `<dtsf:KwotaB>` (previous year).
Parents carry both amounts AND children (both must be emitted).
`KwotyPozycji` is structural noise — skipped.

Position names come from `src/sources/rdf/positions.ts` (per-section dictionary,
currently SFJednostkaInna — the layout for sp. z o.o.).

Verified: GOING (KRS 0000588000) → 7 statements (2018-2024), 148 Bilans
positions each; `A` = przychody 133M, `L` = zysk netto -3M, etc.

### 4. Client usage

```ts
const client = createRdfClient({ baseUrl, transport });
await client.searchDocuments(krs);      // raw hits (id, rodzaj, okres)
await client.listXmlStatements(krs);    // hits whose metadata allows XML
await client.downloadXml(id);           // raw XML string or null (PDFs → null)
await client.fetchStatements(krs);      // search + filter + download + parse
```

`transport` is injectable — it must attach cookies/UA for Incapsula.

## Incapsula + captcha (operational, solved)

- The site is behind Incapsula (reese84 sensor + hCaptcha). A plain curl gets a
  challenge. The working flow:
  1. **Solve**: headless Chromium (Playwright) loads the search page; on a
     clean residential/mobile IP the sensor passes and sets `reese84` +
     `incap_ses_*` + `visid_incap_*` — usually **without any captcha**.
  2. **Use**: send requests with the Chrome-123 UA + `sec-ch-ua` headers and
     the cookie (plain `fetch` works — Cloudflare-compatible transport in
     `src/sources/rdf/transport.ts`).
- **Budget**: ~10-15 requests per cookie/IP, then a challenge. Auto-refresh:
  on a challenge (HTML/403) re-solve a fresh cookie and continue. `tresc`
  (XML download) is IP-bound to the solve; `search` works cross-IP.
- **IPs**: local machine IP (for `wrangler dev`), the phone via Tailscale
  `tsproxy` (SOCKS 127.0.0.1:1080), or Webshare residential as fallback.
  Tools that script this live under `tools/rdf-parity/` (pw-solver,
  build-corpus). Production uses the fetch transport + a solved cookie from
  config (`RDF_COOKIE`); the cookie is rotated by an operator/solver service.
- [KNOWN BUG][fixed] `reese84` worked with plain `fetch` only after sending
  the matching Chrome headers (UA + sec-ch-ua); mismatched UA → 403.

## Well-known bugs & quirks

See `tools/rdf-parity/PARITY.md` → "Well-known bugs & quirks" for the full
list with pointers. Summary:
- [KNOWN BUG][fixed] Diacritic matching missed "ł"; phrase matching cut at the
  first "(...)" instead of the trailing formula. Fixed in `rzis/matching.ts`.
- [KNOWN BUG][fixed] RZiS role scan stopped at letter P (consolidated goes to W);
  podatek letter must only exist in the dict, not be filled. Fixed.
- [KNOWN BUG][fixed] Detached XAdES (statement base64 in `ds:Object`).
- [BIZRAPORT QUIRK] rounding to thousands, podatek sign flips, op=A−B on old
  ABCF, messy extraction, mislabelled periods — tracked in `KNOWN_ISSUES`.
- [NOT YET] Insurer layout (SFZURZ) — separate stage.

## Storage model (decided)

**No raw XML. Client wants data, not documents.**

- **R2 = compact position blobs** (full archive, source of truth).
  One blob per statement: layout id + `wersjaSchemy` + all positions
  (code, kwota, kwota_poprzedni_rok) — ~2-4 KB vs ~250 KB XML.
  Full set ≈ 4-8 GB → fits R2 free tier (10 GB) on the $5/mo plan.
- **D1 = bounded cache** of computed indicators (per year) for served/queried
  companies (LRU/evictable), plus registry + catalog as today.
- **Cold path**: firm not in D1 → read blob from R2 → compute indicators →
  cache to D1.
- Total additional cost on the $5/mo Workers Paid plan: **$0**
  (R2 10 GB, D1 10 GB, 10M Workers req/mo, R2 ops — all included).

### Field coverage / schema evolution

- The blob should be a **full generic extraction** of the whole XML (all
  sections, all positions — even unknown ones, header, wprowadzenie, additional
  info), not just the known four sections. Then anything present in today's
  XML can be re-derived later.
- Store `wersjaSchemy` per statement so field presence is knowable and old
  years return `null` deliberately.
- Only fields that the ministry adds to a *future* XML schema version will be
  null for old years — an inherent property of the source data, not our model.
  The only way around it is keeping raw XML (rejected).
- Position-name dictionary grows as new codes appear; old names stay.

## Scale numbers

| Item | Value |
|---|---|
| Companies required to file | ~350-400k |
| e-sprawozdania XML total | ~2.5-3M |
| Requests per company (filtered, no metadata) | ~8 (1 search + ~7 downloads) |
| Full backfill requests | ~3-3.6M |
| Conservative rate | 2-4 req/s (Incapsula) |
| Full backfill time | 2-4 weeks continuous; 1.5-3 mo at 8h/day |
| With 2 stable IPs + measured rate | ~1 week |
| Raw data volume | ~750 GB (XML) → ~4-8 GB (blobs) |
| Weekly incremental | ~7k new XML (peak ~20k in Q2) → 1-2 h/week |

Enumeration of the full company set is free: KRS OpenAPI biuletyn (~3k unique
KRS/day, no Incapsula) — iterate history to find filers.

## Backfill acceleration levers

1. Measure the real tolerated Incapsula rate in Faza 0 (may be 10-20 req/s).
2. Parallelize over 2-3 stable IPs, each with its own solved cookie → ÷N time.
3. Skip metadata calls; download `/tresc` and keep only XML (the `<?xml` check).
4. Filter search hits by annual-statement type to avoid PDF downloads.
5. KRS biuletyn drives enumeration (free, outside Incapsula).

## Note on an "RDF API key"

There is no official bulk/API key for RDF. It is a public portal; the ministry
does not offer keyed bulk access (unlike GUS REGON WS-API or CEIDG). The
bottleneck is Incapsula throttling + volume, not credentials. If a formal
access path ever appears, the client just swaps the `transport`.

## Phases

- **Faza 0** — relay on the local machine + `POST /ingest/rdf` endpoint,
  48 firms (BizRaport list) from RDF, measure rate/IP behavior.
- **Faza 1** — top ~10-20k firms (D1 fits).
- **Faza 2** — full set (~380k firms) → R2 blob archive + D1 cache.

## JednostkaOp (pożytku publicznego) RZiS

- **New 2025 schema (SFJOPZ)** is covered by the CRWDE dict path: the
  `RZiSKalk` variant uses `A`=przychody, `F`=zysk ze sprzedaży (C–D–E),
  `I`=operacyjny (F+G–H), `L`=brutto, `M`=podatek, `O`=netto.
- **Old-schema Op** statements (e.g. 0000278980) use a different letter
  alphabet (its `H`=zysk operacyjny, `M`/`O`=zysk netto, and `F`≠C–D–E) that
  matches neither the 2025 `RZiSKalk`/`RZiSPor` dicts nor the value-chain
  heuristic. Needs the pre-2025 pożytku-publicznego schema dictionary.
  **Deferred** (per-version dictionary work).

## Employment and wages (zatrudnienie / wynagrodzenia)

Investigated live on JERONIMO (0000222483, SFJINZ wariant 2, kalkulacyjny):
the statement has **no** employment or total-wages field — not in the
Wprowadzenie, not in the RZiS (by function), only a footnote mention
("Koszty niezrealizowanych wynagrodzeń i składek"). BizRaport's
`zatrudnienie` (85204) and `wynagrodzenia` (7.7B) therefore come from
footnote text mining or estimation (they also expose
`zatrudnienie_estymowane`). This is a genuine remaining gap: our parser
would need to mine the free-text `DodatkoweInformacjeIObjasnienia` section,
or estimate employment from wages. **Deferred** (separate, harder workstream).

## Parity with BizRaport (random-sample verification)

Goal: match BizRaport coverage with the free RDF pipeline, verified on a
**random** sample (not hand-picked KRS) — see `tools/rdf-parity/PARITY.md`.

Results so far (200 random companies from the KRS biuletyn):

- **Pass 1 (structural, free):** 74% have parseable e-sprawozdanie XML
  (`HAS_XML`), 24% no financial documents, 2% PDF-as-annual (the real PDF gap).
  Layouts: legacy `Bilans` 68, `JednostkaMikro` 42, `JednostkaMala` 28,
  `JednostkaInna` 6, `JednostkaOp` 4.
- **Pass 2 (parity, 15 companies):** 544 comparable rows across 2018–2025,
  **70% exact match**, 17% mismatch, 9% only-BizRaport, 3.5% only-ours.
  Mismatches trace to (1) per-layout RZiS code alphabets (SFPozostale runs
  A–O; other layouts shift letter meanings) — layout-aware mapping deferred,
  (2) document version / corrections, (3) `amortyzacja` from the wrong
  section. `ONLY_THEIRS` is mostly employment/salary (Wprowadzenie parse,
  planned).
- **Live parity with the production pipeline (src modules): 84% exact match**
  (1774 rows, 15 random companies, 2018–2025). Per layout: LEGACY 88%,
  JednostkaInna 85%, JednostkaMala 89%, **JednostkaMikro 93%**, JednostkaOp
  72%. The universal RZiS value-chain inference fixed the porównawczy /
  old-schema cases (Mikro 60→93%, Mala 63→89%). Remaining mismatches are
  definitional (BizRaport's revenue/cost line choices, ~0.5–1%) and the
  JednostkaOp statutory RZiS.
- Parser fixes found while checking random data: new 2025 `<Dokument>` wrapper
  (suffixed section tags) and XAdES/JPK_SF object arrays — both fixed + tested.
- BizRaport account reached 100/100 credits; new accounts pending for the
  layout-aware parity rerun.

## Implemented so far (commits)

- `src/sources/rdf/client.ts` — encryption, search, metadata, download, client.
- `src/sources/rdf/parser.ts` — real-format parser (sections, KwotaA/KwotaB,
  PL section labels, parent+child positions, `KwotyPozycji` skip).
- `src/sources/rdf/positions.ts` — SFJednostkaInna position-name dictionary.
- `test/fixtures/rdf-jednostka-inna.xml` — real GOING 2024 statement.
- `test/unit/rdf.test.ts`, `rdf.parser.test.ts`, `rdf.parity.test.ts` — 182
  tests pass overall.
- RDF client is NOT yet wired into the API/deps (transport/relay pending).
