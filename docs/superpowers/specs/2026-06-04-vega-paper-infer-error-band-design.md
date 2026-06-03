# VegaPaper Infer Error Band Design

## Context

`vega-paper infer` supports all `initial-design.md` chart types plus `--aggregate`, `--facet`, and type overrides. The remaining infer option is `--error-band <field>` for symmetric error magnitudes on cartesian charts.

## Goals

- Add optional `--error-band <field>` to `vega-paper infer`.
- Map the field to `encoding.yError` with type `quantitative`.
- Support `line`, `bar`, `scatter`, and `area` only.
- Reject `--error-band` with `--aggregate`, `--chart heatmap`, or `--chart boxplot`.
- Field validation:
  - Error field must differ from `--x` and `--y`.
  - When `--color` is set, error field must also differ from `--color`.
  - When `--facet` is set, facet must differ from error field and other encoding fields (same pattern as other charts).
- When `--error-band` is omitted, preserve existing spec output.
- No lint rule changes.

## Non-Goals

- Filled errorband layers, `yError2`, or asymmetric bounds.
- `--error-band-type`.
- Examples in this slice.

## CLI

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --error-band f1_se \
  --spec-out figures/f1-error.vl.json
```

```text
--error-band <field>   symmetric error magnitude for y (encoding.yError)
```

## Spec Shape

```json
{
  "mark": "line",
  "encoding": {
    "x": { "field": "epoch", "type": "quantitative" },
    "y": { "field": "f1", "type": "quantitative" },
    "yError": { "field": "f1_se", "type": "quantitative" }
  }
}
```

Facet: `yError` lives on inner `spec.encoding` only.

## Error Handling

| Condition | Message |
|-----------|---------|
| error-band + aggregate | `The "--error-band" option cannot be used with --aggregate.` |
| error-band + heatmap | `The "--error-band" option cannot be used with --chart heatmap.` |
| error-band + boxplot | `The "--error-band" option cannot be used with --chart boxplot.` |
| error equals x or y (no color) | `The "--error-band" field must differ from --x and --y.` |
| error conflicts with color | `The "--error-band" field must differ from --x, --y, and --color.` |
| facet conflicts (with color + error-band) | `The "--facet" field must differ from --x, --y, --color, and --error-band.` |
| facet conflicts (error-band, no color) | `The "--facet" field must differ from --x, --y, and --error-band.` |

## Testing

- Core: line spec with `yError`, facet inner spec, rejection cases.
- Command: passthrough and validation errors.
