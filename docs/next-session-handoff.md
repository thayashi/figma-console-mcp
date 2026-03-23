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

Catalog files:

- read/runtime tools:
  - [src/tools/catalog/local-read-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts)
- write tools:
  - [src/tools/catalog/local-write-tools.ts](/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-write-tools.ts)

Implemented registry-backed read/runtime tools:

- `figma_get_variables`
- `figma_search_components`
- `figma_get_component_details`
- `figma_get_library_components`
- `figma_get_design_system_summary`
- `figma_get_token_values`
- `figma_get_component_image`
- `figma_check_design_parity`
- `figma_get_status`
- `figma_get_selection`
- `figma_list_open_files`
- `figma_get_file_data`
- `figma_get_design_changes`
- `figma_get_console_logs`
- `figma_clear_console`
- `figma_watch_console`
- `figma_reconnect`
- `figma_reload_plugin`
- `figma_capture_screenshot`
- `figma_lint_design`

Implemented registry-backed write tools:

- `figma_execute`
- `figma_update_variable`
- `figma_create_variable`
- `figma_create_variable_collection`
- `figma_delete_variable`
- `figma_delete_variable_collection`
- `figma_rename_variable`
- `figma_add_mode`
- `figma_rename_mode`
- `figma_batch_create_variables`
- `figma_batch_update_variables`
- `figma_setup_design_tokens`
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

### Tests added

Added registry-focused regression tests in:

- [tests/local-read-tools.test.ts](/home/toshi/dev/figma-console-mcp/tests/local-read-tools.test.ts)
- [tests/cli-help.test.ts](/home/toshi/dev/figma-console-mcp/tests/cli-help.test.ts)
- [tests/http-help.test.ts](/home/toshi/dev/figma-console-mcp/tests/http-help.test.ts)
- [tests/tool-registry.test.ts](/home/toshi/dev/figma-console-mcp/tests/tool-registry.test.ts)
- [tests/cli-main.test.ts](/home/toshi/dev/figma-console-mcp/tests/cli-main.test.ts)

Current coverage in that file includes:

- catalog split regression
- runtime/read tool regression
- variable management tool regression
- component write tool regression
- node manipulation tool regression
- validation and parity regression

Additional current coverage includes:

- CLI help formatting / grouping regression
- HTTP help document regression
- registry descriptor normalization regression
- CLI error-path regression

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
TMPDIR=/tmp PATH="$HOME/.volta/bin:$PATH" npm test -- --runInBand tests/local-read-tools.test.ts tests/cli-help.test.ts tests/http-help.test.ts tests/tool-registry.test.ts tests/cli-main.test.ts
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

- `tools list` uses the running daemon HTTP path
- `tools show` uses the running daemon HTTP path
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

- catalog split is done and descriptor/discovery cleanup has progressed, but there may still be smaller consistency passes left
- registry-backed tool coverage is much better than before, but still not fully aligned with the full MCP tool surface
- CLI is now daemon-first for `tools list`, `tools show`, `invoke`, and `daemon status`
- `figma_navigate` is still intentionally left outside the daemon-first registry surface because it is browser/CDP-oriented rather than runtime/registry-oriented
- no formal project skill/config loading yet
- some docs still describe the older/local surface more than the daemon-first CLI/HTTP surface

## Most Important Next Steps

### 1. Update docs/handoff and daemon-first usage guidance

Current code state is ahead of the handoff/docs that existed at the start of this session.

Highest-value follow-up:

- refresh docs that still assume the older local/MCP-first surface
- document the current discovery groups and CLI/HTTP exploration flow
- decide whether `figma_take_screenshot` should remain separate from the newer screenshot/image surfaces

### 2. Continue closing remaining daemon-first surface gaps

Read/discovery backlog from the previous handoff is now covered, but there may still be non-read MCP tools that have not been mapped into the registry-backed daemon surface.

Likely next gap analysis areas:

- compare registry-backed tool coverage against the broader MCP/local tool set
- identify any remaining daemon-first omissions outside the intentionally excluded browser/CDP-oriented tools

### 3. Future phase, not yet implemented

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
TMPDIR=/tmp PATH="$HOME/.volta/bin:$PATH" npm test -- --runInBand tests/local-read-tools.test.ts tests/cli-help.test.ts tests/http-help.test.ts tests/tool-registry.test.ts tests/cli-main.test.ts
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
- registry-backed component write tools, variable tools, runtime/read tools, node manipulation/validation tools, and read/discovery backlog tools are added
- local tool catalogs are split into read and write modules and daemon registration loads both
- CLI tool grouping, tool details/help guidance, registry descriptor normalization, and CLI error handling have been cleaned up
Next priority:
- refresh docs/handoff and compare daemon-first registry coverage against the remaining broader MCP/local tool surface
- keep daemon-first architecture direction
- do not merge to main yet
```
