# Run distribution (infer + hand-written overlay)

Score variability over random seeds (`method,seed,score`). ML papers report this to show that an improvement is not a lucky seed. This recipe builds on the minimal [../boxplot/](../boxplot/) example and reframes it for seed/run distributions.

## Boxplot vs raw-point overlay

- **Boxplot only** (`chart-boxplot.vl.json`): fine when each group has enough samples (roughly 10+) for quartiles to be meaningful, or when there are too many groups to show individual points.
- **Boxplot + raw points** (`chart-points.vl.json`): prefer this for the typical 3–10 seeds per method. Quartile summaries of so few samples hide the actual runs; the overlay keeps the summary while showing every seed.
- **Histogram / density:** better for hundreds of runs; planned as future `infer` chart types.

## Boxplot over seeds (infer)

```bash
vega-paper infer examples/run-distribution/data.csv \
  --chart boxplot \
  --x method \
  --y score \
  --title "Score distribution over seeds" \
  --spec-out examples/run-distribution/chart-boxplot.vl.json
```

`--aggregate` is not supported with boxplot; pass raw per-seed rows.

## Boxplot with raw points (hand-written spec)

`chart-points.vl.json` layers a translucent boxplot with per-seed points, jittered deterministically from the `seed` column so re-renders are reproducible. `infer` generates single-mark charts only, so this layered spec is hand-written.

```bash
vega-paper render examples/run-distribution/chart-points.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/run-distribution/output-points.svg
```

## Render

```bash
vega-paper render examples/run-distribution/chart-boxplot.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/run-distribution/output.svg
```

`chart-boxplot.vl.json` is regenerated with `bun run infer:run-distribution-boxplot` from the repo root. `chart-points.vl.json` is hand-written and NOT overwritten by `bun run infer:examples`. `output*.svg` files are local only.
