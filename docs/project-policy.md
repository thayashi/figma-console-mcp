# Project Policy

Daemon-first local mode can load a project mockup policy file and expose it to runtime-aware tools.

Current search order:

1. `FIGMA_PROJECT_POLICY_PATH` if set
2. `figma-console.project.json` in the current working directory or any parent directory
3. `.figma-console/project-policy.json` in the current working directory or any parent directory

Use `figma_get_project_policy` to inspect what was loaded.

## Sample Policy

```json
{
  "version": 1,
  "projectName": "Acme Dashboard",
  "mockups": {
    "preferredFonts": ["Inter", "IBM Plex Sans"],
    "spacingScale": [4, 8, 12, 16, 24, 32, 48],
    "preferredComponents": {
      "buttons": ["Button/Primary", "Button/Secondary"],
      "inputs": ["Input/Text", "Select/Default"],
      "navigation": ["Sidebar/Default", "Topbar/App"]
    },
    "componentLibraries": [
      {
        "name": "Acme Design System",
        "fileKey": "abc123"
      }
    ],
    "naming": {
      "screenPrefix": "App",
      "layerPattern": "{screen}/{section}/{element}",
      "variantSeparator": "/"
    },
    "defaultScreenPresets": [
      {
        "name": "Desktop App",
        "width": 1440,
        "height": 1024,
        "layoutMode": "VERTICAL",
        "padding": 32
      }
    ],
    "notes": [
      "Prefer existing library components before creating new primitives.",
      "Use Auto Layout for screen, section, and card containers."
    ]
  },
  "validation": {
    "requireScreenshotReview": true,
    "requireLint": true,
    "lintRules": ["all"],
    "requireParity": false
  }
}
```
