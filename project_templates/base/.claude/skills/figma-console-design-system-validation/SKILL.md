---
name: figma-console-design-system-validation
description: Use this skill when validating components, tokens, or design-system structure in Figma. It provides the read-first validation workflow and reporting expectations.
disable-model-invocation: false
---

# Figma Design System Validation Workflow

Use Figma as the inspection and validation target for design system work.

Transport policy:
- Prefer `figma-console-mcp` MCP tools when available.
- If MCP is unavailable in this environment, fall back to the `figma-console` CLI.

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
- MCP path:
  - `figma_get_status`
  - `figma_search_components` or `figma_get_component_details`
  - `figma_get_design_system_kit`, `figma_get_variables`, and `figma_get_styles` as needed
- CLI fallback:
  - `figma-console daemon status`
  - `figma-console tools show figma_check_design_parity`
  - `figma-console tools show figma_lint_design`

Primary validation tools:
- `figma_lint_design`
- `figma_capture_screenshot`
- `figma_check_design_parity`

Reporting rules:
- Report findings in priority order.
- Reference the exact node, component, or file when possible.
- Distinguish between:
  - rule violations
  - likely regressions
  - open questions caused by missing project-specific policy
