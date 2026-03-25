---
name: figma-console-design-system
description: Use this preset skill for token, component-library, and design-system workflows in Figma.
disable-model-invocation: false
---

# Design System Preset

Use this skill with the base Figma Console skills when creating or maintaining a Figma design system.

Transport rule:
- Prefer the local `figma-console` CLI first.
- Use localhost HTTP second.
- Use official Figma MCP tools only as fallback.

Recommended local skills:

- `figma-console-design-system-validation`
- `figma-console-structure-best-practices`

Recommended optional vendor skills:

- `figma-use`
- `figma-generate-library`
- `figma-create-design-system-rules`

Workflow emphasis:

1. Inspect existing conventions first.
2. Create or validate variables and styles before components.
3. Build component families incrementally.
4. Validate naming, bindings, and screenshots after each major step.
