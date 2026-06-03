# Training curve (infer)

CSV inputs for `vega-paper infer` line charts. `data.csv` has one row per epoch and model. `runs.csv` has duplicate keys so `--aggregate` is meaningful.

## Line chart (clean data)

```bash
vega-paper infer examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "Training F1" \
  --spec-out examples/training-curve/chart.vl.json
```

## Line chart with mean aggregation (raw runs)

```bash
vega-paper infer examples/training-curve/runs.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --aggregate mean \
  --title "Training F1 (mean over runs)" \
  --spec-out examples/training-curve/chart-aggregate.vl.json
```

## Render

```bash
vega-paper render examples/training-curve/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/training-curve/output.svg
```

## Lint

```bash
vega-paper lint examples/training-curve/chart.vl.json --lint-profile paper
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
