# VegaPaper Infer Aggregate Design

## Context

`vega-paper infer` generates Vega-Lite specs from CSV or JSON tabular data with explicit chart type and encoding fields. Supported charts are `line`, `bar`, `scatter`, `area`, and `heatmap`, with optional `--facet` for small multiples.

`docs/initial-design.md` documents `--aggregate <method>` (`mean | median | sum | count | min | max`) but it is not implemented. This slice adds Vega-Lite `transform` aggregation so users can collapse duplicate raw rows (for example multiple training runs per epoch and model) before plotting.

## Goals

- Add optional `--aggregate <method>` to `vega-paper infer`.
- Support methods: `mean`, `median`, `sum`, `count`, `min`, `max`.
- Support aggregation for all existing chart types, including heatmap and faceted specs.
- When `--aggregate` is provided, always emit a `transform` array with one `aggregate` transform on the chart-bearing spec (inner `spec` when faceted, top-level otherwise).
- Derive aggregation automatically:
  - **Cartesian charts** (`line`, `bar`, `scatter`, `area`): aggregate `--y`; `groupby` = `[--x]` plus `[--color]` when set.
  - **Heatmap**: aggregate `--color` (cell value); `groupby` = `[--x, --y]`.
- Do not include `--facet` in `groupby` (facet partitions data first; transform runs inside each panel).
- For `count`, count rows per group (Vega-Lite `count` without `field`).
- Keep output field names unchanged (`as` equals the measure field) so encoding blocks stay the same.
- When `--aggregate` is omitted, preserve current spec output exactly (no `transform` key).
- Keep CSV/JSON input, `data.url`, `--inline-data`, type overrides, facet wrapping, and lint integration unchanged.

## Non-Goals

- No `--aggregate-field` or multiple measures in one transform.
- No numeric-type pre-validation before aggregation (Vega-Lite handles coercion at render time).
- No lint rule changes.
- No `boxplot`, `--error-band`, or transform elision when data is already unique.
- No changes to heatmap/facet field-collision rules beyond existing behavior.

## CLI Behavior

Example:

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --aggregate mean \
  --spec-out figures/f1.vl.json
```

New option:

```text
--aggregate <method>   mean | median | sum | count | min | max
```

Rules:

- `--aggregate` is optional.
- Invalid method:

```text
Invalid value "..." for --aggregate. Expected one of: mean, median, sum, count, min, max.
```

- All existing infer validation (required fields, heatmap color, facet/color collision, etc.) applies unchanged.

Faceted example:

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --facet split \
  --color model \
  --aggregate mean \
  --spec-out figures/f1.vl.json
```

Heatmap example:

```bash
vega-paper infer cells.csv \
  --chart heatmap \
  --x col \
  --y row \
  --color value \
  --aggregate sum \
  --spec-out figures/grid.vl.json
```

## Architecture

Changes are confined to `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core (`packages/cli/src/core/infer.ts`)

Extend types:

```ts
export type InferAggregateMethod =
  | "mean"
  | "median"
  | "sum"
  | "count"
  | "min"
  | "max";

export type InferRequest = {
  // ...existing fields...
  aggregateMethod?: InferAggregateMethod | undefined;
};
```

Add `buildAggregateTransform(chart, request)` returning:

```ts
{
  aggregate: AggregateEntry[];
  groupby: string[];
}
```

**Cartesian** (`line` | `bar` | `scatter` | `area`):

- `measureField` = `request.yField`
- `groupby` = `[request.xField, ...(request.colorField ? [request.colorField] : [])]`
- Non-count: `{ op, field: measureField, as: measureField }`
- Count: `{ op: "count", as: measureField }` (no `field`)

**Heatmap**:

- `measureField` = `request.colorField` (required for heatmap charts)
- `groupby` = `[request.xField, request.yField]`
- Same aggregate entry rules as cartesian

In `inferVegaLiteSpec()`, after building `innerSpec`:

```ts
if (request.aggregateMethod !== undefined) {
  innerSpec.transform = [buildAggregateTransform(chart, request)];
}
```

Flat and faceted output paths are unchanged except for optional `transform` on the chart-bearing object.

### Command (`packages/cli/src/commands/infer.ts`)

Register:

```text
--aggregate <method>   aggregate measure before plotting
```

Parse in `normalizeInferOptions()` with the standard invalid-value message. Pass `aggregateMethod` on `InferRequest`.

## Spec Shape

**Flat:**

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data.csv" },
  "transform": [
    {
      "aggregate": [{ "op": "mean", "field": "f1", "as": "f1" }],
      "groupby": ["epoch", "model"]
    }
  ],
  "mark": "line",
  "encoding": { ... }
}
```

**Faceted** (`transform` on inner `spec` only; `groupby` excludes facet field):

```json
{
  "data": { "url": "data.csv" },
  "facet": { "field": "split", "type": "nominal" },
  "spec": {
    "transform": [
      {
        "aggregate": [{ "op": "mean", "field": "f1", "as": "f1" }],
        "groupby": ["epoch", "model"]
      }
    ],
    "mark": "line",
    "encoding": { ... }
  }
}
```

## Data Flow

```text
vega-paper infer results.csv --chart line --x epoch --y f1 --color model --aggregate mean
  → loadTabularInput
  → build encoding (unchanged)
  → build innerSpec + optional transform
  → optional facet wrap
  → write spec → optional lint → optional render
```

## Error Handling

| Condition | Message |
|-----------|---------|
| Invalid `--aggregate` value | `Invalid value "..." for --aggregate. Expected one of: mean, median, sum, count, min, max.` |
| Missing field in data | `Field "..." was not found.` |
| Heatmap without color | `The "--color" option is required when --chart heatmap is used.` |
| Existing facet/heatmap rules | unchanged |

## Lint Interaction

No lint rule changes in this slice.

## Testing

### Core (`packages/cli/test/infer.test.ts`)

- Flat line chart with `aggregateMethod: "mean"` and color emits `transform` with correct `groupby` and `aggregate` entries.
- Line without color: `groupby` is only `[x]`.
- `aggregateMethod: "count"` uses count without `field`.
- Faceted spec places `transform` on `spec`, not top-level; `groupby` excludes facet field.
- Heatmap with `aggregateMethod: "sum"` aggregates color with `groupby` `[x, y]`.
- Without `aggregateMethod`, existing tests unchanged (no `transform` key).

### Command (`packages/cli/test/infer-command.test.ts`)

- `--aggregate mean` passes `aggregateMethod: "mean"` to infer.
- Invalid `--aggregate` throws expected message.
