---
name: figma-console-code-connect
description: Use this preset skill for Code Connect workflows that map published Figma components to real code components.
disable-model-invocation: false
---

# Code Connect Preset

Use this skill when the primary goal is to connect design components to code.

Recommended local skills:

- `figma-console-design-system-validation`

Recommended optional vendor skills:

- `figma-code-connect-components`

Workflow emphasis:

1. Confirm the selected Figma components are published.
2. Discover candidate code components in the repository.
3. Compare props and variant structure before mapping.
4. Ask for confirmation when more than one code component is plausible.
