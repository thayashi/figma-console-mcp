---
name: figma-console-app-mockup
description: Use this preset skill for product screen and app mockup work. It extends the base Figma Console workflow with stronger screen-building and review expectations.
disable-model-invocation: false
---

# App Mockup Preset

Use this skill with the base Figma Console skills when building or updating screens in Figma.

Transport rule:
- Prefer the local `figma-console` CLI first.
- Use localhost HTTP second.
- Use official Figma MCP tools only as fallback.

Recommended local skills:

- `figma-console-mockup-workflow`
- `figma-console-structure-best-practices`
- `figma-console-design-system-validation`

Recommended optional vendor skills:

- `figma-use`
- `figma-generate-design`

Workflow emphasis:

1. Discover the active runtime and the target file.
2. Find reusable design system components before drawing primitives.
3. Build screens incrementally.
4. Review with screenshots before completion.
5. For selected-frame edits such as table row replacements, inspect once, apply one batched update, then validate once instead of repeatedly re-running the same exploratory loop.
