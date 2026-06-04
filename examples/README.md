# VegaPaper examples

Small datasets and reference Vega-Lite specs for trying the CLI. Each folder has a README with exact commands.

| Folder | Demonstrates |
|--------|----------------|
| [basic-line/](basic-line/) | Hand-written spec; `render` and `lint` |
| [training-curve/](training-curve/) | `infer` line chart; `--aggregate mean`; `--error-band` |
| [confusion-matrix/](confusion-matrix/) | `infer` heatmap; sum aggregation from trial rows |
| [faceted-training/](faceted-training/) | `infer` with `--facet` small multiples |
| [boxplot/](boxplot/) | `infer` boxplot from raw sample rows; optional `--color` grouping |
| [theme-samples/](theme-samples/) | Same spec rendered with every built-in theme |

## Gallery

Committed PNG previews (`paper-clean` unless noted). Theme comparison: [root README](../README.md#figure-previews).

| Example | Preview |
|---------|---------|
| [basic-line/](basic-line/) | ![basic-line](../docs/assets/gallery/examples/basic-line.png) |
| [training-curve/](training-curve/) | ![training-curve](../docs/assets/gallery/examples/training-curve.png) |
| [confusion-matrix/](confusion-matrix/) | ![confusion-matrix](../docs/assets/gallery/examples/confusion-matrix.png) |
| [faceted-training/](faceted-training/) | ![faceted-training](../docs/assets/gallery/examples/faceted-training.png) |
| [boxplot/](boxplot/) | ![boxplot](../docs/assets/gallery/examples/boxplot.png) |
| [custom-theme/](custom-theme/) | ![custom-theme](../docs/assets/gallery/examples/custom-theme.png) |

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
```

This overwrites committed `chart*.vl.json` files under `examples/`. See each folder README for individual commands.

SVG outputs (`output.svg`, `theme-samples/*.{svg,meta.json}`) are not committed. Add them locally with the `render:*` scripts or the render commands in each README.
