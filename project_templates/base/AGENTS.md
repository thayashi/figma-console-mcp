# AGENTS.md

This file is the source of truth for project instructions, research context, and workflow expectations.

## Figma Console Usage Model

- Start the local Figma Console daemon before beginning write-heavy work.
- Open the Figma Desktop Bridge plugin in the target file and confirm the daemon and plugin are connected.
- Treat the local `figma-console` CLI as the default Figma control surface for this project.
- Treat localhost HTTP as the secondary path when CLI output or invocation is insufficient.
- Treat official Figma MCP tools as fallback-only when the user explicitly asks for MCP or the local daemon/CLI path is unavailable.
- Treat `.claude/skills/` as the workflow layer that decides how to combine those tools.

## Recommended Startup Checks

Before editing Figma, confirm runtime state in this order:

- `figma-console daemon status`
- `figma-console tools list`
- `figma-console tools show <tool>`
- `GET /v1/status`
- `GET /v1/tools`
- `GET /v1/tools/:name`
- `figma_get_status` only when the user explicitly wants MCP or the local daemon path is unavailable

Use the control surface to discover schema before invoking unfamiliar tools:

- CLI first
- localhost HTTP second
- MCP tool descriptors only as fallback

## Tool Routing Rules

For any Figma task in this project, use this priority order:

1. `figma-console daemon status`
2. `figma-console tools list`
3. `figma-console tools show <tool>`
4. `figma-console invoke <tool> ...`
5. localhost HTTP equivalents only when CLI is insufficient
6. official Figma MCP tools only if the user explicitly asks for MCP, or the local daemon/CLI path is unavailable

Do not start with official Figma MCP tools when an equivalent local CLI or localhost HTTP path exists.

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
