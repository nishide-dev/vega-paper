# Training curve (infer)

CSV inputs for `vega-paper infer` line charts. `data.csv` has one row per epoch and model. `runs.csv` has duplicate keys so `--aggregate` is meaningful. `data-with-error.csv` adds a symmetric standard-error column for `--error-band`.

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

## Line chart with error band

`f1_se` is a symmetric standard-error magnitude. On `--chart line`, `--error-band` generates a layered spec: a shaded `errorband` layer (`extent: "stderr"`, `opacity: 0.25`) drawn behind a `line` layer — the shaded uncertainty band expected for learning curves. Error **bars** (per-point whiskers) are different: on `bar`, `scatter`, and `area` charts the same flag maps to `encoding.yError` instead. Do not combine with `--aggregate`.

```bash
vega-paper infer examples/training-curve/data-with-error.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --error-band f1_se \
  --title "Training F1 with standard error" \
  --spec-out examples/training-curve/chart-error-band.vl.json
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
