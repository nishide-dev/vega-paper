# VegaPaper Infer Boxplot Design

## Context

`vega-paper infer` supports `line`, `bar`, `scatter`, `area`, and `heatmap`, with optional `--facet`, `--aggregate`, and type overrides. `docs/initial-design.md` also lists `--chart boxplot`, which is not implemented.

Vega-Lite's `boxplot` mark computes quartiles from raw sample rows. This slice adds `boxplot` with encoding defaults suited to category-on-x, values-on-y paper figures.

## Goals

- Add `--chart boxplot` to `vega-paper infer`.
- Use `mark: "boxplot"`.
- Default encoding types (overridable via `--x-type`, `--y-type`, `--color-type`):
  - `x`: `nominal`
  - `y`: `quantitative` with `scale: { "zero": false }`
  - `color` (optional): `nominal`
- Reject `--aggregate` when `chart` is `boxplot`.
- Validation (heatmap-style when applicable):
  - `--x` and `--y` must differ.
  - When `--color` is set, `--x`, `--y`, and `--color` must be three distinct fields.
  - When `--facet` is set, facet must differ from `--x`, `--y`, and `--color` (if `--color` is set); otherwise facet must differ from `--x` and `--y`.
  - Existing rule: `--facet` and `--color` must not be the same field.
- Support facet wrapping (transform on inner `spec` only; no aggregate transform for boxplot).
- When `--chart` is not `boxplot`, preserve existing behavior.

## Non-Goals

- No `extent`, `orient`, or whisker tuning.
- No lint rule changes.
- No examples folder in this slice.
- No `--aggregate` support on boxplot charts.

## CLI Behavior

Example:

```bash
vega-paper infer results.csv \
  --chart boxplot \
  --x model \
  --y f1 \
  --color split \
  --spec-out figures/f1-box.vl.json
```

Valid `--chart` values after this slice:

```text
line | bar | scatter | area | heatmap | boxplot
```

Rules:

- `--color` is optional on boxplot (series grouping).
- `--aggregate` with boxplot:

```text
The "--aggregate" option cannot be used with --chart boxplot.
```

## Architecture

Changes in `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core

- Extend `InferChartType` with `"boxplot"`.
- Add `boxplot: "boxplot"` to `MARK_BY_CHART`.
- Build boxplot encoding in a dedicated branch (not cartesian/heatmap).
- Throw if `aggregateMethod` is set and `chart === "boxplot"` before attaching `transform`.

### Command

- Register `boxplot` in chart type parser and help text.
- `validateBoxplotOptions()` for field-distinct and facet rules.
- Reject aggregate + boxplot in `normalizeInferOptions()` before calling infer.

## Error Handling

| Condition | Message |
|-----------|---------|
| boxplot + `--aggregate` | `The "--aggregate" option cannot be used with --chart boxplot.` |
| x === y | `Boxplot requires distinct --x and --y fields.` |
| color set, duplicate fields | `Boxplot requires distinct --x, --y, and --color fields.` |
| facet conflicts (with color) | `The "--facet" field must differ from --x, --y, and --color on boxplot charts.` |
| facet conflicts (no color) | `The "--facet" field must differ from --x and --y on boxplot charts.` |
| Unsupported chart | `Expected one of: line, bar, scatter, area, heatmap, boxplot.` |

## Lint Interaction

No lint rule changes.

## Testing

- Core: boxplot mark, encoding defaults including `y.scale.zero: false`, optional color, facet inner spec.
- Core: aggregate + boxplot throws.
- Command: passthrough, validation errors, unsupported chart list includes `boxplot`.
