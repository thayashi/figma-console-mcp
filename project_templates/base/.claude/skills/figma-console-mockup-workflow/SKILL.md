---
name: figma-console-mockup-workflow
description: Use this skill when creating or updating product mockups in Figma through Figma Console. It provides the workflow for discovery, component reuse, structured writes, and validation.
disable-model-invocation: false
---

# Figma Mockup Workflow

Use Figma as an execution surface for product mockups.

Transport policy:
- Prefer the local `figma-console` CLI for discovery and invocation.
- Use localhost HTTP only when CLI output or invocation is insufficient.
- Use official Figma MCP tools only as fallback when the user explicitly asks for MCP or the local daemon/CLI path is unavailable.
- When using the CLI, pass tool input with `--input`, not `--args`.

Core rule:
- This workflow does not invent design policy on its own.
- It must follow the current project's `AGENTS.md`, `figma-console.project.json`, and any additional local skills in `.claude/skills/`.

Required workflow:
1. Discover the active runtime and target file before editing anything.
2. Read existing design system context before creating new primitives.
3. Prefer existing components and tokens over ad hoc shapes and values.
4. Build the mockup incrementally with focused edits and proper Figma structure.
5. Validate the result visually, then iterate at least once if structure or visual quality is weak.

Discovery sequence:
- CLI first:
  - `figma-console daemon status`
  - `figma-console tools list`
  - `figma-console tools show <tool>`
  - `figma-console invoke <tool> --input '{...}'`
- Localhost HTTP second:
  - `GET /v1/status`
  - `GET /v1/tools`
  - `GET /v1/tools/:name`
  - `POST /v1/tools/:name`
- MCP fallback:
  - `figma_get_status`
  - `figma_get_selection`
  - `figma_search_components`
  - `figma_get_design_system_kit` or `figma_get_variables` / `figma_get_styles` when needed

Selection-targeted edit loop:
1. Check daemon health with `figma-console daemon status`.
2. Read the current selection with `figma-console invoke figma_get_selection --input '{}'`.
3. Capture the selected node once with `figma-console invoke figma_capture_screenshot --input '{"nodeId":"<selected-id>","format":"PNG","scale":2}'` when visible content matters.
4. If the task is a content replacement inside the selected frame, prefer one targeted inspection pass over repeated exploratory writes.
5. If structured tools cannot reach the needed nested text nodes cleanly, use one focused `figma_execute` read pass to enumerate the relevant descendants, then one focused `figma_execute` write pass to apply the replacements.
6. Capture one final screenshot after the batched edit instead of re-running the same write loop repeatedly.

Creation strategy:
- First choice: `figma_instantiate_component`
- Then use:
  - `figma_set_instance_properties`
  - `figma_create_child`
  - `figma_set_text_content`
  - `figma_set_fills`
  - `figma_set_strokes`
  - `figma_move_node`
  - `figma_resize_node`
  - `figma_set_corner_radius`
  - `figma_arrange_component_set` when organizing variants
- Use `figma_execute` only if the structured tools cannot express the required change cleanly.
- Treat `figma_execute` as a low-level escape hatch, not the default editing path.
- Do not bounce between CLI, HTTP, and MCP for the same edit unless one path has actually failed and the failure explains why a fallback is necessary.

Design system rules:
- Reuse published components whenever a suitable component exists.
- Reuse variable-backed values and existing styles whenever possible.
- Do not create duplicate components or token names unless the project instructions explicitly require it.
- Keep all new work inside an intentional parent frame or section.
- Follow the structure rules in `../figma-structure-best-practices/SKILL.md`.

Validation before completion:
- Inspect schema before first use of an unfamiliar tool.
- Always run `figma_capture_screenshot`.
- Also run `figma_lint_design` when structural quality matters.
- If the project defines code-side or spec-side expectations, also run `figma_check_design_parity`.
- If the screenshot or lint results show weak structure, poor spacing, or overuse of manual positioning, revise the mockup before stopping.

Stop condition:
- Stop only after the mockup exists in Figma, the intended hierarchy is in place, and at least one validation pass has been completed.
