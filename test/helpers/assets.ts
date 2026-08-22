import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchAsset } from "../../src/web/landing";

export function fsFetchAsset(): FetchAsset {
  return async (path: string) => {
    try {
      return readFileSync(join(process.cwd(), "public", path.replace(/^\//, "")), "utf-8");
    } catch {
      return null;
    }
  };
}
