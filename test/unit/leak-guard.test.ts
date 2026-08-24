import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Credential-leak guard. Fails when a real credential (BizRaport email +
 * password, a hardcoded API key, or a password= query literal) is committed
 * to a tracked file. Public data in test fixtures (company emails inside court
 * announcements) is excluded.
 */

const LEAK_FRAGMENTS: string[][] = [
  ["very.intelligent", "technology@gmail.com"],
  ["lushemu786@fommie", "com"],
  ["CbUJNMYKwyElVpZQU9Zudtte"],
  ["c87d3905454750f3791ec0d226c63c8271bd5b70ef4afbeb"],
];
const KNOWN_LEAKS = LEAK_FRAGMENTS.map((parts) => parts.join("."));

function trackedFiles(): string[] {
  return execFileSync("git", ["-c", "core.quotePath=false", "ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function isSkipped(path: string): boolean {
  return (
    path.startsWith("test/fixtures/") ||
    path.startsWith("node_modules/") ||
    path === "package-lock.json" ||
    path.endsWith(".dev.vars") ||
    path.includes("creds.local") ||
    path.endsWith("leak-guard.test.ts")
  );
}

function scan(path: string): string[] {
  if (isSkipped(path)) {
    return [];
  }
  const content = readFileSync(path, "utf8");
  const hits: string[] = [];
  for (const leak of KNOWN_LEAKS) {
    if (content.includes(leak)) {
      hits.push(`${path}: known leaked credential`);
    }
  }
  if (/BIZRAPORT_PASSWORD\s*=\s*"[^"]{6,}"/.test(content)) {
    hits.push(`${path}: BIZRAPORT_PASSWORD literal`);
  }
  if (/[?&]email=[a-z0-9._%+-]+@[a-z0-9.-]+&password=[A-Za-z0-9._-]{6,}/i.test(content)) {
    hits.push(`${path}: email+password in a query string`);
  }
  return hits;
}

describe("credential-leak guard", () => {
  it("no tracked file carries a real credential", () => {
    const hits: string[] = [];
    for (const file of trackedFiles()) {
      hits.push(...scan(file));
    }
    expect(hits).toEqual([]);
  });
});
