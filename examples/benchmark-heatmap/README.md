# Benchmark heatmap (infer + hand-written labels)

Model × task score matrix (`model,task,score`) — the figure equivalent of a benchmark results table. The sample data covers 4 models × 5 tasks.

## When to prefer a heatmap over a table

- Use a **heatmap** when the point is the *pattern*: which model dominates, which tasks are hard, where a method helps or hurts. Color makes row/column structure visible at a glance.
- Use a **table** when readers must cite *exact* numbers, when metrics have mixed scales, or when significance markers matter more than trends.
- The labeled variant below is the middle ground: color for pattern, text for exact scores. Prefer it while the grid stays small (roughly up to 10 × 10 cells).

## Basic heatmap (infer)

```bash
vega-paper infer examples/benchmark-heatmap/data.csv \
  --chart heatmap \
  --x task \
  --y model \
  --color score \
  --title "Benchmark results" \
  --width 420 \
  --height 240 \
  --spec-out examples/benchmark-heatmap/chart.vl.json
```

## Labeled heatmap (hand-written spec)

`chart-labeled.vl.json` is a hand-written layered Vega-Lite spec — a `rect` color layer plus a `text` label layer — because `infer` generates single-mark charts only. Render it directly:

```bash
vega-paper render examples/benchmark-heatmap/chart-labeled.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/benchmark-heatmap/output-labeled.svg
```

Label color flips to white on dark cells via a `condition` on the score; adjust the `datum.score > 70` threshold to your score range when reusing the spec. A `benchmark-heatmap` template command that generates this shape (plus best-score highlighting) is planned.

## Render / lint

```bash
vega-paper render examples/benchmark-heatmap/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/benchmark-heatmap/output.svg

vega-paper lint examples/benchmark-heatmap/chart.vl.json --profile paper
```

`chart.vl.json` is regenerated with `bun run infer:benchmark-heatmap` from the repo root. `chart-labeled.vl.json` is hand-written and NOT overwritten by `bun run infer:examples`. `output*.svg` files are local only.
