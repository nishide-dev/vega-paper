# Boxplot (infer)

Raw sample rows for comparing score distributions across models. Vega-Lite's `boxplot` mark computes quartiles from the rows in each group.

## Boxplot by model

```bash
vega-paper infer examples/boxplot/data.csv \
  --chart boxplot \
  --x model \
  --y f1 \
  --title "F1 by model" \
  --spec-out examples/boxplot/chart.vl.json
```

## Boxplot with color grouping

Use `--color` to separate groups within each model category (for example train vs validation).

```bash
vega-paper infer examples/boxplot/data-by-split.csv \
  --chart boxplot \
  --x model \
  --y f1 \
  --color split \
  --title "F1 by model and split" \
  --spec-out examples/boxplot/chart-by-split.vl.json
```

`--aggregate` is not supported with boxplot; pass raw sample rows instead.

## Render

```bash
vega-paper render examples/boxplot/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/boxplot/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
