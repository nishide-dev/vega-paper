# Ablation bar (infer)

Bar charts for component ablations and benchmark leaderboards — one of the most common ML paper figure types. Two datasets are included:

- `data.csv` — component ablation (`method,component,score,stderr`)
- `grouped.csv` — method comparison across datasets (`dataset,method,score,stderr`)

## Ablation vs leaderboard

- **Ablation:** one system, several variants with a component removed or changed. Put the varied `component` on `--x` and keep the baseline visible for reference. Answers "which parts matter?".
- **Leaderboard / benchmark comparison:** several systems evaluated on shared datasets or tasks. Put the `dataset` on `--x` and the `method` on `--color`. Answers "which system wins where?".

Both use `--chart bar`; only the field roles change.

## Ablation study

```bash
vega-paper infer examples/ablation-bar/data.csv \
  --chart bar \
  --x component \
  --y score \
  --color method \
  --title "Ablation study" \
  --width 420 \
  --height 240 \
  --spec-out examples/ablation-bar/chart.vl.json
```

## Grouped benchmark bar

```bash
vega-paper infer examples/ablation-bar/grouped.csv \
  --chart bar \
  --x dataset \
  --y score \
  --color method \
  --title "Accuracy by dataset" \
  --width 420 \
  --height 240 \
  --spec-out examples/ablation-bar/chart-grouped.vl.json
```

Vega-Lite stacks bars that share an x position, so this variant renders methods stacked per dataset — fine for quick drafts, but stacked scores read as totals. For side-by-side comparison, facet instead (`--x method --facet dataset`, drop `--color`) or wait for the planned `leaderboard-bar` template.

## Render

```bash
vega-paper render examples/ablation-bar/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/ablation-bar/output.svg
```

The `stderr` column is not used by `infer` yet; value labels, error bars, sorting, and best-method highlighting are planned as a `leaderboard-bar` template.

Committed `.vl.json` files are regenerated with `bun run infer:ablation-bar` and `bun run infer:ablation-bar-grouped` from the repo root. `output.svg` is local only.
