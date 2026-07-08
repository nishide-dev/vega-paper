# VegaPaper examples

Small datasets and reference Vega-Lite specs for trying the CLI. Each folder has a README with exact commands.

| Folder | Demonstrates |
|--------|----------------|
| [basic-line/](basic-line/) | Hand-written spec; `render` and `lint` |
| [training-curve/](training-curve/) | `infer` line chart; `--aggregate mean`; `--error-band` shaded band |
| [confusion-matrix/](confusion-matrix/) | `infer` heatmap; sum aggregation from trial rows |
| [faceted-training/](faceted-training/) | `infer` with `--facet` small multiples |
| [boxplot/](boxplot/) | `infer` boxplot from raw sample rows; optional `--color` grouping |
| [embedding-scatter/](embedding-scatter/) | `infer` scatter; 2D embedding with `--color` |
| [multipanel-paper-figure/](multipanel-paper-figure/) | Hand-written `hconcat` spec with `(a)`/`(b)`/`(c)` panel labels; `template multipanel` composition |
| [ablation-bar/](ablation-bar/) | `infer` bar; ablation and grouped benchmark comparison |
| [benchmark-heatmap/](benchmark-heatmap/) | `infer` heatmap; hand-written labeled variant (rect + text) |
| [run-distribution/](run-distribution/) | `infer` boxplot over seeds; hand-written boxplot + raw points overlay |
| [pareto-frontier/](pareto-frontier/) | `template` Pareto frontier scatter with log-x and frontier overlay |
| [scaling-law/](scaling-law/) | `template` scaling law with log-x and optional regression fit |
| [calibration-curve/](calibration-curve/) | `template` reliability diagram with ECE annotation |
| [theme-samples/](theme-samples/) | Same spec rendered with every built-in theme |

## Gallery

Committed PNG previews (`paper-clean` unless noted). Theme comparison: [root README](../README.md#figure-previews).

| Example | Preview |
|---------|---------|
| [basic-line/](basic-line/) | ![basic-line](../docs/assets/gallery/examples/basic-line.png) |
| [training-curve/](training-curve/) | ![training-curve](../docs/assets/gallery/examples/training-curve.png) |
| [training-curve/](training-curve/) error band | ![training-curve-error-band](../docs/assets/gallery/examples/training-curve-error-band.png) |
| [confusion-matrix/](confusion-matrix/) | ![confusion-matrix](../docs/assets/gallery/examples/confusion-matrix.png) |
| [faceted-training/](faceted-training/) | ![faceted-training](../docs/assets/gallery/examples/faceted-training.png) |
| [boxplot/](boxplot/) | ![boxplot](../docs/assets/gallery/examples/boxplot.png) |
| [embedding-scatter/](embedding-scatter/) | ![embedding-scatter](../docs/assets/gallery/examples/embedding-scatter.png) |
| [ablation-bar/](ablation-bar/) | ![ablation-bar](../docs/assets/gallery/examples/ablation-bar.png) |
| [benchmark-heatmap/](benchmark-heatmap/) | ![benchmark-heatmap](../docs/assets/gallery/examples/benchmark-heatmap.png) |
| [run-distribution/](run-distribution/) | ![run-distribution](../docs/assets/gallery/examples/run-distribution.png) |
| [pareto-frontier/](pareto-frontier/) | ![pareto-frontier](../docs/assets/gallery/examples/pareto-frontier.png) |
| [scaling-law/](scaling-law/) | ![scaling-law](../docs/assets/gallery/examples/scaling-law.png) |
| [calibration-curve/](calibration-curve/) | ![calibration-curve](../docs/assets/gallery/examples/calibration-curve.png) |
| [custom-theme/](custom-theme/) | ![custom-theme](../docs/assets/gallery/examples/custom-theme.png) |
| [multipanel-paper-figure/](multipanel-paper-figure/) | ![multipanel-paper-figure](../docs/assets/gallery/examples/multipanel-paper-figure.png) |

Regenerate: `bun run render:gallery`

## Quick start

```bash
# Render the hand-written line chart
bun run render:example

# Compare all built-in themes (writes SVGs under theme-samples/)
bun run render:theme-samples

# Generate and render a training curve from CSV
bun run infer:training-curve
bun run render:training-curve
```

## Regenerate reference specs

From the repo root:

```bash
bun run infer:examples
bun run template:examples
```

This overwrites committed `chart*.vl.json` files under `examples/`. See each folder README for individual commands.

SVG outputs (`output.svg`, `theme-samples/*.{svg,meta.json}`) are not committed. Add them locally with the `render:*` scripts or the render commands in each README.
