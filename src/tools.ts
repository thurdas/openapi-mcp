import type { Endpoint, SchemaObject, OpenApiSpec } from "./types.ts";

type Paths = NonNullable<OpenApiSpec["paths"]>;
type Schemas = NonNullable<NonNullable<OpenApiSpec["components"]>["schemas"]>;

// Renders a JSON Schema to a compact TS-like string.
// Stops at depth 2 to avoid infinite loops from circular $refs.
function formatSchema(schemas: Schemas, schema: SchemaObject, depth = 0): string {
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop()!;
    if (depth >= 2) return name;
    const resolved = schemas[name];
    if (!resolved) return name;
    return `${name}{ ${formatSchema(schemas, resolved, depth + 1)} }`;
  }

  if (schema.allOf) return schema.allOf.map((s) => formatSchema(schemas, s, depth)).join(" & ");
  if (schema.oneOf || schema.anyOf) {
    return (schema.oneOf ?? schema.anyOf)!.map((s) => formatSchema(schemas, s, depth)).join(" | ");
  }
  if (schema.type === "array") return `${formatSchema(schemas, schema.items ?? {}, depth)}[]`;

  if (schema.type === "object" || schema.properties) {
    const required = new Set(schema.required ?? []);
    const props = Object.entries(schema.properties ?? {})
      .map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${formatSchema(schemas, v, depth + 1)}`)
      .join(", ");
    return props ? `{ ${props} }` : "{}";
  }

  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.type === "string" && schema.format) return `string(${schema.format})`;
  if (schema.type) return schema.type;
  return "any";
}

interface SearchEntry {
  searchable: string;
  result: string;
}

interface TagIndex {
  // tag name (lowercase) -> { canonical casing, display lines }
  byTag: Map<string, { canonical: string; lines: string[] }>;
  // lowercase tag names in sorted order
  allTags: string[];
}

export interface Tools {
  searchApi(query: string): string;
  getEndpoint(path: string, method: string): string;
  getSchema(name: string): string;
  listEndpoints(tag?: string): string;
}

export function buildTools(paths: Paths, schemas: Schemas, endpoints: Endpoint[]): Tools {
  const fmt = (schema: SchemaObject, depth = 0) => formatSchema(schemas, schema, depth);

  // --- Pre-built indexes (computed once at startup) ---

  // 1. Schema render cache: component name (lowercase) -> rendered string
  const schemaCache = new Map<string, { canonical: string; rendered: string }>();
  for (const [name, schema] of Object.entries(schemas)) {
    const lines = [`## ${name}`];
    if (schema.description) lines.push(schema.description);
    if (schema.properties) {
      const required = new Set(schema.required ?? []);
      for (const [prop, def] of Object.entries(schema.properties)) {
        const desc = def.description ? ` — ${def.description}` : "";
        lines.push(`  ${prop}${required.has(prop) ? "" : "?"}: ${fmt(def)}${desc}`);
      }
    } else {
      lines.push(`  ${fmt(schema)}`);
    }
    schemaCache.set(name.toLowerCase(), { canonical: name, rendered: lines.join("\n") });
  }

  // 2. Search index: one entry per endpoint with pre-built searchable text and result string
  const searchIndex: SearchEntry[] = endpoints.map(({ path, method, op }) => {
    const searchable = [
      path,
      (op.tags ?? []).join(" "),
      op.summary ?? "",
      op.description ?? "",
      (op.parameters ?? []).map((p) => p.name).join(" "),
      op.requestBody?.content?.["application/json"]?.schema?.$ref?.split("/").pop() ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const tag = op.tags?.[0] ?? "—";
    const summary = op.summary ? ` — ${op.summary}` : "";
    const params = (op.parameters ?? [])
      .map((p) => `${p.name}${p.required ? "" : "?"}(${p.in})`)
      .join(", ");
    const resp200 = op.responses?.["200"]?.content?.["application/json"]?.schema;
    const result = `${method} ${path}${summary}\n  tag: ${tag}\n  params: ${params || "—"}\n  200: ${resp200 ? fmt(resp200) : "—"}`;

    return { searchable, result };
  });

  // 3. Endpoint detail cache: "METHOD /path" -> rendered detail string
  const endpointCache = new Map<string, string>();
  for (const { path, method, op } of endpoints) {
    const lines: string[] = [`## ${method} ${path}`];
    if (op.summary) lines.push(op.summary);
    lines.push(`tag: ${(op.tags ?? []).join(", ") || "—"}`);

    if (op.parameters?.length) {
      lines.push("\n### Parameters");
      for (const p of op.parameters) {
        const desc = p.description ? ` — ${p.description}` : "";
        lines.push(`  ${p.name}${p.required ? "" : "?"} [${p.in}]: ${p.schema ? fmt(p.schema) : "any"}${desc}`);
      }
    }

    const reqSchema = op.requestBody?.content?.["application/json"]?.schema;
    if (reqSchema) {
      lines.push("\n### Request body");
      lines.push(`  ${fmt(reqSchema)}`);
    }

    lines.push("\n### Responses");
    for (const [code, resp] of Object.entries(op.responses ?? {})) {
      const schema = resp.content?.["application/json"]?.schema;
      lines.push(`  ${code}: ${resp.description ?? ""} → ${schema ? fmt(schema) : "—"}`);
    }

    endpointCache.set(`${method} ${path}`, lines.join("\n"));
  }

  // 4. Tag index: pre-grouped and sorted for listEndpoints
  const tagIndex: TagIndex = { byTag: new Map(), allTags: [] };
  for (const { path, method, op } of endpoints) {
    const canonical = op.tags?.[0] ?? "Untagged";
    const key = canonical.toLowerCase();
    if (!tagIndex.byTag.has(key)) tagIndex.byTag.set(key, { canonical, lines: [] });
    tagIndex.byTag.get(key)!.lines.push(`  ${method} ${path}${op.summary ? ` — ${op.summary}` : ""}`);
  }
  tagIndex.allTags = [...tagIndex.byTag.keys()].sort();

  // --- Tool implementations (lookups only) ---

  return {
    searchApi(query: string): string {
      const q = query.toLowerCase();
      const results = searchIndex.filter((e) => e.searchable.includes(q)).map((e) => e.result);
      if (results.length === 0) return `No endpoints found matching "${query}".`;
      return `Found ${results.length} endpoint(s):\n\n${results.join("\n\n")}`;
    },

    getEndpoint(path: string, method: string): string {
      const key = `${method.toUpperCase()} ${path}`;
      return endpointCache.get(key) ?? `${method.toUpperCase()} ${path} not found in spec.`;
    },

    getSchema(name: string): string {
      const entry = schemaCache.get(name.toLowerCase());
      if (!entry) {
        const first30 = [...schemaCache.values()].slice(0, 30).map((e) => e.canonical).join(", ");
        return `Schema "${name}" not found.\nFirst 30 schemas: ${first30}`;
      }
      return entry.rendered;
    },

    listEndpoints(tag?: string): string {
      if (tag) {
        const entry = tagIndex.byTag.get(tag.toLowerCase());
        if (!entry) {
          const canonicalTags = tagIndex.allTags.map((k) => tagIndex.byTag.get(k)!.canonical).join(", ");
          return `No endpoints found for tag "${tag}".\nAvailable tags: ${canonicalTags}`;
        }
        return `### ${entry.canonical}\n${entry.lines.join("\n")}`;
      }

      return tagIndex.allTags
        .map((key) => {
          const { canonical, lines } = tagIndex.byTag.get(key)!;
          return `### ${canonical}\n${lines.join("\n")}`;
        })
        .join("\n\n");
    },
  };
}
