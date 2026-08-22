import type { RegonEntry } from "./client";

export type RegonMockVariant = "jdc_micro" | "jdc_medium" | "jdc_large" | "no_data" | "error";

export function pickVariant(nip: string): RegonMockVariant {
  const last = Number(nip.slice(-1));
  if (last === 0 || last === 1) {
    return "error";
  }
  if (last === 9) {
    return "no_data";
  }
  if (last <= 4) {
    return "jdc_micro";
  }
  if (last <= 7) {
    return "jdc_medium";
  }
  return "jdc_large";
}

export function mockRegonEntries(nip: string): RegonEntry[] {
  const variant = pickVariant(nip);
  switch (variant) {
    case "error":
      throw new Error("REGON mock: usługa niedostępna");
    case "no_data":
      return [];
    case "jdc_micro":
      return [micro(nip)];
    case "jdc_medium":
      return [medium(nip)];
    case "jdc_large":
      return [large(nip)];
  }
}

export function mockRegonXml(nip: string): string {
  const variant = pickVariant(nip);
  if (variant === "no_data") {
    return "<dane></dane>";
  }
  if (variant === "error") {
    throw new Error("REGON mock: usługa niedostępna");
  }
  const entry = mockRegonEntries(nip)[0]!;
  return [
    "<dane>",
    `  <Regon>${entry.regon}</Regon>`,
    `  <Nip>${entry.nip}</Nip>`,
    `  <Nazwa>${entry.name}</Nazwa>`,
    `  <Status>${entry.status}</Status>`,
    "</dane>",
  ].join("\n");
}

function micro(nip: string): RegonEntry {
  return {
    regon: `38${nip.slice(0, 7)}0000000`,
    name: `JAN KOWALSKI ${nip.slice(-4)}`,
    nip,
    status: "fizyczna osoba prowadząca działalność",
  };
}

function medium(nip: string): RegonEntry {
  return {
    regon: `52${nip.slice(0, 7)}0000000`,
    name: `PRZEDSIĘBIORSTWO USŁUGOWO-HANDLOWE ${nip.slice(-3)}`,
    nip,
    status: "osoba fizyczna prowadząca działalność gospodarczą",
  };
}

function large(nip: string): RegonEntry {
  return {
    regon: `63${nip.slice(0, 7)}0000000`,
    name: `ZAKŁAD PRODUKCYJNO-USŁUGOWY ${nip.slice(-3)} SP. Z O.O.`,
    nip,
    status: "spółka z ograniczoną odpowiedzialnością",
  };
}
