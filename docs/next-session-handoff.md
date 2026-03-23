# Next Session Handoff

## Branch

- Current working branch: `daemon-cli-http-design`

## Goal

Move this fork toward a daemon-first architecture so Figma functionality can be used without relying on local MCP connectivity.

Primary motivation:

- enterprise environment routes agent MCP traffic through a shared MCP gateway
- local MCP cannot be reached directly
- localhost HTTP + CLI can bypass that limitation

Important current decision:

- do not merge this branch to `main` yet
- do not publish this work to a separate GitHub repository yet
- keep iterating on this branch until the daemon-first tool surface and code organization are cleaner

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

### Daemon lifecycle fixes

Added daemon shutdown fixes in:

- [src/daemon/server.ts](/home/toshi/dev/figma-console-mcp/src/daemon/server.ts)

Implemented:

- graceful shutdown on `SIGINT`
- graceful shutdown on `SIGTERM`
- HTTP discovery cleanup during shutdown
- HTTP server close + runtime stop on shutdown
- removed `process.stdin.resume()` from daemon start to avoid `EIO` in this terminal environment

### Parity implementation

Shared parity logic now lives in:

- [src/core/design-code-tools.ts](/home/toshi/dev/figma-console-mcp/src/core/design-code-tools.ts)

Implemented:

- exported `codeSpecSchema`
- added shared `runDesignParityCheck(...)`
- registry-backed parity tool now calls the same implementation used by the MCP tool

This means the registry-backed `figma_check_design_parity` now includes:

- visual comparison
- spacing comparison
- typography comparison
- token comparison
- component API comparison
- accessibility comparison
- naming comparison
- metadata comparison
- severity sorting
- parity score calculation
- category counts
- action item generation
- shared parity presentation instruction
- optional enrichment via `enrich`

### Registry-backed tools currently implemented

All currently live in:

- [src/tools/catalog/local-read-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts)

Implemented registry-backed tools:

- `figma_get_variables`
- `figma_search_components`
- `figma_check_design_parity`
- `figma_execute`
- `figma_instantiate_component`
- `figma_set_instance_properties`
- `figma_add_component_property`
- `figma_edit_component_property`
- `figma_delete_component_property`
- `figma_set_description`
- `figma_resize_node`
- `figma_move_node`
- `figma_set_fills`
- `figma_set_strokes`
- `figma_set_opacity`
- `figma_set_corner_radius`
- `figma_clone_node`
- `figma_delete_node`
- `figma_rename_node`
- `figma_set_text_content`
- `figma_create_child`
- `figma_set_image_fill`
- `figma_capture_screenshot`
- `figma_lint_design`

Important note:

- despite the filename, `local-read-tools.ts` now contains both read and write tools
- this is the main cleanup target for the next session

### Tests added

Added registry-focused regression tests in:

- [tests/local-read-tools.test.ts](/home/toshi/dev/figma-console-mcp/tests/local-read-tools.test.ts)

Current coverage in that file includes:

- parity schema regression
- parity handler regression
- component write tools
- node manipulation tools
- validation tools

### Package / build changes

- Added new binary entry:
  - [package.json](/home/toshi/dev/figma-console-mcp/package.json)
  - `figma-console -> ./dist/daemon/server.js`

- Extended local TS build includes:
  - [tsconfig.local.json](/home/toshi/dev/figma-console-mcp/tsconfig.local.json)

## Commits Added In This Session

- `2c47c19` `Handle daemon shutdown on signals`
- `d41709f` `Avoid stdin EIO in daemon start`
- `37a272f` `Share parity implementation between MCP and registry tools`
- `ed44de4` `Add regression tests for registry-backed parity tool`
- `9d7ba5d` `Add registry-backed component write tools`
- `d0c0e0c` `Add registry-backed node manipulation and validation tools`

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

### Tests

Verified command:

```bash
TMPDIR=/tmp PATH="$HOME/.volta/bin:$PATH" npm test -- --runInBand tests/local-read-tools.test.ts
```

Important:

- in this environment Jest may try to use a missing Windows temp directory
- set `TMPDIR=/tmp` when running the targeted Jest tests here

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

Verified:

- `daemon status` uses the running daemon when the discovery file points to it
- `invoke figma_execute` uses daemon HTTP path and returns structured results
- daemon can be started with `FIGMA_ACCESS_TOKEN` and then used over HTTP/CLI

Verified example:

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_execute --input '{"code":"return { ok: true };"}'
```

When the Desktop Bridge plugin is not connected, the expected structured failure is returned:

- `ok: false`
- `tool: "figma_execute"`
- `error.message: "No WebSocket client connected..."`
- `meta.transport: "http"`

### Daemon shutdown behavior

Observed and fixed:

- `Ctrl+C` previously did not terminate `daemon start`
- root cause was that signal listeners prevented default exit, but daemon start had no shutdown handler
- `process.stdin.resume()` also triggered `EIO` in this terminal environment

Current expectation:

- `Ctrl+C` should now shut down the daemon cleanly
- if port fallback still occurs, check for stale daemon processes with `ps`

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

- [src/tools/catalog/local-read-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts) now mixes read and write tools and should be split
- registry-backed tool coverage is much better than before, but still not fully aligned with the full MCP tool surface
- CLI still mixes registry-local discovery for some commands and daemon-first behavior for execution/status
- no formal project skill/config loading yet
- no separate `local-write-tools.ts` catalog yet
- no cleanup pass yet on descriptor organization / discovery grouping after the large tool expansion

## Most Important Next Steps

### 1. Split read and write catalogs

Primary target:

- [src/tools/catalog/local-read-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts)

Next step:

- move write-oriented tools into a new file, likely `src/tools/catalog/local-write-tools.ts`
- keep read/analysis tools in `local-read-tools.ts`
- update daemon registration to include both catalogs

This is the most important cleanup now.

### 2. Continue filling daemon-first tool surface gaps

After catalog split:

- compare the registry-backed tool set against the existing MCP/local tool surface
- migrate additional high-value tools if important gaps remain

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

### Targeted tests

```bash
TMPDIR=/tmp PATH="$HOME/.volta/bin:$PATH" npm test -- --runInBand tests/local-read-tools.test.ts
```

### Start daemon

```bash
FIGMA_ACCESS_TOKEN=... PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js daemon start
```

### List tools

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools list
```

### Show tool details

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_check_design_parity
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_instantiate_component
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js tools show figma_lint_design
```

### CLI invoke examples

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_execute --input '{"code":"return { ok: true };"}'
```

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_lint_design --input '{"rules":["all"],"maxDepth":10,"maxFindings":100}'
```

### HTTP examples

```bash
curl -s http://127.0.0.1:3850/v1/help
curl -s http://127.0.0.1:3850/v1/tools
curl -s http://127.0.0.1:3850/v1/tools/figma_check_design_parity
curl -s -X POST http://127.0.0.1:3850/v1/tools/figma_execute \
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
Current status:
- parity implementation is shared between MCP and registry tools
- daemon shutdown and stdin EIO fixes are committed
- registry-backed component write tools and node manipulation/validation tools are added
Next priority:
- split src/tools/catalog/local-read-tools.ts into read/write catalogs
- keep daemon-first architecture direction
- do not merge to main yet
```
