# openapi-mcp

A lightweight MCP server that exposes any OpenAPI specification as searchable tools — `search_api`, `get_endpoint`, `get_schema`, and `list_endpoints`. Drop in a YAML or JSON spec file and instantly give AI assistants precise, token-efficient access to your API's endpoints, parameters, and schemas, without hallucinations or guesswork.

## Install

```bash
# From GitHub — no build step required
npm install github:thurdas/openapi-mcp
```

## Run

```bash
# Via npx after install
npx openapi-mcp path/to/openapi.yaml

# Development (from source)
npm run dev -- path/to/openapi.yaml
```

For Claude Desktop, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "openapi": {
      "command": "node",
      "args": ["node_modules/openapi-mcp/bin/openapi-mcp.js", "/path/to/openapi.yaml"]
    }
  }
}
```

Or if installed globally / via npx:
```json
{
  "mcpServers": {
    "openapi": {
      "command": "npx",
      "args": ["openapi-mcp", "/path/to/openapi.yaml"]
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
