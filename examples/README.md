# VegaPaper examples

Small datasets and reference Vega-Lite specs for trying the CLI. Each folder has a README with exact commands.

| Folder | Demonstrates |
|--------|----------------|
| [basic-line/](basic-line/) | Hand-written spec; `render` and `lint` |
| [training-curve/](training-curve/) | `infer` line chart; `--aggregate mean` on raw runs |
| [confusion-matrix/](confusion-matrix/) | `infer` heatmap; sum aggregation from trial rows |
| [faceted-training/](faceted-training/) | `infer` with `--facet` small multiples |

## Quick start

```bash
# Render the hand-written line chart
bun run render:example

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

SVG outputs (`output.svg`) are not committed. Add them locally with the `render:*` scripts or the render commands in each README.
