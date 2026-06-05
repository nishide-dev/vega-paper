# Embedding scatter (infer)

Synthetic 2D embedding points for ML paper figures (t-SNE, UMAP, PCA projection). CSV columns: `x`, `y`, `label`.

## Scatter with class color

```bash
vega-paper infer examples/embedding-scatter/data.csv \
  --chart scatter \
  --x x \
  --y y \
  --color label \
  --title "Embedding (2D)" \
  --width 360 \
  --height 360 \
  --spec-out examples/embedding-scatter/chart.vl.json
```

## Render

```bash
vega-paper render examples/embedding-scatter/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/embedding-scatter/output.svg
```

## Lint

```bash
vega-paper lint examples/embedding-scatter/chart.vl.json --profile paper
```

## Use your own embeddings

Export a CSV with two numeric columns and a label column, then adjust field names:

```bash
vega-paper infer your-embeddings.csv \
  --chart scatter \
  --x umap_1 --y umap_2 --color label \
  --title "UMAP embedding" \
  --width 360 --height 360 \
  --spec-out figures/umap.vl.json
```

Very large point counts (10k+) may need downsampling before render.

Committed `chart.vl.json` is regenerated with `bun run infer:embedding-scatter` from the repo root. `output.svg` is local only.
