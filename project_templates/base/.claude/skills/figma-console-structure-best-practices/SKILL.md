---
name: figma-console-structure-best-practices
description: Use this skill as a structural checklist when creating or editing Figma mockups through Figma Console.
disable-model-invocation: false
---

# Figma Structure Best Practices

Use these rules when creating or editing mockups through `figma-console`.

These are intentionally generic. Project-specific visual direction belongs in `AGENTS.md`, `figma-console.project.json`, or additional local skills.

## Core Rules

1. Use Frames, not Groups.
2. Default to Auto Layout for app screens, sections, cards, rows, and stacked content.
3. Treat each screen as its own top-level screen Frame.
4. Give every structural Frame an intentional `layoutMode`.
5. Use padding and `itemSpacing` for layout before reaching for manual offsets.
6. Avoid manual `x` / `y` positioning inside Auto Layout containers.
7. Prefer `HUG` and `FILL` sizing behavior over fixed sizes when the layout should adapt.
8. Use transparent fills for structure-only frames.
9. Load fonts before setting text content in raw Plugin API code.
10. Normalize colors to Figma's 0-1 RGB values in Plugin API code.

## Tooling Guidance

- Prefer structured tools first:
  - `figma_instantiate_component`
  - `figma_create_child`
  - `figma_set_text_content`
  - `figma_set_fills`
  - `figma_move_node`
  - `figma_resize_node`
- Use `figma_execute` only when the higher-level tools cannot express the required structure cleanly.
- Treat `figma_execute` as a low-level escape hatch, not as the default construction tool.

## Validation Guidance

- Validate every generated mockup with `figma_capture_screenshot`.
- Also run `figma_lint_design` when layout or accessibility quality matters.
- If the generated mockup looks visually correct but structurally weak, fix the structure anyway.
