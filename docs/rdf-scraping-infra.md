# RDF scraping infrastructure — proxy, captcha, solving (findings)

Simple English, practical. Covers what we discovered about getting past
Incapsula on `rdf-przegladarka.ms.gov.pl` and what it means for production
(CF Worker or VPS).

## 1. What the challenge actually is

The site is behind **Incapsula (Imperva)**. It is **not** a standalone
hCaptcha:

- A hidden **reese84 sensor** collects device/canvas/timing entropy and posts a
  signed payload; the server then sets the `reese84` cookie.
- If the sensor looks suspicious, Incapsula additionally serves an **hCaptcha**
  widget (`SWCGHOEL=v2`, sitekey `dd6e16a7-…`). Solving it posts
  `g-recaptcha-response` to `/_Incapsula_Resource?SWCGHOEL=v2…` and yields
  `incap_ses_*` + `visid_incap_*`.
- The real "access" cookie is **`reese84`**; `incap_ses_*` alone is not enough
  for the API endpoints.

Conclusion: a generic hCaptcha solver alone does **not** bypass it. You need
either the full browser (sensor) or an Imperva-specific solver flow.

## 2. What we tried and what worked

### 2captcha (bought, $3)
- **Imperva method** (`method=incapsula`) **hard-requires a proxy** that
  2captcha's workers can reach — without one it returns `ERROR_BAD_PROXY`.
- Passing a proxy that both we and they can use was the blocker: our local
  `tsproxy` (`127.0.0.1:1080`) is not reachable from their servers.
- The plain **hCaptcha solve** (`method=hcaptcha`, sitekey `dd6e16a7-…`) works
  and returns a token; posting it to the Incapsula endpoint yields
  `incap_ses` + `visid_incap` — but **not `reese84`** (the sensor still has to
  run in a real browser). Without `reese84` the API stays challenged.

Conclusion: 2captcha works for the hCaptcha half, but not for reese84 without
a full browser emulation. **Not the primary path.**

### Playwright (headless Chromium) — the winner
- Launch headless Chromium (real browser engine), load the search page from a
  **clean residential/mobile IP**.
- The reese84 sensor **passes without any captcha** and sets `reese84` +
  `incap_ses` + `visid_incap` in ~2-5 s.
- Cost: $0 (no captcha service), only a few MB of page load.

This is the solving mechanism used in production tooling.

## 3. Proxies / IP sources we tested

| Source | How | Verdict |
|---|---|---|
| Local machine IP | direct | Works for `wrangler dev`/local runs; gets rate-limited after a few solves |
| Phone via Tailscale `tsproxy` | SOCKS `127.0.0.1:1080` | Good; one mobile IP, gets flagged after sustained use → cooldown |
| **Webshare residential** | HTTP proxy `p.webshare.io:80` + username suffix per IP | **Best**: many stable residential PL IPs (`USER-PL-1…N`); each solves independently |

Key facts:
- Each cookie/IP has a **budget of ~10-15 requests** before a challenge.
- `search` works **cross-IP**; `tresc` (XML) is **bound to the solve IP**.
- Reusing a cookie on a different IP → challenge.

## 4. Request fingerprint

To use a solved cookie you must send the same browser-looking headers:
- Chrome UA (`Chrome/123.0.0.0`) + `sec-ch-ua`, `sec-ch-ua-mobile`,
  `sec-ch-ua-platform`.
- Plain `fetch` (undici) **works** — no curl/TLS impersonation needed for this
  site. The Cloudflare-compatible transport is
  `src/sources/rdf/transport.ts`.
- [KNOWN BUG][fixed] A mismatched UA (generic `Mozilla/5.0`) returns 403 even
  with a valid cookie.

## 5. Operational architecture (current)

```
solve (Playwright, clean residential IP)
   → cookie (reese84 + incap_ses + visid_incap)  [IP-bound]
   → RDF fetch transport (Chrome headers + cookie)  [plain fetch]
   → on challenge (HTML/403): re-solve a fresh cookie, continue
```

- Local/dev: solve on the local IP, run `wrangler dev` (cookie from
  `.dev.vars`).
- Phone: solve via `tsproxy` (SOCKS) for a phone-bound cookie.
- Webshare: solve + fetch through the same residential IP (stable, rotating
  via username suffix).

## 6. Recommendations for production (CF Worker or VPS)

- **A bare CF Worker cannot run Playwright** and its egress IPs are datacenter
  (Incapsula flags them fast). Realistic production is a **VPS** (or a
  companion service) that:
  1. runs the Playwright solver,
  2. uses a **residential/mobile proxy pool** (Webshare works; each solve on a
     fresh IP),
  3. feeds fresh cookies to the CF Worker (KV) or does the scraping itself and
     POSTs financials to the API (`POST /ingest/krs/:krs/rdf`).
- Budget-aware: ~10-15 requests/cookie, so batch downloads per solve and
  auto-refresh on challenge.
- **2captcha** is a valid **fallback** for the hCaptcha half, but reese84
  needs the browser/sensor — Playwright is simpler and free.
- Keep the request fingerprint (Chrome headers) stable across all requests.

## 7. Cost summary (verified)

- Playwright solves: **$0** (bandwidth only).
- Webshare residential 1 GB: covered the whole corpus (~250 XMLs) with room to
  spare; we used the **phone IP for solves** (0 GB webshare on the bulk).
- 2captcha: $3 account, used only to validate the Imperva/hCaptcha flows.
- BizRaport verification credits: ~1 per company (plenty available).
