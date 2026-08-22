export class SourceError extends Error {
  readonly source: string;
  readonly status?: number;

  constructor(source: string, message: string, status?: number) {
    super(message);
    this.name = "SourceError";
    this.source = source;
    this.status = status;
  }
}

export function isSourceError(error: unknown): error is SourceError {
  return error instanceof SourceError;
}
