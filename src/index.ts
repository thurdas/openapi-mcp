#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { buildTools } from "./tools.js";
import type { Endpoint, OpenApiSpec } from "./types.js";

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

const specPath =
  process.env.OPENAPI_SPEC_PATH ??
  process.argv[2] ??
  die(
    "Usage: OPENAPI_SPEC_PATH=<path> node dist/index.js\n" +
    "   or: node dist/index.js <path/to/openapi.yaml>"
  );

let spec: OpenApiSpec;
try {
  spec = yaml.load(readFileSync(resolve(specPath), "utf8")) as OpenApiSpec;
} catch (err) {
  die(`Failed to load OpenAPI spec from "${specPath}": ${(err as Error).message}`);
}

const paths = spec.paths ?? {};
const schemas = spec.components?.schemas ?? {};

const endpoints: Endpoint[] = [];
for (const [path, pathItem] of Object.entries(paths)) {
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const op = pathItem[method];
    if (!op) continue;
    endpoints.push({ path, method: method.toUpperCase(), op });
  }
}

const tools = buildTools(paths, schemas, endpoints);

// --- MCP server ---

const server = new Server(
  { name: "openapi-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_api",
      description:
        "Search API endpoints by keyword (path, tag, summary, description, parameter name, or request body schema name). Returns matching endpoints with method, tag, parameters, and 200 response type.",
      inputSchema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Keyword to search for" } },
        required: ["query"],
      },
    },
    {
      name: "get_endpoint",
      description:
        "Get full details for a specific API endpoint: parameters, request body, and all response schemas as compact TypeScript-like types.",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "Exact path, e.g. /v1/user/profile" },
          method: { type: "string", description: "HTTP method: GET, POST, PUT, PATCH, DELETE" },
        },
        required: ["path", "method"],
      },
    },
    {
      name: "get_schema",
      description:
        "Look up a named component schema (case-insensitive) and show all its fields with types and descriptions.",
      inputSchema: {
        type: "object" as const,
        properties: { name: { type: "string", description: "Schema name from components/schemas" } },
        required: ["name"],
      },
    },
    {
      name: "list_endpoints",
      description:
        "List all API endpoints grouped by tag with summaries. Optionally filter to one tag.",
      inputSchema: {
        type: "object" as const,
        properties: { tag: { type: "string", description: "Optional tag name to filter by" } },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let text: string;
  try {
    if (name === "search_api") text = tools.searchApi(args?.query as string);
    else if (name === "get_endpoint") text = tools.getEndpoint(args?.path as string, args?.method as string);
    else if (name === "get_schema") text = tools.getSchema(args?.name as string);
    else if (name === "list_endpoints") text = tools.listEndpoints(args?.tag as string | undefined);
    else text = `Unknown tool: ${name}`;
  } catch (err) {
    text = `Error: ${(err as Error).message}`;
  }
  return { content: [{ type: "text" as const, text }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
