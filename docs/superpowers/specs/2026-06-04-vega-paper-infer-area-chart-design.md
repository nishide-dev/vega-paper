# VegaPaper Infer Area Chart Design

## Context

`vega-paper infer` generates Vega-Lite specs from CSV or JSON tabular data with explicit chart type and encoding fields. Supported charts are `line`, `bar`, and `scatter`. Type overrides, optional lint-before-render, and `--inline-data` are already implemented.

The next slice adds `area` as a fourth chart type. Area charts share the same x/y/color encoding model as line charts and are common for training curves and cumulative metrics in papers.

## Goals

- Add `--chart area` to `vega-paper infer`.
- Use the same required and optional encoding options as line: `--x`, `--y`, optional `--color`, type overrides, title, width, height.
- Generate `mark: { type: "area", line: true }` for clearer series boundaries on filled areas.
- When `--color` is set, rely on Vega-Lite default stacking behavior (stacked areas).
- Keep CSV/JSON input, `data.url`, `--inline-data`, and lint integration unchanged.
- Update unsupported-chart error messages to list `area`.

## Non-Goals

- No `heatmap` or `boxplot` in this slice.
- No `--facet`, `--aggregate`, `--stack`, `--error-band`, or area-specific mark options (opacity, interpolate).
- No lint rule changes.
- No new examples directory changes (optional follow-up).

## CLI Behavior

Example:

```bash
vega-paper infer results.csv \
  --chart area \
  --x epoch \
  --y loss \
  --color model \
  --spec-out figures/loss.vl.json
```

Valid `--chart` values after this slice:

```text
line | bar | scatter | area
```

Rules:

- `--chart area` requires the same `--x` and `--y` as other cartesian charts.
- `--color` remains optional; when present, Vega-Lite applies its default stacked area behavior.
- All other infer options behave as today.

## Architecture

Changes are confined to `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core (`packages/cli/src/core/infer.ts`)

Extend chart types and mark mapping:

```ts
export type InferChartType = "line" | "bar" | "scatter" | "area";

type InferMark = "line" | "bar" | "point" | { type: "area"; line: true };

const MARK_BY_CHART: Record<InferChartType, InferMark> = {
  line: "line",
  bar: "bar",
  scatter: "point",
  area: { type: "area", line: true },
};
```

Update `parseChartType()` to accept `"area"` and include it in the unsupported-chart error message.

The spec builder continues to assign `mark: MARK_BY_CHART[chart]` with no encoding changes.

### Command (`packages/cli/src/commands/infer.ts`)

Update the `--chart` option help text:

```text
chart type: line, bar, scatter, or area
```

Update `parseInferChartType()` validation to accept `area` with the same error message as core.

## Data Flow

Unchanged from existing infer:

```text
vega-paper infer data.csv --chart area --x epoch --y loss --spec-out out.vl.json
  → loadTabularInput
  → inferVegaLiteSpec (mark = area with line)
  → write spec → optional lint → optional render
```

## Error Handling

| Condition | Message |
|-----------|---------|
| Unsupported chart type | `Unsupported chart type "<value>". Expected one of: line, bar, scatter, area.` |

All other errors unchanged.

## Testing

### Core (`packages/cli/test/infer.test.ts`)

- `chart: "area"` produces `mark: { type: "area", line: true }`.
- Area encoding matches line for the same x/y/color fields (reuse or mirror existing line test data).
- Unsupported chart error message includes `area` in the expected list.
- Existing line/bar/scatter tests remain unchanged.

### Command (`packages/cli/test/infer-command.test.ts`)

- `--chart area` passes `chart: "area"` on `InferRequest`.

Verification:

```bash
bun test
bun run typecheck
bun run build
```

## Expected User Impact

Users and agents can produce filled area charts for time-series or ordered x data without hand-writing Vega-Lite specs. The change is additive; all existing invocations continue to work unchanged.
