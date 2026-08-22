import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { encryptNrKrs, isXmlCapable } from "../../src/sources/rdf/client";

const FIXTURE = path.join(__dirname, "..", "fixtures", "rdf-jednostka-inna.xml");

describe("parseSprawozdanie (e-sprawozdanie XML)", () => {
  it("parses sections and positions from the native RDF XML", () => {
    const xml = fs.readFileSync(FIXTURE, "utf8");
    const statement = parseSprawozdanie(xml);
    expect(statement).not.toBeNull();
    expect(statement!.okres_sprawozdawczy).toBe("2024-01-01_2024-12-31");
    expect(statement!.rok).toBe(2024);

    const bilans = statement!.sekcje.find((s) => s.sekcja === "Bilans");
    const rzis = statement!.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
    expect(bilans).toBeDefined();
    expect(rzis).toBeDefined();
    expect(bilans!.pozycje.length).toBeGreaterThan(140);
    expect(rzis!.pozycje.length).toBeGreaterThan(50);
  });

  it("extracts key indicator positions with names and amounts", () => {
    const xml = fs.readFileSync(FIXTURE, "utf8");
    const statement = parseSprawozdanie(xml)!;
    const byCode = new Map(statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat")!.pozycje.map((p) => [p.kod_pozycji, p]));

    expect(byCode.get("A")?.kwota).toBe(133252762.98);
    expect(byCode.get("A")?.nazwa_pozycji).toContain("Przychody");
    expect(byCode.get("L")?.kwota).toBe(-3014231.1);
    expect(byCode.get("L")?.nazwa_pozycji).toContain("Zysk (strata) netto");
    expect(byCode.get("F")?.kwota).toBe(-2078243.8);
  });

  it("keeps parent positions that carry both amounts and children", () => {
    const xml = fs.readFileSync(FIXTURE, "utf8");
    const statement = parseSprawozdanie(xml)!;
    const bilans = statement.sekcje.find((s) => s.sekcja === "Bilans")!;
    const aktywa = bilans.pozycje.find((p) => p.kod_pozycji === "Aktywa");
    const aktywaA = bilans.pozycje.find((p) => p.kod_pozycji === "Aktywa_A");
    expect(aktywa?.kwota).toBe(16855641.66);
    expect(aktywa?.kwota_poprzedni_rok).toBe(9612272.55);
    expect(aktywaA?.kwota).toBe(6193945.41);
  });
});

describe("encryptNrKrs", () => {
  it("produces a token decryptable back to the KRS with the perm key", async () => {
    const krs = "0000588000";
    const token = await encryptNrKrs(krs);
    expect(token).toHaveLength(64);

    const permKey = new TextEncoder().encode("6a5Qm4W&MkiD=hwo");
    const key = await crypto.subtle.importKey("raw", permKey, { name: "AES-CBC" }, false, ["decrypt"]);
    const outer = new Uint8Array(Uint8Array.from(atob(token), (c) => c.charCodeAt(0)));
    const inner = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: permKey }, key, outer));
    const [a, n] = new TextDecoder().decode(inner).split(".");
    expect(n!).toMatch(/^\d{16}$/);
    expect(a!).toHaveLength(24);

    const innerKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(n!), { name: "AES-CBC" }, false, ["decrypt"]);
    const innerIv = new TextEncoder().encode(n!);
    const cipher = new Uint8Array(Uint8Array.from(atob(a!), (c) => c.charCodeAt(0)));
    const plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-CBC", iv: innerIv }, innerKey, cipher));
    expect(plain).toBe(krs);
  });

  it("pads short KRS numbers to 10 digits", async () => {
    const token = await encryptNrKrs("588000");
    expect(token).toHaveLength(64);
  });
});

describe("isXmlCapable", () => {
  it("detects XML-capable document types", () => {
    expect(isXmlCapable({ rodzajDokumentu: { dopuszczalneRozszerzenia: ".XML, .PDF" } })).toBe(true);
    expect(isXmlCapable({ rodzajDokumentu: { dopuszczalneRozszerzenia: ".PDF, .JPG" } })).toBe(false);
    expect(isXmlCapable({})).toBe(false);
  });
});
