# AGENTS.md

This preset is intended to be merged into the base template for Code Connect work.

## Focus

- Map published Figma components to code components.
- Use the local `figma-console` CLI first for discovery and invocation.
- Use localhost HTTP second, and official Figma MCP only as fallback.
- Keep Code Connect mappings aligned with the real codebase.
- Prefer precise component matching over broad or speculative mapping.

## Recommended Additional Skills

- `figma-console-code-connect`
- optional vendor skills copied from `project_templates/vendor/figma-official-skills/`:
  - `figma-code-connect-components`

## Extra Validation Expectations

- Confirm the Figma component is published before attempting mappings.
- Compare props and variant structure before mapping.
- Prefer explicit user confirmation when multiple candidate components are plausible.
