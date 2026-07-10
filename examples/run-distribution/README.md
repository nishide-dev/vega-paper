# Run distribution (infer + templates + hand-written overlay)

Score variability over random seeds (`method,seed,score`). ML papers report this to show that an improvement is not a lucky seed. This recipe builds on the minimal [../boxplot/](../boxplot/) example and reframes it for seed/run distributions.

## Picking a view

- **Boxplot only** (`chart-boxplot.vl.json`): fine when each group has enough samples (roughly 10+) for quartiles to be meaningful, or when there are too many groups to show individual points.
- **Boxplot + raw points** (`chart-points.vl.json`): prefer this for the typical 3–10 seeds per method. Quartile summaries of so few samples hide the actual runs; the overlay keeps the summary while showing every seed.
- **Violin** (`chart-violin.vl.json`): with ~15+ runs per method, shows the full distribution shape (skew, bimodality) that quartiles hide. Uses `runs.csv` (20 seeds per method).
- **ECDF** (`chart-ecdf.vl.json`): reads percentiles directly ("what fraction of runs score below x"); a right-shifted curve dominates at every quantile. Best for stochastic-dominance claims.

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

## Violin over seeds (template)

One mirrored kernel-density per method, faceted side by side on a shared score axis. The density extent is padded past the data by ~1.5 kernel bandwidths so every violin tapers to a point instead of ending in a clipped flat edge. Tune smoothing with `--bandwidth <factor>` (a multiplier of the auto bandwidth).

```bash
vega-paper template violin examples/run-distribution/runs.csv \
  --x method \
  --y score \
  --title "Score distribution over seeds" \
  --spec-out examples/run-distribution/chart-violin.vl.json
```

## ECDF over seeds (template)

Cumulative proportion of runs at or below each score, one step curve per method, normalized per group so every curve ends at 1.0.

```bash
vega-paper template ecdf examples/run-distribution/runs.csv \
  --x score \
  --color method \
  --title "Score ECDF by method" \
  --spec-out examples/run-distribution/chart-ecdf.vl.json
```

`chart-boxplot.vl.json` is regenerated with `bun run infer:run-distribution-boxplot` from the repo root; `chart-violin.vl.json` and `chart-ecdf.vl.json` with `bun run template:violin` and `bun run template:ecdf` (both included in `bun run template:examples`). `chart-points.vl.json` is hand-written and NOT overwritten by `bun run infer:examples`. `output*.svg` files are local only.
