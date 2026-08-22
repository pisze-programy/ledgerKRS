import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { fetchBizraportDane, summarize } from "./bizraport";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");

async function main() {
  const creds = loadCreds();
  if (!creds.bizraportEmail || !creds.bizraportPassword) {
    throw new Error("BizRaport creds required");
  }
  const sample = JSON.parse(readFileSync(join(DUMP, "sample-biuletyn.json"), "utf8")) as {
    sample: { krs: string }[];
  };
  const budget = Number(process.env.BUDGET ?? 8);
  const picked = sample.sample.slice(0, budget);

  const perCompany: Record<string, unknown> = {};
  for (const { krs } of picked) {
    const c = await fetchBizraportDane(creds, krs);
    perCompany[krs] = c ? summarize(c) : { krs, brak_danych: true };
    console.log(JSON.stringify(perCompany[krs]));
    await new Promise((r) => setTimeout(r, 500));
  }

  const companies = Object.values(perCompany).filter((v) => !(v as { brak_danych?: boolean }).brak_danych) as Record<string, unknown>[];
  const withPre2018 = companies.filter((c) => c.ma_pre2018).length;
  const withEmployment = companies.filter((c) => c.ma_zatrudnienie).length;
  const withSalary = companies.filter((c) => c.ma_wynagrodzenia).length;
  const yearSets = companies.map((c) => c.lata as number[]);
  const minFirst = Math.min(...yearSets.flat().filter((y) => y < 2026), 2026);

  const report = {
    generated_at: new Date().toISOString(),
    budget,
    with_data: companies.length,
    with_pre2018: withPre2018,
    with_employment: withEmployment,
    with_salary: withSalary,
    earliest_year: minFirst,
    per_company: perCompany,
  };
  mkdirSync(DUMP, { recursive: true });
  writeFileSync(join(DUMP, "characterize-bizraport.json"), JSON.stringify(report, null, 2));
  console.log("SUMMARY:", JSON.stringify({ with_data: companies.length, with_pre2018: withPre2018, with_employment: withEmployment, with_salary: withSalary, earliest_year: minFirst }));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
