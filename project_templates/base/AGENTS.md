# AGENTS.md

This file is the source of truth for project instructions, research context, and workflow expectations.

## Figma Console Usage Model

- Start the local Figma Console daemon before beginning write-heavy work.
- Open the Figma Desktop Bridge plugin in the target file and confirm the daemon and plugin are connected.
- Treat the daemon, CLI, HTTP API, and MCP server as the Figma control surface.
- Treat `.claude/skills/` as the workflow layer that decides how to combine those tools.

## Recommended Startup Checks

Before editing Figma, confirm runtime state with one of:

- `figma_get_status`
- `figma-console daemon status`
- `figma-console tools list`

Use the control surface to discover schema before invoking unfamiliar tools:

- `figma-console tools show <tool>`
- `GET /v1/tools/:name`
- the MCP tool descriptor in your client

## Instruction Hierarchy

1. Follow this file first.
2. Follow the relevant skills under `.claude/skills/`.
3. Follow `figma-console.project.json` for machine-readable design preferences.
4. Follow the local codebase and existing Figma file conventions before inventing new structure.

## Included Skills

The base template includes reusable workflow skills under `.claude/skills/`:

- `figma-console-mockup-workflow`
- `figma-console-design-system-validation`
- `figma-console-structure-best-practices`

## Default Figma Editing Policy

- Prefer structured tools first.
- Use `figma_execute` only when the structured tools cannot express the required change cleanly.
- Reuse existing components, tokens, and styles before creating new primitives.
- Keep workflow guidance in skills rather than embedding it into the control surface.
- Validate visual writes with `figma_capture_screenshot`.
- Run `figma_lint_design` or `figma_check_design_parity` when the task or policy requires stronger validation.

## Project Policy

If this project uses `figma-console.project.json`, keep it aligned with the actual design system:

- preferred components and libraries
- spacing and typography preferences
- naming conventions
- validation expectations

Update this file and the local skills together when the workflow changes.
