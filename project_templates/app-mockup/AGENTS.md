# AGENTS.md

This preset is intended to be merged into the base template for app or screen mockup work.

## Focus

- Build product screens and flows in Figma using the daemon-first control surface.
- Use the local `figma-console` CLI first for discovery and invocation.
- Use localhost HTTP second, and official Figma MCP only as fallback.
- Prefer reusable components, variables, and styles over ad hoc primitives.
- Use mockup-oriented workflow skills under `.claude/skills/`.

## Recommended Additional Skills

- `figma-console-app-mockup`
- optional vendor skills copied from `project_templates/vendor/figma-official-skills/`:
  - `figma-use`
  - `figma-generate-design`

## Extra Validation Expectations

- Always capture a screenshot after the last visual write.
- When a screen contains multiple sections, verify the hierarchy and spacing of each section independently.
- When a mockup uses charts or dense data UI, inspect readability explicitly before stopping.
