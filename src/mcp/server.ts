import { TOOLS, callTool } from "./tools";
import type { ApiDeps } from "../api/deps";

export const PROTOCOL_VERSION = "2025-03-26";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResult {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export async function handleMcpPost(request: Request, deps: ApiDeps, accountId: number): Promise<Response> {
  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "invalid JSON");
  }
  const id = body.id ?? null;
  try {
    return jsonRpcResponse(id, await dispatch(body, deps, accountId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonRpcResponse(id, undefined, { code: -32603, message });
  }
}

export function handleMcpGet(): Response {
  return new Response(
    JSON.stringify({
      protocol_version: PROTOCOL_VERSION,
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
}

async function dispatch(body: JsonRpcRequest, deps: ApiDeps, accountId: number): Promise<unknown> {
  switch (body.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "raporty-firmowe", version: "0.1.0" },
        instructions: "Płatne API danych o polskich firmach. Kup kredyty przez buy_credits, stan sprawdź get_balance.",
      };
    case "notifications/initialized":
      return null;
    case "tools/list":
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    case "tools/call": {
      const name = body.params?.name;
      if (typeof name !== "string") {
        throw new Error("brak nazwy narzędzia");
      }
      const tool = TOOLS.find((item) => item.name === name);
      if (!tool) {
        throw new Error(`nieznane narzędzie: ${name}`);
      }
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool({ accountId, deps }, tool, args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: false,
      };
    }
    default:
      throw new Error(`nieznana metoda: ${body.method ?? ""}`);
  }
}

function jsonRpcResponse(id: string | number | null, result?: unknown, error?: { code: number; message: string }): Response {
  const payload: JsonRpcResult = { jsonrpc: "2.0", id };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
  });
}

function jsonRpcError(id: string | number | null, code: number, message: string): Response {
  return jsonRpcResponse(id, undefined, { code, message });
}
