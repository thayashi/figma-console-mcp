# Daemon-First Tool Coverage

## Scope

This note compares the current daemon-first registry surface against the broader existing MCP/local tool surface.

Compared sources:

- legacy MCP/local registrations:
  - `/home/toshi/dev/figma-console-mcp/src/core/figma-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/core/design-system-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/core/write-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/core/design-code-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/core/comment-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/index.ts`
  - `/home/toshi/dev/figma-console-mcp/src/local.ts`
- daemon-first registry catalogs:
  - `/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-read-tools.ts`
  - `/home/toshi/dev/figma-console-mcp/src/tools/catalog/local-write-tools.ts`

## Snapshot

- legacy unique tool names: 61
- daemon-first registry tool names: 60
- exact name overlap: 57
- legacy names not present in registry: 4
- registry-only names: 3

Registry-only names:

- `figma_set_opacity`
- `figma_set_corner_radius`
- `figma_set_text_content`

One of these entries is effectively a daemon-first naming cleanup over an older MCP/local name:

- `figma_take_screenshot` -> `figma_capture_screenshot`
- `figma_set_text` -> `figma_set_text_content`

That means functional parity is slightly better than the raw exact-name count suggests.

## Exact Gaps

Legacy tool names that do not currently exist as registry-backed daemon tools:

- `figma_navigate`
- `figma_pair_plugin`
- `figma_set_text`
- `figma_take_screenshot`

## Classification

### Intentionally Outside The Daemon-First Runtime Surface

These are not strong candidates for the runtime/registry layer as currently designed:

- `figma_navigate`
  - Browser/CDP-oriented, not a daemon runtime concern.
- `figma_pair_plugin`
  - Cloud relay pairing flow, not a localhost daemon runtime concern.

### Covered By Renamed Daemon Tools

- `figma_take_screenshot`
  - effectively covered by `figma_capture_screenshot`
- `figma_set_text`
  - effectively covered by `figma_set_text_content`

### Remaining Intentional Omissions

These legacy names remain outside the daemon-first registry for explicit scope reasons or because they are covered by renamed tools:

- browser/navigation flow:
  - `figma_navigate`
- cloud relay pairing flow:
  - `figma_pair_plugin`
- naming-cleanup equivalents:
  - `figma_take_screenshot` -> `figma_capture_screenshot`
  - `figma_set_text` -> `figma_set_text_content`

## Recommended Next Pass

### Priority 1

Refresh docs to reflect that `figma_arrange_component_set` is now daemon-first.

Reason:

- it closes the last real plugin-runtime parity gap from the older local surface
- remaining exclusions are now intentional boundary decisions rather than uncovered runtime writes

## Proposed Merge Readiness Interpretation

The daemon-first surface now covers the practical runtime/read/write surface, and the remaining differences from the historical MCP/local surface are intentional.

Current status is closer to:

- daemon-first foundation: ready
- branch for doc and organization cleanup: still active
- merge to `main`: premature until the remaining gap strategy is explicit
