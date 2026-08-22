const DEFAULT_DELAY_MS = 200;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF = 2;

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const backoff = options.backoff ?? DEFAULT_BACKOFF;
  const shouldRetry = options.shouldRetry ?? isRetryable;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts || !shouldRetry(error)) {
        break;
      }
      await sleep(delayMs * Math.pow(backoff, attempt));
    }
  }
  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && "status" in error) {
    const status = (error as { status?: number }).status ?? 0;
    return status >= 500 || status === 429;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
