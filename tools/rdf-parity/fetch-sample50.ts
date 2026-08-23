import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const SAMPLE: string[] = JSON.parse(readFileSync("/tmp/sample50-v2.json", "utf8"));
const KEY = process.env.API_KEY ?? "***REMOVED***";
const MODE = process.argv[2] ?? "our"; // our | biz
const BASE = MODE === "our" ? "http://localhost:8787/api/dane" : "https://api.bizraport.pl/api/dane";
mkdirSync(MODE === "our" ? "/tmp/our" : "/tmp/biz", { recursive: true });
(async () => {
  let ok = 0;
  for (const krs of SAMPLE) {
    const out = `/tmp/${MODE === "our" ? "our" : "biz"}/${krs}.json`;
    const url = MODE === "our"
      ? `${BASE}?krs=${krs}`
      : `${BASE}?email=***REMOVED***&password=h6qcldX2Hre1nvSDBJD4DUSD&krs=${krs}`;
    const r = await fetch(url, { headers: MODE === "our" ? { "x-api-key": KEY } : {} });
    const text = await r.text();
    writeFileSync(out, text);
    const okFlag = MODE === "our" ? text.includes('"data"') && !text.includes('"data":[]') : text.includes('"data"');
    if (okFlag) ok += 1;
    console.log(`${krs}: ${r.status} ${text.length}B ${okFlag ? "OK" : "empty"}`);
  }
  console.log(`${MODE}: ${ok}/${SAMPLE.length}`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
