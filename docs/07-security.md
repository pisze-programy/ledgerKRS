# 07 — Security rules

This document explains the security rules.
We learned most of them from BizRaport.
We must follow them.

## Rules for API keys

- Never put credentials in the URL.
- Use an `Authorization` header.
- Use scoped API keys.
- Rotate keys. Revoke keys.

BizRaport put email and password in the URL.
Do not copy this.

## Rules for the API

- Add rate limits.
- Add pagination.
- Never return 1 million rows in one call.
- Count only successful calls for billing.

## Rules for the paywall

- Do not send paid data to anonymous users.
- Do not hide data with a blur.
- Send a preview to anonymous users.
- Send full data only to paid users.

BizRaport put full report data in the HTML.
The paywall was only a blur.
Do not copy this.

## Rules for data

- The data is public. We still treat it with care.
- Person data in KRS is masked. Keep it masked.
- Follow the GDPR rules.
- Store only what you need.

## Rules for the code

- No comments in the code.
- Keep functions small.
- Decompose and reuse.
- Test everything.

## Rules for deployment

- The local API has no authentication.
- Add authentication before production.
- Add security headers at the edge.
- Add HSTS, nosniff, and CSP.
