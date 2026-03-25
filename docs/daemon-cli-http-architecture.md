# Daemon / CLI / HTTP Architecture

## Goal

Expose the existing Figma Console capabilities without requiring MCP as the primary access path.

This is motivated by enterprise environments where AI agents can only reach a shared MCP gateway and cannot connect to local MCP servers directly. A local daemon with CLI and localhost HTTP access avoids that restriction while preserving access to:

- Desktop Bridge plugin APIs
- Figma REST API reads
- design-system extraction
- mockup creation and updates
- parity/spec validation
- console and selection state

## Core Decision

Make a local daemon the system of record.

All external transports become adapters over the same internal tool registry:

- CLI
- localhost HTTP API
- MCP adapter

## Architecture

```text
Figma Desktop Bridge Plugin <-> Local Daemon Runtime <-> Tool Registry <-> Transport Adapters
                                   |                    |-> CLI
                                   |                    |-> HTTP
                                   |                    |-> MCP
                                   |
                                   -> Figma REST API
```

## Layers

### 1. Runtime Layer

Stateful local process responsible for:

- Desktop Bridge WebSocket lifecycle
- REST API auth/token access
- active file tracking
- selection tracking
- console log buffer
- variable/design-system caches
- capability detection

This layer should not know about MCP, CLI argument parsing, or HTTP routing.

### 2. Tool Registry Layer

Defines every tool once as:

- metadata
- input schema
- optional output schema
- capability flags
- handler

Handlers receive a runtime context and return transport-neutral results.

### 3. Transport Layer

Adapters only:

- validate input
- call registry handler
- format output for the transport
- expose discovery/help

## Proposed Modules

### Runtime

- `src/daemon/runtime.ts`
- `src/daemon/context.ts`
- `src/daemon/state.ts`
- `src/daemon/auth.ts`
- `src/daemon/cache.ts`
- `src/daemon/server.ts`

### Tools

- `src/tools/types.ts`
- `src/tools/registry.ts`
- `src/tools/catalog/*.ts`

### Transports

- `src/transports/http/server.ts`
- `src/transports/http/openapi.ts`
- `src/transports/http/routes/*.ts`
- `src/transports/cli/main.ts`
- `src/transports/cli/help.ts`
- `src/transports/mcp/register.ts`

## Tool Definition Shape

```ts
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  summary: string;
  description: string;
  tags: string[];
  discoveryGroup: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  capabilities: {
    requiresPlugin?: boolean;
    requiresRestToken?: boolean;
    supportsHttp?: boolean;
    supportsCli?: boolean;
    supportsMcp?: boolean;
    responseShape?: "small" | "medium" | "large";
    sideEffects?: "none" | "document_write" | "network_read";
  };
  examples?: Array<{
    title: string;
    input: unknown;
    notes?: string;
  }>;
  relatedTools?: string[];
  handler: (ctx: ToolContext, input: TInput) => Promise<TOutput>;
}
```

## Runtime Context Shape

```ts
export interface ToolContext {
  runtime: FigmaRuntime;
  request: {
    requestId: string;
    transport: "cli" | "http" | "mcp";
    interactive: boolean;
  };
}

export interface FigmaRuntime {
  getStatus(): Promise<RuntimeStatus>;
  getDesktopConnector(): Promise<IFigmaConnector>;
  getFigmaAPI(): Promise<FigmaAPI>;
  getCurrentFileUrl(): string | null;
  getVariablesCache(): Map<string, { data: unknown; timestamp: number }>;
  getConsoleMonitor(): ConsoleMonitor | null;
  ensureInitialized?(): Promise<void>;
}
```

## HTTP API

Bind to `127.0.0.1` by default.

### Routes

- `GET /v1/health`
- `GET /v1/status`
- `GET /v1/tools`
- `GET /v1/tools/:name`
- `GET /v1/help`
- `GET /v1/openapi.json`
- `POST /v1/tools/:name`

### `GET /v1/tools`

Returns compact discoverability metadata:

- tool name
- summary
- tags
- discovery group
- capability flags
- response size hint
- preconditions

### `GET /v1/tools/:name`

Returns:

- full description
- JSON schema
- output schema if available
- examples
- common errors
- related tools

### `POST /v1/tools/:name`

Request:

```json
{
  "input": {},
  "options": {
    "verbosity": "summary",
    "format": "summary"
  }
}
```

Response:

```json
{
  "ok": true,
  "tool": "figma_get_variables",
  "data": {},
  "meta": {
    "requestId": "req_123",
    "transport": "http",
    "durationMs": 120,
    "warnings": []
  }
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "PLUGIN_REQUIRED",
    "message": "Desktop Bridge plugin is not connected.",
    "hint": "Open the plugin in Figma and retry."
  }
}
```

## CLI

CLI should primarily act as a client to the local daemon.

### Commands

- `figma-console daemon start`
- `figma-console daemon status`
- `figma-console tools list`
- `figma-console tools show <tool>`
- `figma-console invoke <tool> --input @payload.json`
- `figma-console help <topic>`

### Agent-Friendly Requirements

- discovery commands emit structured output by default
- stable field names
- non-zero exit codes on failure
- `stderr` reserved for diagnostics
- `stdout` reserved for structured output

## Structured Discoverability

This is a first-class requirement.

Agents must be able to discover:

- what tools exist
- which ones require plugin access
- which ones require REST token access
- expected input shape
- likely response size
- which tool to call next

### Discovery metadata per tool

- `name`
- `summary`
- `description`
- `tags`
- `discoveryGroup`
- `inputSchema`
- `outputSchema`
- `examples`
- `relatedTools`
- `requiresPlugin`
- `requiresRestToken`
- `responseShape`
- `sideEffects`

## Migration Strategy

Do not replace MCP first.

### Phase 1

Add registry and daemon runtime abstractions without changing current behavior.

- extract transport-neutral runtime interface
- introduce tool definition types
- keep current MCP registration working

### Phase 2

Implement localhost HTTP transport for a small set of read-heavy tools.

Recommended first tools:

- `figma_get_design_system_kit`
- `figma_get_variables`
- `figma_search_components`
- `figma_check_design_parity`

### Phase 3

Implement CLI over HTTP.

### Phase 4

Move write tools and debug tools to registry-backed handlers.

### Phase 5

Make MCP adapter consume the same registry.

## First PR Scope

Keep the first implementation narrow:

- add daemon runtime interface
- add tool definition registry
- add `/v1/tools`, `/v1/tools/:name`, `/v1/health`, `/v1/status`
- expose 2 to 4 design-system read tools over HTTP
- add `tools list`, `tools show`, `invoke` CLI commands

Avoid migrating all tools at once.

## Compatibility Strategy

This repository may be forked and renamed. The architecture should therefore be additive and non-destructive:

- keep existing MCP entrypoints intact
- add new daemon/HTTP/CLI entrypoints
- avoid large file renames in early phases
- keep transport-neutral code in new modules first

This reduces merge risk and keeps the fork maintainable even if upstream diverges.
