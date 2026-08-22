export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function httpGetJson(url: string, options: HttpOptions = {}): Promise<unknown> {
  const response = await httpGet(url, options);
  return response.json();
}

export async function httpGetText(url: string, options: HttpOptions = {}): Promise<string> {
  const response = await httpGet(url, options);
  return response.text();
}

export async function httpGet(url: string, options: HttpOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: options.signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
