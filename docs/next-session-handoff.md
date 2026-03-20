# Next Session Handoff

## Branch

- Current working branch: `daemon-cli-http-design`

## Goal

Move this fork toward a daemon-first architecture so Figma functionality can be used without relying on local MCP connectivity.

Primary motivation:

- enterprise environment routes agent MCP traffic through a shared MCP gateway
- local MCP cannot be reached directly
- localhost HTTP + CLI can bypass that limitation

## What Has Been Implemented

### Architecture / Docs

- Added daemon-first architecture notes:
  - [docs/daemon-cli-http-architecture.md](./daemon-cli-http-architecture.md)

### Core daemon / registry / transport scaffolding

- Added runtime abstraction:
  - [src/daemon/runtime.ts](/home/toshi/dev/figma-console-mcp/src/daemon/runtime.ts)
- Added local daemon runtime:
  - [src/daemon/local-runtime.ts](/home/toshi/dev/figma-console-mcp/src/daemon/local-runtime.ts)
- Added tool definition types:
  - [src/tools/types.ts](/home/toshi/dev/figma-console-mcp/src/tools/types.ts)
- Added registry:
  - [src/tools/registry.ts](/home/toshi/dev/figma-console-mcp/src/tools/registry.ts)
- Added daemon entrypoint:
  - [src/daemon/server.ts](/home/toshi/dev/figma-console-mcp/src/daemon/server.ts)
- Added HTTP transport:
  - [src/transports/http/server.ts](/home/toshi/dev/figma-console-mcp/src/transports/http/server.ts)
- Added CLI transport:
  - [src/transports/cli/main.ts](/home/toshi/dev/figma-console-mcp/src/transports/cli/main.ts)
  - [src/transports/cli/help.ts](/home/toshi/dev/figma-console-mcp/src/transports/cli/help.ts)
  - [src/transports/cli/http-client.ts](/home/toshi/dev/figma-console-mcp/src/transports/cli/http-client.ts)

### HTTP daemon discovery

- Added daemon HTTP discovery file support:
  - [src/daemon/http-discovery.ts](/home/toshi/dev/figma-console-mcp/src/daemon/http-discovery.ts)

Discovery file path:

- `~/.figma-console-mcp/daemon-http.json`

This is used so CLI commands can find the already-running daemon instead of trying to start local runtime directly.

### Registry-backed tools currently implemented

All currently live in:

- [src/tools/catalog/local-read-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts)

Implemented tools:

- `figma_get_variables`
- `figma_search_components`
- `figma_check_design_parity`
- `figma_execute`

Notes:

- `figma_check_design_parity` is currently a minimal registry-backed version
- it compares visual / spacing / typography / metadata only
- it is not yet feature-parity with the original MCP implementation in [src/core/design-code-tools.ts](/home/toshi/dev/figma-console-mcp/src/core/design-code-tools.ts)

### Package / build changes

- Added new binary entry:
  - [package.json](/home/toshi/dev/figma-console-mcp/package.json)
  - `figma-console -> ./dist/daemon/server.js`

- Extended local TS build includes:
  - [tsconfig.local.json](/home/toshi/dev/figma-console-mcp/tsconfig.local.json)

## What Has Been Verified

### Build

Use Volta explicitly.

Verified command:

```bash
PATH="$HOME/.volta/bin:$PATH" npm run build:local
```

Important:

- plain `npm` may resolve to Windows-side Node tooling in this environment
- use Volta path prefix when building

### CLI discovery

Verified:

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools list
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_execute
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_check_design_parity
```

### HTTP daemon behavior

Verified:

- daemon starts successfully
- WebSocket port fallback works
- HTTP port fallback works
- `/v1/help`, `/v1/status`, `/v1/tools`, `/v1/tools/:name`, `POST /v1/tools/:name` all respond

Observed fallback examples during testing:

- WebSocket ports advanced from `9223` to `9224`, `9225`, `9226`, `9227`, `9228`
- HTTP ports advanced from `3847` to `3848`, `3849`, `3850`, `3851`, `3852`

### CLI daemon-first behavior

Current behavior after adding HTTP discovery:

- `daemon status` uses the running daemon when the discovery file points to it
- `invoke figma_execute` uses daemon HTTP path and returns structured results

Verified example:

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_execute --input '{"code":"return { ok: true };"}'
```

When the Desktop Bridge plugin is not connected, the expected structured failure is returned:

- `ok: false`
- `tool: "figma_execute"`
- `error.message: "No WebSocket client connected..."`
- `meta.transport: "http"`

## Current HTTP API Surface

Implemented routes:

- `GET /v1/health`
- `GET /v1/status`
- `GET /v1/tools`
- `GET /v1/tools/:name`
- `GET /v1/help`
- `GET /v1/openapi.json`
- `POST /v1/tools/:name`

## Known Limitations

- `figma_check_design_parity` is still much smaller than the original MCP parity tool
- only 4 tools are registry-backed so far
- most of the existing MCP toolset is still not migrated into the registry
- CLI still mixes registry-local discovery for some commands and daemon-first behavior for execution/status
- no formal project skill/config loading yet

## Most Important Next Steps

### 1. Expand parity toward the original MCP implementation

Target file for source logic:

- [src/core/design-code-tools.ts](/home/toshi/dev/figma-console-mcp/src/core/design-code-tools.ts)

Priority areas:

- token comparison
- component API comparison
- accessibility comparison
- richer action items / parity summaries

### 2. Add another write-oriented registry-backed tool

Likely candidates:

- `figma_instantiate_component`
- or a more structured write tool beyond raw `figma_execute`

### 3. Clean up CLI daemon-first behavior further

The current state is workable, but the daemon-first path should become the unambiguous primary path for:

- `daemon status`
- `invoke`
- eventually `tools show`

### 4. Future phase, not yet implemented

Project-specific skill/config layering:

- keep common daemon/CLI generic
- make per-project rules, design-system specs, product rules, and parity policies pluggable

## Practical Commands For Next Session

### Build

```bash
PATH="$HOME/.volta/bin:$PATH" npm run build:local
```

### Start daemon

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js daemon start
```

### List tools

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools list
```

### Show tool details

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_execute
```

### CLI invoke example

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_execute --input '{"code":"return { ok: true };"}'
```

### HTTP examples

```bash
curl -s http://127.0.0.1:3852/v1/help
curl -s http://127.0.0.1:3852/v1/tools
curl -s http://127.0.0.1:3852/v1/tools/figma_execute
curl -s -X POST http://127.0.0.1:3852/v1/tools/figma_execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"code":"return { ok: true };"}}'
```

Note:

- actual port may vary because HTTP fallback is enabled
- check `~/.figma-console-mcp/daemon-http.json` for the current daemon port

## Recommended Prompt For Next Session

Suggested restart prompt:

```text
Read docs/next-session-handoff.md first, then continue on branch daemon-cli-http-design.
Next priority: expand figma_check_design_parity toward the original MCP implementation in src/core/design-code-tools.ts.
```
