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
- daemon-first registry tool names: 56
- exact name overlap: 53
- legacy names not present in registry: 8
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

- `figma_arrange_component_set`
- `figma_generate_component_doc`
- `figma_get_component`
- `figma_get_design_system_kit`
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

### Partially Covered But Not Fully Replaced

- `figma_get_component`
  - partially covered by `figma_get_component_details`, `figma_get_component_image`, and `figma_get_file_data`
  - still missing the older single-call metadata/reconstruction shape
- `figma_get_design_system_kit`
  - partially covered by `figma_get_design_system_summary`, `figma_get_token_values`, `figma_get_variables`, `figma_get_library_components`, and `figma_get_component_details`
  - still missing the one-shot combined extraction format

### Clear Uncovered Gaps

These still look like real daemon-first coverage gaps rather than naming changes:

- component/docs workflows:
  - `figma_get_component`
  - `figma_generate_component_doc`
- design-system aggregate workflow:
  - `figma_get_design_system_kit`
- plugin/file structure read:
- none in this category after adding `figma_get_file_for_plugin`
- component-set organization write:
  - `figma_arrange_component_set`

## Recommended Next Pass

### Priority 1

Decide whether to preserve or collapse the higher-level synthesis tools:

- `figma_get_component`
- `figma_get_component_for_development`
- `figma_get_design_system_kit`
- `figma_generate_component_doc`

Decision needed:

- preserve legacy tool contracts in the registry, or
- keep the lower-level daemon tools and explicitly retire these aggregated MCP-era shapes

### Priority 1

Evaluate whether `figma_arrange_component_set` belongs in daemon-first.

Reason:

- it is write-oriented and plugin/runtime-compatible
- but it is also more specialized than the other current write tools

## Proposed Merge Readiness Interpretation

The daemon-first surface now covers most of the practical runtime/read/write basics, but it is not yet at full parity with the broader historical MCP/local surface.

Current status is closer to:

- daemon-first foundation: ready
- branch for further parity cleanup: still active
- merge to `main`: premature until the remaining gap strategy is explicit
