import { API_EXAMPLES } from "../api/contract";

type Lang = "pl" | "en";

interface EndpointRef {
  id: string;
  path: string;
  method: "get" | "post";
}

const ENDPOINTS: EndpointRef[] = [
  { id: "account", path: "/api/account", method: "post" },
  { id: "dane", path: "/api/dane", method: "get" },
  { id: "sprawozdania", path: "/api/sprawozdania", method: "get" },
  { id: "katalog", path: "/api/katalog", method: "get" },
  { id: "szukaj", path: "/api/szukaj", method: "get" },
  { id: "branze", path: "/api/branze", method: "get" },
  { id: "pkd", path: "/api/pkd/{code}", method: "get" },
  { id: "raport", path: "/api/raport", method: "get" },
  { id: "balance", path: "/api/balance", method: "get" },
  { id: "zuzycie", path: "/api/zuzycie", method: "get" },
];

interface FieldRow {
  name: string;
  type: string;
  desc: string;
}

interface ParamRow extends FieldRow {
  required: boolean;
}

export function renderApiSection(doc: Record<string, unknown>, lang: Lang, origin: string): string {
  const paths = (doc.paths ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  const labels = labelsFor(lang);
  const items = ENDPOINTS.map((endpoint) => {
    const operation = paths[endpoint.path]?.[endpoint.method] ?? {};
    const summary = (operation.description as string) ?? endpoint.path;
    const params = extractParams(operation);
    const responseSchema = response200Schema(operation, doc);
    const responseFields = responseSchema ? fieldRows(resolveRef(responseSchema, doc), doc) : [];
    const examples = API_EXAMPLES[endpoint.id];
    const request = examples ? examples.request.replaceAll("{{BASE}}", origin) : "";
    const response = examples ? examples.response : "";
    return renderItem(endpoint.path, summary, params, request, response, responseFields, labels);
  }).join("\n      ");

  return `<section data-accent="blue" class="api" id="api">
  <div class="container">
    <p class="kicker reveal">REST API</p>
    <h2 class="reveal d1">${labels.headline}</h2>
    <p class="lead reveal d2">${labels.lead}</p>
    <div class="api-list reveal d3">
      ${items}
    </div>
  </div>
</section>`;
}

function renderItem(
  path: string,
  summary: string,
  params: ParamRow[],
  request: string,
  response: string,
  responseFields: FieldRow[],
  labels: ReturnType<typeof labelsFor>,
): string {
  const paramsHtml =
    params.length === 0
      ? `<p class="api-none">${labels.noParams}</p>`
      : `<table class="api-params">
        <thead><tr><th>${labels.pole}</th><th>${labels.typ}</th><th>${labels.opis}</th><th>${labels.wymagane}</th></tr></thead>
        <tbody>${params.map((row) => `<tr><td class="mono">${row.name}</td><td>${row.type}</td><td>${row.desc}</td><td>${row.required ? labels.tak : labels.nie}</td></tr>`).join("")}</tbody>
      </table>`;
  const fieldsHtml =
    responseFields.length === 0
      ? `<p class="api-none">${labels.noFields}</p>`
      : `<table class="api-params">
        <thead><tr><th>${labels.pole}</th><th>${labels.typ}</th><th>${labels.opis}</th></tr></thead>
        <tbody>${responseFields.map((row) => `<tr><td class="mono">${row.name}</td><td>${row.type}</td><td>${row.desc}</td></tr>`).join("")}</tbody>
      </table>`;
  return `<div class="api-item">
        <button class="api-q" aria-expanded="false"><span class="api-path mono">${path}</span><span class="api-desc">${summary}</span><i>+</i></button>
        <div class="api-a">
          <h4 class="api-sub">${labels.params}</h4>
          ${paramsHtml}
          <h4 class="api-sub">${labels.request}</h4>
          <pre><code>${request}</code></pre>
          <h4 class="api-sub">${labels.responseSchema}</h4>
          ${fieldsHtml}
          <h4 class="api-sub">${labels.responseExample}</h4>
          <pre><code>${response}</code></pre>
        </div>
      </div>`;
}

function extractParams(operation: Record<string, unknown>): ParamRow[] {
  const rows: ParamRow[] = [];
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  for (const param of parameters as Record<string, unknown>[]) {
    rows.push({
      name: String(param.name ?? ""),
      type: typeOf((param.schema as Record<string, unknown>) ?? {}),
      desc: String(param.description ?? ""),
      required: param.required === true,
    });
  }
  const body = (operation.requestBody as Record<string, unknown> | undefined)?.content as
    | Record<string, { schema?: Record<string, unknown> }>
    | undefined;
  const bodySchema = body?.["application/json"]?.schema;
  if (bodySchema) {
    const props = (bodySchema.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const [name, prop] of Object.entries(props)) {
      rows.push({
        name,
        type: typeOf(prop),
        desc: String(prop.description ?? ""),
        required: Array.isArray(bodySchema.required) && bodySchema.required.includes(name),
      });
    }
  }
  return rows;
}

function response200Schema(operation: Record<string, unknown>, doc: Record<string, unknown>): unknown {
  const responses = (operation.responses ?? {}) as Record<string, Record<string, unknown>>;
  const content = (responses["200"]?.content ?? {}) as Record<string, { schema?: unknown }>;
  const schema = content["application/json"]?.schema;
  return schema ? resolveRef(schema, doc) : undefined;
}

function resolveRef(schema: unknown, doc: Record<string, unknown>): Record<string, unknown> {
  if (schema && typeof schema === "object" && "$ref" in schema) {
    const ref = (schema as { $ref: string }).$ref;
    const name = ref.split("/").pop() ?? "";
    const schemas = (doc.components as Record<string, unknown> | undefined)?.schemas as Record<string, unknown> | undefined;
    if (schemas?.[name]) {
      return resolveRef(schemas[name], doc);
    }
  }
  const record = (schema as Record<string, unknown>) ?? {};
  if (Array.isArray(record.allOf)) {
    const merged: Record<string, unknown> = { type: "object", properties: {} };
    for (const part of record.allOf) {
      const resolved = resolveRef(part, doc);
      if (resolved.type === "object") {
        merged.type = "object";
      }
      Object.assign(merged.properties as Record<string, unknown>, resolved.properties ?? {});
    }
    return merged;
  }
  return record;
}

function fieldRows(schema: Record<string, unknown>, doc: Record<string, unknown>): FieldRow[] {
  const resolved = resolveRef(schema, doc);
  if (resolved.type !== "object" || !resolved.properties || typeof resolved.properties !== "object") {
    return [];
  }
  const rows: FieldRow[] = [];
  for (const [name, propRaw] of Object.entries(resolved.properties as Record<string, unknown>)) {
    const prop = resolveRef(propRaw, doc);
    if (prop.type === "array") {
      const item = resolveRef(prop.items as Record<string, unknown>, doc);
      if (item.type === "object" && item.properties && typeof item.properties === "object") {
        for (const [child, childRaw] of Object.entries(item.properties as Record<string, unknown>)) {
          const childProp = resolveRef(childRaw, doc);
          rows.push({ name: child, type: typeOf(childProp), desc: String(childProp.description ?? "") });
        }
        continue;
      }
      rows.push({ name, type: typeOf(prop), desc: String(prop.description ?? "") });
      continue;
    }
    rows.push({ name, type: typeOf(prop), desc: String(prop.description ?? "") });
  }
  return rows;
}

function typeOf(schema: Record<string, unknown>): string {
  if (schema.type === "array") {
    const items = (schema.items as Record<string, unknown>) ?? {};
    return `${typeOf(items)}[]`;
  }
  if (schema.enum) {
    return "enum";
  }
  return String(schema.type ?? "any");
}

function labelsFor(lang: Lang) {
  return lang === "en"
    ? {
        headline: "Business data as an endpoint.",
        lead: "GET + JSON. No SDK, no OAuth. One endpoint, one credit. Expand an endpoint to see parameters, request and response.",
        params: "Parameters",
        request: "Request",
        responseSchema: "Response — schema",
        responseExample: "Response example",
        pole: "Field",
        typ: "Type",
        opis: "Description",
        wymagane: "Required",
        tak: "yes",
        nie: "no",
        noParams: "No parameters.",
        noFields: "No fields.",
      }
    : {
        headline: "Dane gospodarcze jako endpoint.",
        lead: "GET + JSON. Bez SDK, bez OAuth. Jeden endpoint, jeden kredyt. Rozwiń endpoint, żeby zobaczyć parametry, request i response.",
        params: "Parametry",
        request: "Request",
        responseSchema: "Response — schema",
        responseExample: "Przykład odpowiedzi",
        pole: "Pole",
        typ: "Typ",
        opis: "Opis",
        wymagane: "Wymagane",
        tak: "tak",
        nie: "nie",
        noParams: "Brak parametrów.",
        noFields: "Brak pól.",
      };
}
