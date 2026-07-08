# Pareto frontier (template)

Quality/resource trade-off scatter: each point is a model, x is a resource metric (latency, parameters, FLOPs, cost), y is a quality score. Points to the upper-left dominate: they are better and cheaper. Typical ML paper uses: accuracy vs latency, score vs parameter count, loss vs FLOPs.

The `--frontier max-y-min-x` line connects the non-dominated points (no other point has lower-or-equal x and a higher y). The frontier is computed by the CLI from the CSV rows when the spec is generated and embedded inline in the spec; the scatter and label layers still read `data.csv`, so regenerating the spec after editing the data also refreshes the frontier.

```bash
vega-paper template pareto-frontier examples/pareto-frontier/data.csv \
  --x latency_ms \
  --y score \
  --label model \
  --color family \
  --size params_b \
  --x-scale log \
  --frontier max-y-min-x \
  --title "Score vs latency" \
  --spec-out examples/pareto-frontier/chart.vl.json
```

Use `--x-scale log` whenever the resource axis spans an order of magnitude or more. Keep `--label` to a handful of points; dense labels overlap at paper sizes.

## Render

```bash
vega-paper render examples/pareto-frontier/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/pareto-frontier/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
