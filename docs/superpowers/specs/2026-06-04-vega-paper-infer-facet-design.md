# VegaPaper Infer Facet Design

## Context

`vega-paper infer` generates Vega-Lite specs from CSV or JSON tabular data with explicit chart type and encoding fields. Supported charts are `line`, `bar`, `scatter`, and `area`. Type overrides, optional lint-before-render, and `--inline-data` are already implemented.

The next slice adds optional faceting via `--facet <field>` so users can produce small-multiple charts for comparing models, conditions, or splits without hand-writing nested Vega-Lite specs.

## Goals

- Add optional `--facet <field>` to `vega-paper infer`.
- Support faceting for all existing chart types.
- When `--facet` is provided, generate a top-level Vega-Lite facet spec:
  - **Outer spec:** `$schema`, `data`, `facet`, optional `title`
  - **Inner `spec`:** `mark`, `encoding`, `width`, `height`
- Set facet encoding type to `nominal` always.
- Reject `--facet` and `--color` when they refer to the same field.
- Keep CSV/JSON input, `data.url`, `--inline-data`, type overrides, and lint integration unchanged.
- When `--facet` is omitted, preserve the current flat spec output exactly.

## Non-Goals

- No `--facet-row`, two-axis faceting, or `columns` tuning.
- No `--facet-type` override in this slice.
- No heatmap, boxplot, or aggregate support.
- No lint rule changes.
- No facet panel count limits.

## CLI Behavior

Example:

```bash
vega-paper infer examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --facet model \
  --spec-out figures/f1-faceted.vl.json
```

New option:

```text
--facet <field>   split chart into small multiples by field
```

Rules:

- `--facet` is optional.
- Facet field must exist in the loaded tabular data.
- Facet field type is always `nominal`.
- `--facet` and `--color` must not use the same field name.
- All other infer options behave as today.

Example with color inside each facet panel:

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --facet split \
  --color model \
  --spec-out figures/f1.vl.json
```

## Architecture

Changes are confined to `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core (`packages/cli/src/core/infer.ts`)

Extend `InferRequest`:

```ts
export type InferRequest = {
  // ...existing fields...
  facetField?: string | undefined;
};
```

Refactor `inferVegaLiteSpec()` to:

1. Load tabular input and build encoding as today.
2. Build an inner unit spec:

```ts
const innerSpec: JsonObject = {
  mark: MARK_BY_CHART[chart],
  width: request.width ?? DEFAULT_WIDTH,
  height: request.height ?? DEFAULT_HEIGHT,
  encoding,
};
```

3. If `request.facetField` is set:
   - Resolve facet field index and validate field existence.
   - Return outer spec:

```ts
const spec: JsonObject = {
  $schema: VEGA_LITE_SCHEMA,
  data,
  facet: {
    field: request.facetField,
    type: "nominal",
  },
  spec: innerSpec,
};
```

4. If `request.facetField` is omitted, return the current flat spec shape unchanged.

Place optional `title` on the outer spec in both faceted and non-faceted cases (no behavior change when facet is omitted).

### Command (`packages/cli/src/commands/infer.ts`)

Register:

```ts
.option("--facet <field>", "split chart into small multiples by field")
```

Extend `InferCommandOptions` and `normalizeInferOptions()`:

```ts
facetField: options.facet,
```

Validation in `normalizeInferOptions()`:

```ts
if (
  options.facet !== undefined &&
  options.color !== undefined &&
  options.facet === options.color
) {
  throw new VegaPaperError(
    'The "--facet" and "--color" options must use different fields.',
  );
}
```

## Data Flow

With facet enabled:

```text
vega-paper infer data.csv --chart line --x epoch --y f1 --facet model --spec-out out.vl.json
  → loadTabularInput
  → build encoding
  → wrap inner spec with top-level facet
  → write spec → optional lint → optional render
```

Without facet, output remains the current flat spec.

## Error Handling

| Condition | Message |
|-----------|---------|
| Facet field not found | `Field "<name>" was not found.` |
| `--facet` equals `--color` | `The "--facet" and "--color" options must use different fields.` |

All other errors unchanged.

## Lint Interaction

No lint rule changes in this slice. Existing composed-spec lint already traverses faceted Vega-Lite specs; generated faceted specs should continue to lint through the saved artifact path.

## Testing

### Core (`packages/cli/test/infer.test.ts`)

- `--facet model` on line chart produces top-level `facet` and nested `spec.mark` / `spec.encoding`.
- Outer spec contains `data`; inner spec does not duplicate `data`.
- Facet encoding is `{ field: "model", type: "nominal" }`.
- Facet omitted → existing flat-spec tests remain unchanged.
- Facet + color with different fields succeeds.
- Same field for facet and color throws `VegaPaperError`.
- Missing facet field throws `Field "..." was not found.`

### Command (`packages/cli/test/infer-command.test.ts`)

- `--facet model` passes `facetField: "model"` on `InferRequest`.
- `--facet` equal to `--color` throws `VegaPaperError` before infer runs.

Verification:

```bash
bun test
bun run typecheck
bun run build
```

## Expected User Impact

Users and agents can split existing cartesian infer charts into small multiples with one additional flag. The change is additive; all existing invocations without `--facet` continue to work unchanged.
