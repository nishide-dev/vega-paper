# Chart selection for `vega-paper infer`

Choose `--chart` and encoding fields **before** running `infer`. This guide covers selection only; see [SKILL.md](../SKILL.md) for the infer → lint → render workflow.

## Chart types

| Analytical goal | `--chart` | Typical encodings |
|-----------------|-----------|-------------------|
| Metric over steps, epochs, or time | `line` | `--x` step/time, `--y` metric; optional `--color` series |
| Compare categories | `bar` | `--x` category (nominal), `--y` measure |
| Relationship between two numeric variables | `scatter` | `--x` and `--y` both quantitative |
| Trend with filled area | `area` | Same as `line` |
| Matrix / grid of counts or scores | `heatmap` | `--x`, `--y`, and `--color` (cell value) — **all distinct fields** |
| Distribution of a measure by group | `boxplot` | `--x` group (nominal), `--y` measure — **distinct fields** |

Supported values for `--chart`: `line`, `bar`, `scatter`, `area`, `heatmap`, `boxplot`.

There is no dedicated `examples/` folder for `bar` or `area` yet; `scatter` is covered by [embedding-scatter/](../../../examples/embedding-scatter/).

## Decision guide

Use this **before** the chart types table when the goal is unclear. Stop at the first matching branch.

1. **Matrix / grid of cell values** (confusion matrix, score grid) → `--chart heatmap` with distinct `--x`, `--y`, `--color`.
2. **Distribution of one measure across groups** (spread, outliers) → `--chart boxplot` with nominal `--x`, quantitative `--y`.
3. **Metric over ordered steps, epochs, or time** → `--chart line` or `--area` (filled trend); optional `--color` for series.
4. **Compare a measure across discrete categories** (no natural time order) → `--chart bar`.
5. **Relationship between two numeric variables** → `--chart scatter`.
6. **Still unclear** → inspect column types and row grain; prefer `line`/`area` when x is ordered, `bar` when x is categorical.

Then add modifiers if needed:

| Need | Modifier | Notes |
|------|----------|-------|
| Roll up duplicate x rows | `--aggregate <method>` | Not with `boxplot` or `--error-band` |
| Small multiples by a third field | `--facet <field>` | Must differ from `--x`, `--y`, `--color` |
| Symmetric uncertainty on y | `--error-band <field>` | Shaded band on `line`; `yError` on `bar`/`scatter`/`area`; not with `--aggregate` |

See repo examples in the table below and [Chart types](#chart-types) for encoding details.

## Modifiers

Optional flags that change the generated spec. Combine only when rules below allow it.

### `--aggregate <method>`

Methods: `mean`, `median`, `sum`, `count`, `min`, `max`.

- Use when raw rows must be rolled up (e.g. multiple runs per epoch → mean F1).
- **Not allowed** with `--chart boxplot`.
- **Not allowed** together with `--error-band`.

For heatmaps, aggregate the `--color` field with groupby `--x` and `--y`.

### `--facet <field>`

Split the chart into small multiples by `field`.

- Must differ from `--x`, `--y`, and `--color` (and from `--error-band` when set).
- On heatmaps, facet must also differ from the color field used for cell values.

### `--error-band <field>`

Symmetric error magnitude on `--y`.

- On `--chart line`: generates a **layered spec** — a shaded `errorband` layer (`extent: "stderr"`, `opacity: 0.25`) drawn behind the line. This is the shaded uncertainty band expected for learning curves.
- On `bar`, `scatter`, `area`: maps to `encoding.yError` (per-point error), unchanged.
- **Not allowed** with `heatmap`, `boxplot`, or `--aggregate`.
- Field must differ from `--x`, `--y`, `--color`, and `--facet`.

**Error band vs error bars:** a band is a continuous shaded region around a line — use it for metrics over epochs/steps. Error bars are per-point whiskers, which is what `yError` produces on non-line marks.

## Examples in this repo

Copy-paste commands live in each folder README.

| Folder | `--chart` | Also demonstrates |
|--------|-----------|-------------------|
| [training-curve/](../../../examples/training-curve/) | `line` | `--color`; variants with `--aggregate mean`, `--error-band` |
| [confusion-matrix/](../../../examples/confusion-matrix/) | `heatmap` | `--aggregate sum` from trial rows |
| [faceted-training/](../../../examples/faceted-training/) | `line` | `--facet`, `--color` |
| [boxplot/](../../../examples/boxplot/) | `boxplot` | optional `--color` grouping |
| [embedding-scatter/](../../../examples/embedding-scatter/) | `scatter` | `--color` for class/cluster labels |
| [basic-line/](../../../examples/basic-line/) | (hand-written spec) | `render` / `lint` only — not `infer` |

Index: [examples/README.md](../../../examples/README.md).

## Common mistakes

| Mistake | Why it fails / looks wrong | Fix |
|---------|---------------------------|-----|
| `heatmap` without `--color` | CLI requires a cell value field | Add distinct `--color` field |
| Same field for `--x`, `--y`, or `--color` on heatmap | Distinct encodings required | Pick three different columns |
| `--aggregate` with `boxplot` | CLI rejects the combination | Use boxplot on raw rows or choose another chart |
| `--error-band` with `--aggregate` | CLI rejects the combination | Pick one modifier |
| `--error-band` on heatmap or boxplot | Unsupported chart types | Use cartesian chart or drop error band |
| `--facet` equals `--color` (or `--x` / `--y`) | CLI rejects duplicate fields | Choose a different facet field |
| Boxplot with `--x` equal to `--y` | Needs category vs measure | Use nominal group on `--x`, quantitative on `--y` |
| Wrong chart for the goal (e.g. bar for time series) | Misleading figure | Prefer `line` or `area` for ordered steps/time |

When in doubt, inspect column types and row grain (one row per observation vs aggregated), then re-read the chart types table.
