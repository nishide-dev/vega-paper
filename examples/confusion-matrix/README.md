# Confusion matrix (heatmap)

## Heatmap from pre-aggregated counts

```bash
vega-paper infer examples/confusion-matrix/data.csv \
  --chart heatmap \
  --x predicted \
  --y actual \
  --color count \
  --title "Confusion matrix" \
  --spec-out examples/confusion-matrix/chart.vl.json
```

## Heatmap with sum aggregation (one row per trial)

Each trial row sets `n` to `1`. Summing `n` per `(predicted, actual)` recovers cell counts.

```bash
vega-paper infer examples/confusion-matrix/trials.csv \
  --chart heatmap \
  --x predicted \
  --y actual \
  --color n \
  --aggregate sum \
  --title "Confusion matrix (from trials)" \
  --spec-out examples/confusion-matrix/chart-from-trials.vl.json
```

## Render

```bash
vega-paper render examples/confusion-matrix/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/confusion-matrix/output.svg
```
