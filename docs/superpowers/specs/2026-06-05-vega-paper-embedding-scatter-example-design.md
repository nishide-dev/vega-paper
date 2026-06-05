# Embedding scatter example (t-SNE / UMAP)

**Status:** Approved for implementation planning  
**Depends on:** `infer --chart scatter` (Phase 1+), v0.1.4 CLI docs

## Problem

ML papers frequently include **2D embedding scatter plots** (t-SNE, UMAP, PCA projections) with points colored by class or cluster. VegaPaper already supports `infer --chart scatter`, but:

- No `examples/` folder demonstrates this workflow
- [chart-selection.md](../../../skills/vega-paper/references/chart-selection.md) lists scatter without a copy-paste repo example
- Agents and readers cannot discover the embedding → CSV → `infer` → `render` path from the codebase alone

## Goals

1. Add **`examples/embedding-scatter/`** with a small **synthetic committed CSV** (`x`, `y`, `label`).
2. One reference spec: **`infer scatter`** with `--color label` (no facet variant in v1).
3. README with `vega-paper` commands and guidance for swapping in real embedding CSVs.
4. Wire into **`infer:examples`**, **`examples/README.md`**, and **chart-selection** reference.
5. Add **`examples.test.ts`** smoke assertion for the committed spec shape.

## Non-goals

- New `infer` chart types or scatter-specific CLI flags
- Real UMAP/t-SNE computation in-repo (users export CSV from Python/R/etc.)
- Facet-by-split second example (`--facet`) — deferred
- README gallery PNG (`render:gallery` 15th image) — optional follow-up
- Hand-written Vega-Lite spec (infer-generated spec is the reference)
- Semver bump required solely for this example

## Example layout

```text
examples/embedding-scatter/
  data.csv           # synthetic 2D points + label (committed)
  chart.vl.json      # committed output of infer (regenerated via infer:examples)
  README.md          # vega-paper commands + real-data notes
  output.svg         # local only (gitignored, same as other examples)
```

Folder name **`embedding-scatter`** is method-agnostic (t-SNE, UMAP, PCA 2D projection).

## Synthetic data

### Schema

| Column | Vega-Lite role | Notes |
|--------|----------------|-------|
| `x` | quantitative x | 1st embedding dimension |
| `y` | quantitative y | 2nd embedding dimension |
| `label` | nominal color | class / cluster name |

### Size and shape

- **3–4 labels** (e.g. `class_a` … `class_d`)
- **~20–30 points per label** → **~80–120 rows** total
- Values: overlapping Gaussian-ish clusters in 2D (visually separable but not grid-aligned)
- **Source:** generate once (hand-edited CSV or short maintainer script), **commit the CSV** — do not commit a generator script unless needed for regeneration docs

### Real data mapping (documented in README)

Users replace `data.csv` with their export. Common column renames:

| Their CSV | infer flags |
|-----------|-------------|
| `umap_1`, `umap_2`, `label` | `--x umap_1 --y umap_2 --color label` |
| `tsne_x`, `tsne_y`, `cluster` | `--x tsne_x --y tsne_y --color cluster` |

No code changes required — only `--x` / `--y` / `--color` field names change.

## Infer command (canonical)

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

### Expected generated spec (shape)

- `mark`: `"point"` (or point object without extra options)
- `encoding.x`, `encoding.y`: quantitative
- `encoding.color`: nominal on `label`
- `data.url`: relative `data.csv`
- `width` / `height`: 360 (square aspect suits embeddings)

### Render and lint

```bash
vega-paper render examples/embedding-scatter/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/embedding-scatter/output.svg

vega-paper lint examples/embedding-scatter/chart.vl.json --profile paper
```

Default theme: **`paper-clean`**. Square size 360×360 fits paper lint profile ranges.

## Repository integration

| File | Change |
|------|--------|
| `examples/embedding-scatter/data.csv` | Create |
| `examples/embedding-scatter/chart.vl.json` | Create (via infer) |
| `examples/embedding-scatter/README.md` | Create |
| `examples/README.md` | Add row to folder table |
| `skills/vega-paper/references/chart-selection.md` | Add to Examples table |
| `package.json` | Add `"infer:embedding-scatter": "vega-paper infer …"` (or `bun run packages/cli/...` in maintainer script only — **public README uses `vega-paper`**) |
| `package.json` `infer:examples` | Include new script in aggregate if other examples are listed there |
| `packages/cli/test/examples.test.ts` | Assert scatter mark + color encoding on `label` |

### `package.json` script

Mirror `infer:training-curve` pattern; use repo-relative paths:

```json
"infer:embedding-scatter": "bun run packages/cli/src/index.ts infer examples/embedding-scatter/data.csv --chart scatter --x x --y y --color label --title \"Embedding (2D)\" --width 360 --height 360 --spec-out examples/embedding-scatter/chart.vl.json"
```

(Maintainer `package.json` may keep `bun run packages/cli/...`; user-facing README in example folder uses `vega-paper`.)

### `examples.test.ts` assertion (minimum)

- `chart.vl.json` exists
- `mark` is `point`
- `encoding.color.field` is `label`
- `data.url` references `data.csv`

## Documentation copy (README highlights)

`examples/embedding-scatter/README.md` should include:

1. **Purpose:** 2D embedding scatter for ML papers (t-SNE / UMAP / PCA)
2. **Infer** command (above)
3. **Render** + **lint** commands
4. **Using your own embeddings:** export CSV with two numeric columns + label; adjust `--x` / `--y` / `--color`
5. **Point count:** note that very large sets (10k+ points) may need downsampling before Vega render — out of scope for this example

## Validation

Before merge:

1. `vega-paper infer …` (or `bun run infer:embedding-scatter`) writes `chart.vl.json`
2. `vega-paper render …` produces non-empty SVG with visible point marks
3. `bun test packages/cli/test/examples.test.ts` passes
4. `bun run infer:examples` regenerates committed spec without diff (or intentional diff committed)
5. `bun run check && bun test` unchanged green

## Optional follow-ups (out of scope)

- **`embedding-scatter-faceted/`** with `--facet split` for train/val panels
- **Gallery PNG** in `docs/assets/gallery/examples/embedding-scatter.png`
- **Skill.md** one-line link under chart selection (reference update may suffice)
- **`infer` histogram/density** for embedding marginals

## Versioning

Example-only change. May ship in next patch release notes as documentation/examples, no CLI semver requirement.
