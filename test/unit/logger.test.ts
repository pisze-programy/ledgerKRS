import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { createLogger } from "../../src/lib/logger";

function makeLogger() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc: BufferEncoding, cb: () => void) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const logger = createLogger("probe", { to: stream });
  return { logger, chunks };
}

describe("createLogger", () => {
  it("writes a timestamped, tagged, leveled line to the given stream", () => {
    const { logger, chunks } = makeLogger();
    logger.info("hello");
    expect(chunks[0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] INFO  \[probe\] hello\n$/);
  });

  it("includes JSON meta when present", () => {
    const { logger, chunks } = makeLogger();
    logger.warn("boom", { krs: "0000000001" });
    expect(chunks[0]).toContain('boom {"krs":"0000000001"}');
  });

  it("emits error lines", () => {
    const { logger, chunks } = makeLogger();
    logger.error("bad");
    expect(chunks[0]).toContain("ERROR [probe] bad");
  });

  it("drops debug lines at the default info level", () => {
    const { logger, chunks } = makeLogger();
    logger.debug("noisy");
    expect(chunks).toHaveLength(0);
  });

  it("child logs carry the parent tag", () => {
    const { logger, chunks } = makeLogger();
    logger.child("batch-1").info("start");
    expect(chunks[0]).toContain("[probe/batch-1] start");
  });
});
