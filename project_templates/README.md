# Project Templates

This directory contains project-level starter files for teams using Figma Console MCP as a daemon-first Figma control surface.

Each template folder is intended to be copied into a project root so that the final project contains files such as:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/skills/`
- `figma-console.project.json`

## Layout

- `base/`
  - The smallest recommended starting point.
  - Includes a source-of-truth `AGENTS.md`, a thin `CLAUDE.md` alias, a starter `figma-console.project.json`, and reusable Figma workflow skills.
- `app-mockup/`
  - Additive guidance for building and reviewing product mockups or screens in Figma.
- `design-system/`
  - Additive guidance for creating or validating tokens, components, and library structure.
- `code-connect/`
  - Additive guidance for Code Connect mapping workflows.
- `vendor/figma-official-skills/`
  - Unmodified upstream-style Figma skill content copied into this repository as a reference source.
  - Copy only the official skills you actually need into a project's `.claude/skills/`.

## Recommended Usage

1. Copy `base/` into your project root.
2. Optionally merge one or more preset folders:
   - `app-mockup/`
   - `design-system/`
   - `code-connect/`
3. Copy selected official skills from `vendor/figma-official-skills/` into the project's `.claude/skills/` when your workflow needs them.
4. Customize:
   - `AGENTS.md`
   - `figma-console.project.json`
   - any project-specific skills under `.claude/skills/`

## Conventions

- `AGENTS.md` is the source of truth for project instructions.
- `CLAUDE.md` is a thin alias that points back to `AGENTS.md`.
- Workflow logic should live in skills.
- The daemon, CLI, HTTP API, and MCP server remain the thin Figma control surface.
