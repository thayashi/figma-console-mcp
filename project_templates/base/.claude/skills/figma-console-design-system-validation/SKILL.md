---
name: figma-console-design-system-validation
description: Use this skill when validating components, tokens, or design-system structure in Figma. It provides the read-first validation workflow and reporting expectations.
disable-model-invocation: false
---

# Figma Design System Validation Workflow

Use Figma as the inspection and validation target for design system work.

Transport policy:
- Prefer the local `figma-console` CLI for discovery and invocation.
- Use localhost HTTP only when CLI output or invocation is insufficient.
- Use official Figma MCP tools only as fallback when the user explicitly asks for MCP or the local daemon/CLI path is unavailable.
- When using the CLI, pass tool input with `--input`, not `--args`.

Core rule:
- This workflow provides the validation procedure, not the design rules.
- The actual acceptance criteria must come from the current project's `AGENTS.md`, `figma-console.project.json`, component spec, or codebase conventions.

Required workflow:
1. Identify the target file, node, component, or component set.
2. Read the relevant design system context first.
3. Run structural and visual validation.
4. If code-side truth exists, run parity validation against that source.
5. Report concrete findings, not vague quality judgments.

Discovery sequence:
- CLI first:
  - `figma-console daemon status`
  - `figma-console tools list`
  - `figma-console tools show figma_check_design_parity`
  - `figma-console tools show figma_lint_design`
  - `figma-console invoke <tool> --input '{...}'`
- Localhost HTTP second:
  - `GET /v1/status`
  - `GET /v1/tools`
  - `GET /v1/tools/:name`
  - `POST /v1/tools/:name`
- MCP fallback:
  - `figma_get_status`
  - `figma_search_components` or `figma_get_component_details`
  - `figma_get_design_system_kit`, `figma_get_variables`, and `figma_get_styles` as needed

Primary validation tools:
- `figma_lint_design`
- `figma_capture_screenshot`
- `figma_check_design_parity`

Routing rule:
- Do not switch between CLI, HTTP, and MCP for the same validation pass unless the current path failed and the failure justifies the fallback.

Reporting rules:
- Report findings in priority order.
- Reference the exact node, component, or file when possible.
- Distinguish between:
  - rule violations
  - likely regressions
  - open questions caused by missing project-specific policy
