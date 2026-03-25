# Mockup Lint Preset

`figma_lint_design` now supports a `mockup-quality` preset for mockup review loops.

Use it when you want a focused lint pass for generated screens, forms, tables, and dashboards without defaulting to the entire lint surface.

Current preset expansion:

- `no-autolayout`
- `empty-container`
- `default-name`
- `detached-component`
- `hardcoded-color`
- `no-text-style`
- `wcag-text-size`
- `wcag-line-height`

## Example

```bash
PATH="$HOME/.volta/bin:$PATH" node dist/daemon/server.js invoke figma_lint_design --input '{"nodeId":"123:456","preset":"mockup-quality","maxDepth":10,"maxFindings":50}'
```

HTTP:

```bash
curl -s -X POST http://127.0.0.1:3847/v1/tools/figma_lint_design \
  -H 'Content-Type: application/json' \
  -d '{"input":{"nodeId":"123:456","preset":"mockup-quality","maxDepth":10,"maxFindings":50}}'
```

The response includes `lintRequest.resolvedRules` so you can see the exact rule IDs sent to the plugin runtime.
