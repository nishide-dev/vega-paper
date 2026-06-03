# VegaPaper Infer Heatmap Design

## Context

`vega-paper infer` generates Vega-Lite specs from CSV or JSON tabular data with explicit chart type and encoding fields. Supported charts are `line`, `bar`, `scatter`, and `area`, with optional `--facet` for small multiples.

Heatmaps are common in papers for confusion matrices, correlation matrices, and grid summaries. Unlike cartesian line-like charts, heatmaps use `x` and `y` as grid axes and `color` as the cell value. This slice adds `heatmap` with that encoding model.

## Goals

- Add `--chart heatmap` to `vega-paper infer`.
- Use `mark: "rect"`.
- Require `--color` as the cell value field when `chart` is `heatmap`.
- Default encoding types for heatmap:
  - `x`: `ordinal` (overridable via `--x-type`)
  - `y`: `ordinal` (overridable via `--y-type`)
  - `color`: `quantitative` (overridable via `--color-type`)
- Require `--x`, `--y`, and `--color` to refer to three different fields on heatmap charts.
- When `--facet` is used with heatmap, require the facet field to differ from `--x`, `--y`, and `--color` (in addition to the existing facet/color collision rule).
- Keep CSV/JSON input, `data.url`, `--inline-data`, type overrides, facet wrapping, and lint integration unchanged for non-heatmap charts.

## Non-Goals

- No `boxplot`, `--aggregate`, or color scheme / legend tuning.
- No automatic pivot, binning, or melting of wide tables.
- No change to `--color` optionality on non-heatmap charts.
- No lint rule changes.

## CLI Behavior

Example:

```bash
vega-paper infer confusion.csv \
  --chart heatmap \
  --x predicted \
  --y actual \
  --color count \
  --spec-out figures/confusion.vl.json
```

Valid `--chart` values after this slice:

```text
line | bar | scatter | area | heatmap
```

Rules:

- `--color` is **required** when `--chart heatmap`.
- On heatmap charts, `--color` means **cell value**, not series color.
- `--x`, `--y`, and `--color` must be three distinct field names.
- `--facet`, when provided on a heatmap chart, must not equal `--x`, `--y`, or `--color`.
- Existing rule remains: `--facet` and `--color` must not be the same field on any chart.
- All other infer options behave as today.

Faceted heatmap example:

```bash
vega-paper infer results.csv \
  --chart heatmap \
  --x col \
  --y row \
  --color value \
  --facet split \
  --spec-out figures/grid.vl.json
```

## Architecture

Changes are confined to `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core (`packages/cli/src/core/infer.ts`)

Extend chart types:

```ts
export type InferChartType = "line" | "bar" | "scatter" | "area" | "heatmap";

const MARK_BY_CHART: Record<InferChartType, InferMark> = {
  // ...existing...
  heatmap: "rect",
};
```

In `inferVegaLiteSpec()`, branch encoding construction:

**Non-heatmap (unchanged):**

- Build cartesian encoding with inferred x/y types and optional color as series.

**Heatmap:**

- Require `request.colorField`; if missing, throw:
  - `The "--color" option is required when --chart heatmap is used.`
- Build encoding:

```ts
{
  x: { field: request.xField, type: request.xType ?? "ordinal" },
  y: { field: request.yField, type: request.yType ?? "ordinal" },
  color: {
    field: request.colorField,
    type: request.colorType ?? "quantitative",
  },
}
```

- Use `mark: "rect"`.
- Reuse existing inner/outer spec logic for facet and flat output.

Update `parseChartType()` and unsupported-chart messages to include `heatmap`.

### Command (`packages/cli/src/commands/infer.ts`)

Update `--chart` help text:

```text
chart type: line, bar, scatter, area, or heatmap
```

Add heatmap validation in `normalizeInferOptions()` after chart type is known:

1. If chart is `heatmap` and `--color` is missing:

```text
The "--color" option is required when --chart heatmap is used.
```

2. If chart is `heatmap` and any pair among `--x`, `--y`, `--color` matches:

```text
Heatmap requires distinct --x, --y, and --color fields.
```

3. If chart is `heatmap`, `--facet` is set, and facet equals x, y, or color:

```text
The "--facet" field must differ from --x, --y, and --color on heatmap charts.
```

Keep existing facet/color collision validation for all charts.

## Data Flow

```text
vega-paper infer confusion.csv --chart heatmap --x predicted --y actual --color count --spec-out out.vl.json
  → loadTabularInput
  → build heatmap encoding (ordinal/ordinal/quantitative)
  → build inner spec (mark rect) or flat spec
  → optional facet wrap
  → write spec → optional lint → optional render
```

## Error Handling

| Condition | Message |
|-----------|---------|
| Missing `--color` on heatmap | `The "--color" option is required when --chart heatmap is used.` |
| Duplicate x/y/color fields | `Heatmap requires distinct --x, --y, and --color fields.` |
| Facet equals x, y, or color on heatmap | `The "--facet" field must differ from --x, --y, and --color on heatmap charts.` |
| Facet equals color (any chart) | `The "--facet" and "--color" options must use different fields.` |
| Missing field in data | `Field "..." was not found.` |
| Unsupported chart | `Unsupported chart type "...". Expected one of: line, bar, scatter, area, heatmap.` |

## Lint Interaction

No lint rule changes in this slice. Heatmap specs may trigger existing rules such as missing axis titles or large inline data; that is expected.

## Testing

### Core (`packages/cli/test/infer.test.ts`)

- `chart: "heatmap"` produces `mark: "rect"` and ordinal/ordinal/quantitative encoding.
- Missing `colorField` on heatmap throws required-color error.
- Duplicate x/y/color fields throw heatmap distinct-fields error (via command or core as implemented).
- Unsupported chart message lists `heatmap`.
- Existing non-heatmap tests unchanged.

### Command (`packages/cli/test/infer-command.test.ts`)

- `--chart heatmap` with `--color` passes through fields on `InferRequest`.
- heatmap without `--color` throws before infer.
- duplicate x=y throws distinct-fields error.
- heatmap with `--facet` equal to `--x` throws facet validation error.

Verification:

```bash
bun test
bun run typecheck
bun run build
```

## Expected User Impact

Users and agents can generate confusion-matrix-style heatmaps with the same infer command, using `--color` explicitly as the cell value field. Non-heatmap invocations remain unchanged.
