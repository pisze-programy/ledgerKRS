# RDF scraping — proxy, captcha, solving

How to get past Incapsula on `rdf-przegladarka.ms.gov.pl`, and what runs in
production (CF Worker or VPS).

## 1. The challenge

The site runs Incapsula (Imperva). It is not a standalone hCaptcha:

- A hidden **reese84 sensor** collects device/canvas/timing entropy and posts a
  signed payload; the server then sets the `reese84` cookie.
- If the sensor looks suspicious, Incapsula additionally serves an **hCaptcha**
  widget (`SWCGHOEL=v2`, sitekey `dd6e16a7-…`). Solving it posts
  `g-recaptcha-response` to `/_Incapsula_Resource?SWCGHOEL=v2…` and yields
  `incap_ses_*` + `visid_incap_*`.
- The real "access" cookie is **`reese84`**; `incap_ses_*` alone is not enough
  for the API endpoints.

A generic hCaptcha solver alone does not bypass it. Either run the full
browser (sensor) or use an Imperva-specific solver flow.

## 2. What works

### 2captcha (bought, $3)
- **Imperva method** (`method=incapsula`) **hard-requires a proxy** that
  2captcha's workers can reach — without one it returns `ERROR_BAD_PROXY`.
- Passing a proxy that both we and they can use was the blocker: our local
  `tsproxy` (`127.0.0.1:1080`) is not reachable from their servers.
- The plain **hCaptcha solve** (`method=hcaptcha`, sitekey `dd6e16a7-…`) works
  and returns a token; posting it to the Incapsula endpoint yields
  `incap_ses` + `visid_incap` — but **not `reese84`** (the sensor still has to
  run in a real browser). Without `reese84` the API stays challenged.

2captcha solves the hCaptcha half but not reese84 without a full browser
emulation.

### Playwright (headless Chromium)
- Launch headless Chromium (real browser engine), load the search page from a
  **clean residential/mobile IP**.
- The reese84 sensor **passes without any captcha** and sets `reese84` +
  `incap_ses` + `visid_incap` in ~2-5 s.
- Cost: $0 (no captcha service), only a few MB of page load.


## 3. Proxies / IP sources we tested

| Source | How | Verdict |
|---|---|---|
| Local machine IP | direct | Works for `wrangler dev`/local runs; gets rate-limited after a few solves |
| Phone via Tailscale `tsproxy` | SOCKS `127.0.0.1:1080` | Good; one mobile IP, gets flagged after sustained use → cooldown |
| **Webshare residential** | HTTP proxy `p.webshare.io:80` + username suffix per IP | Many stable residential PL IPs (`USER-PL-1…N`); each solves independently |

Key facts (measured 2026-08-23, seed-probe):
- The phone tunnel is **off** (Tailscale removed). Webshare is used **only to
  solve the small reese84 cookie** — no bulk traffic on Webshare.
- **`search` works cross-IP**: a webshare-solved cookie serves searches from
  the LOCAL IP with zero challenges (measured 720 firms, 0 challenges, one
  cookie). The search traffic is free — it never touches Webshare.
- **`tresc` (XML/PDF) is bound to the solve IP**: a webshare cookie used from
  another IP returns a challenge page. Downloads must come from the solving IP
  (the phone used to be that channel; the local IP also works with retries).
- One cookie solve transfers ~590 KB (the search page load). One search
  request transfers ~6 KB (local IP, free).

## 4. Request fingerprint

To use a solved cookie you must send the same browser-looking headers:
- Chrome UA (`Chrome/123.0.0.0`) + `sec-ch-ua`, `sec-ch-ua-mobile`,
  `sec-ch-ua-platform`.
- Plain `fetch` (undici) **works** — no curl/TLS impersonation needed for this
  site. The Cloudflare-compatible transport is
  `src/sources/rdf/transport.ts`.
- [KNOWN BUG][fixed] A mismatched UA (generic `Mozilla/5.0`) returns 403 even
  with a valid cookie.

## 5. Operational architecture

```
solve (Playwright, clean residential IP)
   → cookie (reese84 + incap_ses + visid_incap)  [IP-bound]
   → RDF fetch transport (Chrome headers + cookie)  [plain fetch]
   → on challenge (HTML/403): re-solve a fresh cookie, continue
```

- Local/dev: solve on the local IP, run `wrangler dev` (cookie from
  `.dev.vars`).
- Production simulation: solve + fetch through the same Webshare residential IP
  (stable, rotating via username suffix), 2captcha on hard challenges.

## 6. Recommendations for production (CF Worker or VPS)

- A bare CF Worker cannot run Playwright, and its egress IPs are datacenter
  (Incapsula flags them fast). Production runs on a VPS (or a companion
  service) that:
  1. runs the Playwright solver,
  2. uses a **residential/mobile proxy pool** (Webshare works; each solve on a
     fresh IP),
  3. feeds fresh cookies to the CF Worker (KV) or does the scraping itself and
     POSTs financials to the API (`POST /ingest/krs/:krs/rdf`).
- Budget-aware: ~10-15 requests/cookie, so batch downloads per solve and
  auto-refresh on challenge.
- 2captcha is a fallback for the hCaptcha half; reese84 needs the
  browser/sensor — Playwright is free.
- Keep the request fingerprint (Chrome headers) stable across all requests.

## 7. Cost summary (verified)

- Playwright solves: **$0** (bandwidth only).
- Webshare residential: 1 GB/mo plan at **$3.5**, shared (0.7 GB left).
  It carries only the cookie solves — small traffic, by design.
- 2captcha: **$2 / 1000 solves**, near-free — use it for hard challenges.
- BizRaport verification credits: ~900/1000 available this month.

## 8. Seed cost (measured by `seed-probe`)

Probe: 720 firms, 1 cookie solve (578 KB), 0 challenges, 0 failures.
Population (verified live on bizraport.pl/katalog-firm): **1 201 570**
organizations total, **609 858** with financial data (`przychody>=0`).

Searches run cross-IP from the local IP → free. The only Webshare cost is the
cookie solves (~590 KB each; one cookie served 720+ firms with 0 challenges).

| Population | cookies (rpc=720) | Webshare GB | Webshare $ | local search | time (paced) |
|---|---|---|---|---|---|
| 1 201 570 (cały katalog) | 1 669 | 0.9 | **$3.2** | 6.8 GB (free) | ~217 h |
| 609 858 (z finansami) | 848 | 0.5 | **$1.6** | 3.5 GB (free) | ~110 h |
| 250 000 (XML-filery est.) | 348 | 0.2 | **$0.7** | 1.4 GB (free) | ~45 h |

The seed is nearly free. The real cost is the XML download phase (`tresc` is
IP-bound) — a separate decision (was the phone; the local IP works with
retries, see section 8 below).

Tooling: `tools/rdf-parity/seed-probe.ts` (batched, logged, resumable, paced)
and `tools/rdf-parity/seed-cost.ts` (cost table).

## Report sections — public data sources (verified)

Beyond RDF, the BizRaport-style report sections are sourced from public
government systems (no paid APIs):

- **Monitor Sądowy**: `wyszukiwarka-msig.ms.gov.pl/api/Monitor/Search` — the
  public MSiG search (no auth/captcha). Query `signatureType=B` (KRS registry
  entries / "wpisy") or `A` (announcements) by `krs`, with `from`/`to` dates;
  detail per id via `/api/Monitor/Detalis?Id=`. Fields map 1:1 to BizRaport
  (numberOfNotice=pozycja, monitorNumber=nr_monitora, chapterName=rozdział,
  textInPosition=treść nagłówka, signatureKRS=sygnatura).
- **Historia / Terminowość**: RDF document metadata (`dataDodania`,
  `dataSporzadzenia`); deadline = balance date + 6 months + 15 days.
- **KRZ**: NOT public via API — `prs.ms.gov.pl` (KRZ) is an SPA behind SSO
  (Keycloak); `krz.ms.gov.pl` hangs. Deferred; Google-indexing of KRZ pages is
  the practical discovery alternative.
- **KRS registry** (`api-krs.ms.gov.pl`): open, no captcha — odpis/bulletin
  used for company data + filing mentions (`dataZlozenia`).
