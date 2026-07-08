# Scaling law (template)

Compute-performance curve for foundation-model papers: x is a compute or capacity metric (FLOPs, parameters, tokens) on a log scale, y is loss or a quality score, one series per model family.

Conventions: for loss-style metrics lower is better and the curve slopes down; for score-style metrics higher is better and the curve slopes up. VegaPaper does not invert axes automatically — if you want an inverted loss axis, edit the committed spec explicitly so the figure is never silently flipped.

`--fit regression` overlays a dashed Vega-Lite regression trend per family. With `--x-scale log` the fit uses `method: "log"` (linear in log-x, the usual scaling-law reading); without it the fit is `method: "linear"`.

```bash
vega-paper template scaling-law examples/scaling-law/data.csv \
  --x flops \
  --y loss \
  --color family \
  --x-scale log \
  --fit regression \
  --title "Scaling behavior" \
  --spec-out examples/scaling-law/chart.vl.json
```

The default 360×240 size stays readable at single-column paper width; pass `--width`/`--height` to adjust.

## Render

```bash
vega-paper render examples/scaling-law/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/scaling-law/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
