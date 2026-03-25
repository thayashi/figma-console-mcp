# AGENTS.md

This preset is intended to be merged into the base template for design-system creation or maintenance work.

## Focus

- Build or validate tokens, variable collections, component structure, and library conventions in Figma.
- Use the local `figma-console` CLI first for discovery and invocation.
- Use localhost HTTP second, and official Figma MCP only as fallback.
- Keep design-system creation incremental and reviewable.
- Treat token and component architecture as a multi-step workflow rather than a one-shot script.

## Recommended Additional Skills

- `figma-console-design-system`
- optional vendor skills copied from `project_templates/vendor/figma-official-skills/`:
  - `figma-use`
  - `figma-generate-library`
  - `figma-create-design-system-rules`

## Extra Validation Expectations

- Validate token structure before creating components.
- Review each component family after creation rather than batching an entire library blindly.
- Keep naming and variant conventions deterministic so future automation can resume safely.
