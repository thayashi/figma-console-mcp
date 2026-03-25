# Mockup Quality Improvement Plan

## Objective

Improve Figma mockup quality in the daemon-first branch without abandoning the current registry-based architecture.

Target outcome:

- daemon-first CLI/HTTP/MCP workflows produce mockups closer to the quality seen in `figma-relay`
- quality improvements come from reusable policy, structure rules, and review loops rather than from transport-specific prompt luck
- project-specific design rules become pluggable instead of living only in ad hoc prompts

## Working Hypothesis

The main quality gap is not "HTTP endpoint vs CLI".

The larger difference is that `figma-relay` effectively encoded three important behaviors:

1. a low-friction execution path for `figma_execute`
2. explicit structure rules for how programmatic Figma layouts should be built
3. a mandatory screenshot-based review loop after visual changes

This repository already has partial equivalents for the last two in the project templates:

- [figma-console-mockup-workflow/SKILL.md](/home/toshi/dev/figma-console-mcp/project_templates/base/.claude/skills/figma-console-mockup-workflow/SKILL.md)
- [figma-console-structure-best-practices/SKILL.md](/home/toshi/dev/figma-console-mcp/project_templates/base/.claude/skills/figma-console-structure-best-practices/SKILL.md)
- [project_templates/README.md](/home/toshi/dev/figma-console-mcp/project_templates/README.md)

The main product gap is that these rules are documented templates, but they are not yet loaded or enforced as first-class daemon-first behavior.

## Current State

What already exists:

- daemon-first runtime, registry, CLI, and HTTP transports
- near-parity registry-backed read and write tool surface
- `figma_capture_screenshot`, `figma_lint_design`, and `figma_check_design_parity`
- agent templates that already describe a good mockup workflow and structure rules

Known gap already captured in branch handoff:

- no formal project skill/config loading yet

Reference:

- [next-session-handoff.md](/home/toshi/dev/figma-console-mcp/docs/next-session-handoff.md#L357)

## Design Principles

1. Keep runtime and registry generic.
2. Make quality policy pluggable.
3. Reuse structured tools first, then fall back to `figma_execute`.
4. Treat screenshot review as part of the workflow, not as optional advice.
5. Optimize for transport-neutral quality so HTTP, CLI, and MCP converge on the same behavior.

## Scope

In scope:

- project-level mockup policy loading
- reusable structure recipes for `figma_execute`
- stronger screenshot and lint review workflows
- HTTP ergonomics that reduce friction for coding agents
- benchmark prompts and acceptance criteria

Out of scope for the first phase:

- fully automatic visual self-correction loops
- design generation from natural language alone with no project policy
- replacing the registry with a transport-specific implementation

## Workstreams

### 1. Productize project-level mockup policy

Goal:

- allow each project to declare design-system preferences and mockup rules in machine-readable config

Deliverables:

- a project config format for:
  - preferred fonts
  - spacing scale
  - color/token usage rules
  - preferred component/library keys
  - naming conventions
  - default screen/frame skeletons
  - validation expectations
- runtime loading for that config
- transport-neutral exposure so CLI, HTTP, and MCP can all use the same policy

Why this matters:

- the existing templates are useful, but they depend on the agent remembering to apply them
- quality becomes more repeatable once policy is loaded into the workflow instead of remaining prompt-only

Suggested implementation shape:

- add a lightweight project policy loader under a daemon/runtime-facing module
- keep the config generic enough for mockup generation, design-system validation, and parity checks
- start with read-only loading before adding mutation or authoring tools

Acceptance criteria:

- a project can declare preferred components/tokens without editing source code
- generated mockups can reference those preferences consistently across transports

### 2. Add first-class `figma_execute` structure recipes

Goal:

- reduce low-quality raw Plugin API code by giving agents reusable layout patterns

Deliverables:

- a recipe set derived from existing best practices for:
  - page layout
  - card stack
  - toolbar/header
  - modal/dialog
  - settings form
  - list/table
  - dashboard sections
  - component/variant creation
- docs and examples that show when to use structured tools vs `figma_execute`

Why this matters:

- `figma-relay` quality improved because the execution path carried detailed structure rules
- today, the same rules exist mainly as documentation and comments

Suggested implementation shape:

- create a recipe module or doc-backed prompt asset that can be surfaced in HTTP/CLI help
- encode rules such as:
  - Frames over Groups
  - Auto Layout by default
  - `appendChild()` before `layoutSizing*`
  - `HUG` and `FILL` over unnecessary fixed sizes
  - font loading before text writes
  - normalized color values

Acceptance criteria:

- new mockup examples no longer rely on ad hoc absolute positioning for normal UI layout
- the default generated structure is Figma-native and easy to edit manually afterward

### 3. Make screenshot review a standard completion loop

Goal:

- ensure visual QA happens by default after write operations

Deliverables:

- explicit workflow guidance in transport help and docs
- recommended post-write flow:
  - write
  - screenshot
  - lint if structure quality matters
  - revise at least once when obvious issues appear
- final-user guidance that includes showing the final screenshot

Why this matters:

- `design-review.md` in `figma-relay` treated screenshot review as mandatory
- this repo already recommends validation, but recommendation is weaker than enforced workflow

Suggested implementation shape:

- strengthen help text and examples around post-write validation
- where feasible, return clearer `next step` guidance from write flows
- keep the screenshot step transport-neutral

Acceptance criteria:

- mockup-oriented docs consistently show screenshot validation before completion
- benchmark tasks include a final screenshot artifact

### 4. Improve HTTP ergonomics without forking architecture

Goal:

- make daemon-first HTTP just as easy for coding agents as the `figma-relay` bridge, without splitting the product into separate stacks

Deliverables:

- evaluate HTTP aliases for:
  - `POST /v1/execute`
  - `POST /v1/screenshot`
- keep them as convenience wrappers over registry-backed tools rather than a separate implementation path

Why this matters:

- low friction affects whether agents actually use the best workflow
- easier invocation can improve output quality indirectly by making iterative review cheaper

Acceptance criteria:

- HTTP users can perform the common "execute then screenshot" loop with minimal ceremony
- the registry remains the single source of truth

### 5. Add a mockup-quality lint preset

Goal:

- detect structurally weak mockups even when the screenshot looks acceptable

Deliverables:

- a lint preset or rule grouping focused on mockup generation quality

Candidate checks:

- excessive absolute positioning
- frames without Auto Layout where layout intent is obvious
- poor naming hygiene
- likely token/style bypass
- unreadable text sizing or wrapping issues
- suspicious chart/table structure

Acceptance criteria:

- mockup tasks can run one quality-oriented lint profile after creation
- results clearly distinguish visual polish issues from structural issues

### 6. Build a benchmark harness for quality comparison

Goal:

- evaluate improvements against a repeatable set of prompts instead of anecdotal comparison

Deliverables:

- 5 benchmark prompts:
  - dashboard
  - settings page
  - modal flow
  - data table
  - marketing/product overview screen
- per-run capture requirements:
  - final screenshot
  - lint output
  - notes on manual cleanup required

Suggested scoring dimensions:

- structure quality
- visual coherence
- design-system reuse
- editability in Figma after generation
- amount of manual cleanup

Acceptance criteria:

- we can compare current daemon-first output vs improved output on the same prompt set
- changes are judged by artifacts, not memory

## Recommended Delivery Order

Phase 1:

1. formalize project-level mockup policy loading
2. expose first-class structure recipes
3. strengthen screenshot review guidance

Phase 2:

1. add HTTP convenience aliases
2. add mockup-quality lint preset

Phase 3:

1. build benchmark prompts and scoring rubric
2. run A/B comparisons against the current branch and `figma-relay`

## Issue Breakdown

### Issue 1: Project policy loader

- define config schema
- define search/load behavior
- expose loaded policy to tool handlers and transports
- document one sample project policy file

### Issue 2: Mockup recipe library

- extract canonical structure rules from existing templates
- add recipe docs/examples for common screen patterns
- connect recipes to `figma_execute` usage guidance

### Issue 3: Review loop hardening

- update docs/help so write flows explicitly end in screenshot validation
- make final screenshot part of the standard mockup workflow
- tighten examples around revise-after-review

### Issue 4: HTTP ergonomic wrappers

- add alias endpoints over registry tools
- keep response shapes consistent with existing HTTP meta envelopes
- document minimal examples for coding agents

### Issue 5: Mockup lint preset

- define rules
- implement preset
- add regression coverage

### Issue 6: Benchmark suite

- define prompt set
- define scoring sheet
- capture before/after screenshots and findings

## Risks

- if policy loading is too project-specific too early, the daemon layer may become hard to keep generic
- if `figma_execute` remains the default path for everything, quality will still depend too much on prompt phrasing
- if review stays optional, agents will continue to stop after first-pass generation

## Immediate Next Action

Start with Issue 1 and Issue 2 together.

Reason:

- the repo already has strong documentation templates
- the highest leverage move is to turn those templates into reusable runtime-facing policy and recipe inputs
- once that exists, the screenshot review loop and HTTP ergonomics become easier to standardize
