# Data sources

Two public Polish government sources feed the report. Own calculations fill the rest. No paid APIs.

## RDF — financial statements

- `rdf-przegladarka.ms.gov.pl`
- Annual financial statements (e-sprawozdanie XML) and filing dates (`dataDodania`, `dataSporzadzenia`).
- Requires an Incapsula cookie. See `rdf-scraping-infra.md` and `rdf-state-of-knowledge.md`.

## MSiG — Monitor Sądowy i Gospodarczy

- `wyszukiwarka-msig.ms.gov.pl`
- Monitor announcements: KRS registry entries (`signatureType=B`, "wpisy do rejestru") and announcements (`signatureType=A`).
- API: `GET /api/Monitor/Search` by `krs`; detail `GET /api/Monitor/Detalis?Id=`. Code: `src/sources/msig/client.ts`.

## KRS API

- `api-krs.ms.gov.pl`, open, no captcha.
- Company registry data: `OdpisAktualny`, `Biuletyn`, filing mentions (`dataZlozenia`).

## KRZ

- Not implemented. Portal `prs.ms.gov.pl` requires SSO. See `08-whats-left.md`.

## Links

- Scraping, captcha, proxy: `rdf-scraping-infra.md`
- RDF pipeline details: `rdf-state-of-knowledge.md`
- Pipeline: `05-pipeline.md`
- Parity and per-section sources: `tools/rdf-parity/PARITY.md`
