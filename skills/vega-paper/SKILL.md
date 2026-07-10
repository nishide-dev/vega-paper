---
name: vega-paper
description: Generate publication-ready academic figures with the vega-paper CLI (infer, template, lint, render, themes). Use when building paper figures from CSV/JSON, Vega-Lite specs, training curves, heatmaps, boxplots, Pareto/scaling/calibration figures, multipanel layouts, or when the user mentions vega-paper, Vega-Lite charts, or figure meta sidecars.
disable-model-invocation: true
---

# VegaPaper Skill

Guide agents to produce **publication-ready figures** with the VegaPaper CLI. Prefer **constrained CLI generation** over hand-written Vega-Lite unless the user already has a spec.

## Prerequisites

Run before any render:

```bash
vega-paper doctor
```

If `vega-paper` is not on PATH, install from [README Install](../../../README.md#install) or, for vega-paper monorepo contributors, `bash scripts/install.sh --from-repo`.

Requires Vega CLI binaries (`vl2svg`, `vl2png`, `vl2pdf`, …). Fix `doctor` failures before rendering.

## CLI invocation

**IRON RULE:** Use `vega-paper <subcommand> …` for all CLI operations. Do not use `bun run packages/cli/src/index.ts`.

```bash
vega-paper <command> ...
```

## Constrained inputs

Before running `infer`, make these explicit (ask the user if unclear):

| Input | Required | Notes |
|-------|----------|-------|
| Data path | yes | CSV or JSON array file |
| `--chart` | yes | See chart selection |
| `--x`, `--y` | yes | Column/field names |
| `--color` | sometimes | Required for `heatmap`; optional otherwise |
| `--theme` | when rendering | built-in name (e.g. `paper-clean`) or path to theme JSON |
| `--format` | when rendering | `svg` (default for papers), `png`, or `pdf` — match `--out` extension |
| `--scale` | png/pdf | resolution factor (e.g. `2` for 2× PNG/PDF pixels) |
| Output paths | yes | `--spec-out` and/or `--out` |

Optional flags: `--facet`, `--aggregate`, `--error-band`, `--title`, `--width`, `--height`, `--inline-data`, `--x-type`, `--y-type`, `--color-type`.

**Do not** invent Vega-Lite JSON for the primary path. Let `infer` or `template` build the spec deterministically.

## When to use `infer` vs `template` vs hand-written specs

| Path | Use when |
|------|----------|
| **`infer`** | Tabular CSV/JSON and one of the six `--chart` types fits (line, bar, scatter, area, heatmap, boxplot) |
| **`template`** | Structured ML figures needing layers, labels, computed overlays, distribution transforms, or log scales — e.g. labeled heatmap, Pareto frontier, scaling law, calibration curve, violin, ECDF, multipanel composition |
| **Hand-written `.vl.json` + `render`** | Custom layouts `infer`/`template` do not cover yet; edit committed examples under `examples/` |

See [Chart selection](references/chart-selection.md) for `infer` charts; template names: `benchmark-heatmap`, `pareto-frontier`, `scaling-law`, `calibration-curve`, `violin`, `ecdf`, `multipanel`.

## Chart selection

Pick `--chart`, `--x`, `--y`, and optional `--color` / modifiers from the data and analytical goal. Read [Chart selection](references/chart-selection.md) for the decision guide, type table, modifier rules, repo examples, and common mistakes.

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
vega-paper infer DATA.csv \
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
vega-paper lint figures/f1.vl.json --profile paper
```

Repeat until clean enough for the user's goal (or until `--strict` passes if requested).

### Step 5 — Render SVG + meta

When the spec is acceptable, add `--out` and `--theme` (same infer flags as before):

```bash
vega-paper infer DATA.csv \
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

## Template workflow (structured ML figures)

Use when the figure needs layers, annotations, or computed fields that `infer` does not emit:

```bash
vega-paper template pareto-frontier examples/pareto-frontier/data.csv \
  --x latency_ms \
  --y score \
  --label model \
  --color family \
  --x-scale log \
  --frontier max-y-min-x \
  --title "Score vs latency" \
  --spec-out figures/pareto.vl.json \
  --theme paper-clean \
  --out figures/pareto.svg
```

Distribution over seeds/runs (prefer `violin` for shape with ~15+ runs per group, `ecdf` for percentile reads; `infer --chart boxplot` covers small n):

```bash
vega-paper template violin examples/run-distribution/runs.csv \
  --x method \
  --y score \
  --spec-out figures/violin.vl.json

vega-paper template ecdf examples/run-distribution/runs.csv \
  --x score \
  --color method \
  --spec-out figures/ecdf.vl.json
```

Compose existing specs into a labeled multi-panel figure (no CSV argument):

```bash
vega-paper template multipanel \
  --panel figures/curve.vl.json:a:Training \
  --panel figures/ablation.vl.json:b:Ablation \
  --layout hconcat \
  --spec-out figures/composite.vl.json
```

Regenerate committed template examples from the repo root: `bun run template:examples`. For ML-specific lint rules (panel labels, series count, log-scale hints), add `--domain ml` to standalone `lint`.

## Secondary workflow (render)

Use when the user already has a Vega-Lite spec. Read [Vega-Lite patterns](references/vega-lite-patterns.md) for when to prefer `render`, spec requirements, repo examples, and hand-written lint.

```bash
vega-paper render figures/f1.vl.json \
  --theme paper-clean \
  --format svg \
  --out figures/f1.svg
```

Writes sibling `figures/f1.meta.json` with `"command": "render"`. No `infer` block in meta.

## Themes

Pass `--theme` when rendering (`infer --out` or `render`). Read [Theme catalog](references/theme-catalog.md) for built-in themes, use-case guidance, and how `themes list` / `themes show` fit in.

Default for academic papers: **`paper-clean`**.

## Other commands

```bash
vega-paper themes show paper-clean
vega-paper doctor
```

## References

- [Chart selection](references/chart-selection.md) — chart types and infer modifiers
- [Theme catalog](references/theme-catalog.md) — built-in themes and selection guidance
- [Paper style guide](references/paper-style-guide.md) — lint profiles, figure sizes, LaTeX notes, and style rules
- [Vega-Lite patterns](references/vega-lite-patterns.md) — hand-written specs, snippets, and the render workflow

## Agent checklist

- [ ] Data columns match `--x`, `--y`, `--color`, etc.
- [ ] Chart type fits the user's analytical goal (`infer`, `template`, or hand-written path chosen deliberately)
- [ ] `--lint-profile paper` on infer/template render path (and `--strict` only if requested)
- [ ] For ML conference figures, consider `vega-paper lint SPEC.vl.json --profile paper --domain ml`
- [ ] Output format matches user goal (`svg` for papers; `png` / `pdf` when requested)
- [ ] Commands in notes use `vega-paper`, not monorepo `bun run` paths
- [ ] Final deliverable includes rendered output and mention `.meta.json` for reproducibility
