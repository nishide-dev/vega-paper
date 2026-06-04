---
name: vega-paper
description: Generate publication-ready academic figures with the vega-paper CLI (infer, lint, render, themes). Use when building paper figures from CSV/JSON, Vega-Lite specs, training curves, heatmaps, boxplots, or when the user mentions vega-paper, Vega-Lite charts, or figure meta sidecars.
disable-model-invocation: true
---

# VegaPaper Skill

Guide agents to produce **publication-ready SVG figures** with the VegaPaper CLI. Prefer **constrained CLI generation** over hand-written Vega-Lite unless the user already has a spec.

## Prerequisites

From the **repository root**:

```bash
bun install
bun run packages/cli/src/index.ts doctor
```

Requires Bun (see `.bun-version`) and Vega CLI binaries (`vl2svg`). Fix `doctor` failures before rendering.

## CLI prefix

Always run commands from the repo root:

```bash
bun run packages/cli/src/index.ts <command> ...
```

Do not assume a globally installed `vega-paper` binary in this repository.

## Skill scripts

Optional thin wrappers around `lint` and `render` (run from repo root). The CLI prefix above remains canonical.

```bash
bun run skills/vega-paper/scripts/validate-spec.ts figures/f1.vl.json --lint-profile paper
bun run skills/vega-paper/scripts/render-chart.ts figures/f1.vl.json --out figures/f1.svg --theme paper-clean
```

Add `--strict` to `validate-spec.ts` when warnings must fail the command.

## Constrained inputs

Before running `infer`, make these explicit (ask the user if unclear):

| Input | Required | Notes |
|-------|----------|-------|
| Data path | yes | CSV or JSON array file |
| `--chart` | yes | See chart selection |
| `--x`, `--y` | yes | Column/field names |
| `--color` | sometimes | Required for `heatmap`; optional otherwise |
| `--theme` | for SVG | e.g. `paper-clean` |
| Output paths | yes | `--spec-out` and/or `--out` |

Optional flags: `--facet`, `--aggregate`, `--error-band`, `--title`, `--width`, `--height`, `--inline-data`, `--x-type`, `--y-type`, `--color-type`.

**Do not** invent Vega-Lite JSON for the primary path. Let `infer` build the spec deterministically.

## Chart selection

Pick `--chart`, `--x`, `--y`, and optional `--color` / modifiers from the data and analytical goal. Read [Chart selection](references/chart-selection.md) for the full type table, modifier rules, repo examples, and common mistakes.

## Primary workflow (infer)

```text
1. Read user intent and inspect data columns (CSV header or JSON keys)
2. Choose chart type and encoding fields
3. Generate spec + lint
4. Fix lint issues (adjust infer flags or edit spec)
5. Render SVG + figure meta
6. Return paths: .vl.json, .svg, .meta.json
```

### Step 3 — Generate spec with lint

```bash
bun run packages/cli/src/index.ts infer DATA.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "Training F1" \
  --spec-out figures/f1.vl.json \
  --lint-profile paper
```

Use `--lint-profile paper` by default. Read [Paper style guide](references/paper-style-guide.md) for profile thresholds, lint rules, recommended sizes, and `--strict` usage.

### Step 4 — Revision loop

On lint issues:

1. Read CLI lint output (rule id, path, message).
2. Prefer fixing **infer options** (title, width/height, field types) over editing JSON — see the paper style guide for rule-by-rule fixes.
3. Re-run the same `infer` command after changes.
4. Optionally run standalone lint:

```bash
bun run packages/cli/src/index.ts lint figures/f1.vl.json --lint-profile paper
```

Repeat until clean enough for the user's goal (or until `--strict` passes if requested).

### Step 5 — Render SVG + meta

When the spec is acceptable, add `--out` and `--theme` (same infer flags as before):

```bash
bun run packages/cli/src/index.ts infer DATA.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "Training F1" \
  --spec-out figures/f1.vl.json \
  --theme paper-clean \
  --out figures/f1.svg \
  --lint-profile paper
```

This writes:

```text
figures/f1.vl.json
figures/f1.svg
figures/f1.meta.json   # provenance: command, infer snapshot, versions
```

If `--strict` lint fails, the command exits before render and **no** `.meta.json` is written.

## Secondary workflow (render)

Use when the user already has a Vega-Lite spec. Read [Vega-Lite patterns](references/vega-lite-patterns.md) for when to prefer `render`, spec requirements, repo examples, and hand-written lint.

```bash
bun run packages/cli/src/index.ts render figures/f1.vl.json \
  --theme paper-clean \
  --format svg \
  --out figures/f1.svg
```

Writes sibling `figures/f1.meta.json` with `"command": "render"`. No `infer` block in meta.

## Themes

Pass `--theme` when rendering SVG (`infer --out` or `render`). Read [Theme catalog](references/theme-catalog.md) for built-in themes, use-case guidance, and how `themes list` / `themes show` fit in.

Default for academic papers: **`paper-clean`**.

## Other commands

```bash
bun run packages/cli/src/index.ts themes show paper-clean
bun run packages/cli/src/index.ts doctor
```

## References

- [Chart selection](references/chart-selection.md) — chart types and infer modifiers
- [Theme catalog](references/theme-catalog.md) — built-in themes and selection guidance
- [Paper style guide](references/paper-style-guide.md) — lint profiles, figure sizes, and style rules
- [Vega-Lite patterns](references/vega-lite-patterns.md) — hand-written specs and the render workflow

## Agent checklist

- [ ] Data columns match `--x`, `--y`, `--color`, etc.
- [ ] Chart type fits the user's analytical goal
- [ ] `--lint-profile paper` on infer (and `--strict` only if requested)
- [ ] Final deliverable includes `.svg` and mention `.meta.json` for reproducibility
- [ ] SVG-only output in MVP (no PDF/PNG promises)
