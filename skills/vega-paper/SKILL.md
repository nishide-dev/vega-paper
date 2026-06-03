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

| Goal | `--chart` | Notes |
|------|-----------|-------|
| Metric vs step/time | `line` | Training curves, learning curves |
| Category comparison | `bar` | Set `--x` to category, `--y` to measure |
| Two numeric variables | `scatter` | Correlation, embeddings |
| Trend with area fill | `area` | Same encodings as line |
| Grid/cell counts | `heatmap` | **Requires** distinct `--x`, `--y`, `--color` |
| Distribution by group | `boxplot` | Distinct `--x` (category) and `--y` (measure) |

Modifiers:

- **`--aggregate`**: `mean`, `median`, `sum`, `count`, `min`, `max` — not with `boxplot`
- **`--facet`**: small multiples; field must differ from `--x`, `--y`, `--color`
- **`--error-band`**: symmetric y error field — cartesian charts only; not with `heatmap`, `boxplot`, or `--aggregate`

Copy-paste examples: [`examples/`](../../examples/README.md).

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

Use `--lint-profile paper` unless the user asks for `web` or `acl`.

Add `--strict` **only** when the user wants warnings to block the command (CI-like). Default: read warnings and fix without `--strict`.

### Step 4 — Revision loop

On lint issues:

1. Read CLI lint output (rule id, path, message).
2. Prefer fixing **infer options** (title, width/height, field types) over editing JSON.
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

Use when the user already has a Vega-Lite spec (e.g. `examples/basic-line/chart.vl.json`):

```bash
bun run packages/cli/src/index.ts render figures/f1.vl.json \
  --theme paper-clean \
  --format svg \
  --out figures/f1.svg
```

Writes sibling `figures/f1.meta.json` with `"command": "render"`. No `infer` block in meta.

## Themes

List themes:

```bash
bun run packages/cli/src/index.ts themes list
```

Built-in names: `paper-clean`, `acl-clean`, `shadcn-light`, `monochrome-print`.

Default recommendation for papers: **`paper-clean`**.

## Other commands

```bash
bun run packages/cli/src/index.ts themes show paper-clean
bun run packages/cli/src/index.ts doctor
```

## Agent checklist

- [ ] Data columns match `--x`, `--y`, `--color`, etc.
- [ ] Chart type fits the user's analytical goal
- [ ] `--lint-profile paper` on infer (and `--strict` only if requested)
- [ ] Final deliverable includes `.svg` and mention `.meta.json` for reproducibility
- [ ] SVG-only output in MVP (no PDF/PNG promises)

## Installation (Cursor)

Canonical skill files live in `skills/vega-paper/`. To enable in Cursor, symlink from the repo root (do not commit the symlink):

```bash
mkdir -p .cursor/skills
ln -sfn "$(pwd)/skills/vega-paper" .cursor/skills/vega-paper
```

Alternatively, copy `skills/vega-paper` into `.cursor/skills/vega-paper`.

Reload Cursor or start a new agent session after linking.
