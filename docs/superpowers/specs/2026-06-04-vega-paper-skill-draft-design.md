# VegaPaper Skill Draft Design

Date: 2026-06-04

## Context

Phase 1 CLI MVP is complete (infer, render, lint, themes, doctor, figure meta). Phase 2 adds an AI Skill so agents can use `vega-paper` with constrained generation and a lint/render revision loop.

Brainstorm decisions:

- Canonical path: `skills/vega-paper/SKILL.md` (not `packages/skill/`)
- First slice: SKILL.md only (no `references/` or `scripts/` yet)
- English prose; infer-centric workflow
- CLI invocation: `vega-paper` from repo root
- Cursor install instructions at end of SKILL.md
- Lint: `--lint-profile paper` by default; `--strict` only when user requires zero warnings

## Goals

- Add `skills/vega-paper/SKILL.md` with YAML frontmatter per Cursor skill conventions.
- Document prerequisites, chart selection, infer workflow, lint revision loop, short render path, themes, and `*.meta.json` sidecars.
- Add README pointer to the skill.
- Exclude `skills/**` from Biome (like `docs/`).

## Non-Goals

- `references/` or `scripts/` under `skills/vega-paper/` in this slice.
- Committing `.cursor/skills/` symlinks.
- npm-global `vega-paper` invocation docs (future publish).
- Skill validation CI or automated skill tests.

## SKILL.md Structure

| Section | Content |
|---------|---------|
| Frontmatter | `name: vega-paper`, third-person `description` with triggers, `disable-model-invocation: true` |
| Prerequisites | Bun, `bun install`, `doctor` |
| CLI prefix | `vega-paper` |
| Constrained inputs | chart, x, y, color, theme, paths — no free-form Vega-Lite unless render path |
| Chart selection | Rules for six chart types + aggregate/facet/error-band/heatmap constraints |
| Primary workflow | data inspect → infer + lint → fix loop → infer `--out` + meta |
| Secondary: render | Hand-written `.vl.json` → render → meta |
| Themes | four built-in theme names |
| Revision loop | read lint output; when to use `--strict` |
| Installation | symlink/copy `skills/vega-paper` → `.cursor/skills/vega-paper` |

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/SKILL.md` | **New** |
| `README.md` | Skill section + layout line |
| `biome.json` | Exclude `!**/skills` |

## Testing / Verification

- Manual: SKILL.md under 500 lines; frontmatter valid YAML.
- `bun run check` still passes (skills excluded from Biome).
