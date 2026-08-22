import { parseSprawozdanie, type ParsedStatement } from "./parser";

export interface RdfClientOptions {
  baseUrl: string;
  transport: (krs: string) => Promise<string>;
}

export interface RdfDocument {
  krs: string;
  statements: ParsedStatement[];
}

export function createRdfClient(options: RdfClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  return {
    async fetchStatements(krs: string): Promise<RdfDocument> {
      const xml = await options.transport(`${baseUrl}/${krs}`);
      const statement = parseSprawozdanie(xml);
      return { krs, statements: statement ? [statement] : [] };
    },
  };
}
