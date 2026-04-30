# openapi-mcp

A lightweight MCP server that exposes any OpenAPI specification as searchable tools — `search_api`, `get_endpoint`, `get_schema`, and `list_endpoints`. Drop in a YAML or JSON spec file and instantly give AI assistants precise, token-efficient access to your API's endpoints, parameters, and schemas, without hallucinations or guesswork.

## Run

```bash
# Development (no build step)
npm run dev -- path/to/openapi.yaml
OPENAPI_SPEC_PATH=path/to/openapi.yaml npm run dev

# Production
npm run build
npm start -- path/to/openapi.yaml
```

For Claude Desktop, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "openapi": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/openapi-mcp/src/index.ts", "/path/to/openapi.yaml"]
    }
  }
}
```

## Tools

| Tool | What it does |
|------|-------------|
| `search_api` | Keyword search across path, tag, summary, description, params, request body |
| `get_endpoint` | Full detail for one endpoint: params, request body, all response schemas |
| `get_schema` | Expand a named component schema (case-insensitive, shows descriptions) |
| `list_endpoints` | All endpoints grouped by tag with summaries; optional tag filter |
