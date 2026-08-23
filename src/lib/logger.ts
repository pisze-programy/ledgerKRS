/**
 * Structured stderr logger for tools and pipeline modules.
 * Every line has a timestamp, a level, and a component tag so that long
 * batches remain observable and swallowed try/catch blocks are never silent.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  child(tag: string): Logger;
}

export function createLogger(tag: string, options: { level?: LogLevel; to?: NodeJS.WritableStream } = {}): Logger {
  const minLevel = LEVEL_ORDER[options.level ?? "info"];
  const stream = options.to ?? process.stderr;

  function write(level: LogLevel, message: string, meta: unknown): void {
    if (LEVEL_ORDER[level] < minLevel) {
      return;
    }
    const time = new Date().toISOString().slice(11, 23);
    const metaPart = meta === undefined ? "" : ` ${JSON.stringify(meta)}`;
    stream.write(`[${time}] ${level.toUpperCase().padEnd(5)} [${tag}] ${message}${metaPart}\n`);
  }

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
    child: (childTag) => createLogger(`${tag}/${childTag}`, { level: options.level, to: stream }),
  };
}
