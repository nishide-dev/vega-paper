# Faceted training curves

Same metrics split into train and validation panels with `--facet`.

## Faceted line chart

```bash
vega-paper infer examples/faceted-training/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --facet split \
  --title "F1 by split" \
  --spec-out examples/faceted-training/chart.vl.json
```

## Render

```bash
vega-paper render examples/faceted-training/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/faceted-training/output.svg
```
