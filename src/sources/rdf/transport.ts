const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/**
 * Cloudflare-compatible RDF transport: plain `fetch` (works on Workers/VPS)
 * with the browser header set Incapsula expects. The `reese84`/`incap_ses`
 * cookies come from the caller (solved externally and rotated on challenge).
 */
export function createRdfFetchTransport(cookie: string): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Cookie", cookie);
    headers.set("User-Agent", CHROME_UA);
    headers.set("sec-ch-ua", '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"');
    headers.set("sec-ch-ua-mobile", "?0");
    headers.set("sec-ch-ua-platform", '"macOS"');
    headers.set("Accept", "application/json");
    return fetch(input, { ...init, headers });
  };
}
