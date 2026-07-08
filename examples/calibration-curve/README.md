# Calibration curve (template)

Reliability diagram for classifier or LLM confidence calibration: mean predicted confidence per bin on x, empirical accuracy per bin on y, both on a fixed [0, 1] domain, with a dashed diagonal `y = x` reference. Points below the diagonal indicate overconfidence.

**Input must be pre-binned.** Each CSV row is one confidence bin with its mean `confidence`, empirical `accuracy`, and sample `count`. The template does not compute bins, accuracies, or calibration metrics — compute them in your evaluation code. `--ece` is a display-only annotation for a value you computed yourself; `--count` scales point size by bin population.

```bash
vega-paper template calibration-curve examples/calibration-curve/data.csv \
  --confidence confidence \
  --accuracy accuracy \
  --count count \
  --ece 0.041 \
  --title "Reliability diagram" \
  --spec-out examples/calibration-curve/chart.vl.json
```

## Render

```bash
vega-paper render examples/calibration-curve/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/calibration-curve/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
