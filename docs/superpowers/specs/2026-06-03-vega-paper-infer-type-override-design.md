# VegaPaper Infer Type Override Design

## Context

`vega-paper infer` currently infers Vega-Lite field types automatically: any field whose non-empty values all parse as finite numbers becomes `quantitative`; everything else becomes `nominal`. Color is always hardcoded as `nominal`. This works for the common case but fails predictably on date strings (should be `temporal`), discrete numeric steps (should be `ordinal`), and ordered categorical fields on color (should be `ordinal`).

This slice adds `--x-type`, `--y-type`, and `--color-type` options so users and agents can override the inferred type when the automatic result is wrong.

## Goals

- Add `--x-type`, `--y-type`, and `--color-type` options to `vega-paper infer`.
- Accept the full Vega-Lite type set: `quantitative | nominal | ordinal | temporal`.
- When a type override is provided, skip inference for that field and use the given value directly.
- Release the `nominal` hardcode on color so `--color-type` can produce `ordinal`.
- Validate type strings at the command layer and raise a clear `VegaPaperError` for invalid values.
- Keep all existing `infer` behavior unchanged when overrides are omitted.

## Non-Goals

- No automatic temporal detection (date-string heuristics).
- No `--x-time-unit` or other Vega-Lite temporal sub-options.
- No changes to `infer lint`, render, or any other command.
- No changes to `inferFieldType()` logic.

## CLI Behavior

New options on `vega-paper infer`:

```text
--x-type <type>      override inferred type for x encoding
--y-type <type>      override inferred type for y encoding
--color-type <type>  override color encoding type (default: nominal)
```

Valid values for all three: `quantitative | nominal | ordinal | temporal`.

Rules:

- When provided, the override takes effect regardless of what the data looks like.
- When omitted, existing inference behavior applies (`--color-type` omitted keeps `nominal`).
- `--color-type` without `--color` is invalid.
- Any value outside the four valid types is invalid.

Examples:

```bash
# Fix date strings classified as nominal
vega-paper infer data.csv --chart line --x date --x-type temporal --y value --spec-out out.vl.json

# Use ordinal for discrete numeric steps
vega-paper infer results.csv --chart line --x epoch --x-type ordinal --y f1 --spec-out out.vl.json

# Ordered color scale
vega-paper infer data.csv --chart scatter --x x --y y --color rating --color-type ordinal --spec-out out.vl.json
```

## Architecture

Changes are confined to `core/infer.ts` (types + spec builder) and `commands/infer.ts` (parsing + validation). No other files change.

### Core (`packages/cli/src/core/infer.ts`)

Export a new type:

```ts
export type VegaLiteFieldType = "quantitative" | "nominal" | "ordinal" | "temporal";
```

Add three optional fields to `InferRequest`:

```ts
export type InferRequest = {
  // ...existing fields...
  xType?: VegaLiteFieldType | undefined;
  yType?: VegaLiteFieldType | undefined;
  colorType?: VegaLiteFieldType | undefined;
};
```

Update the encoding builder in `inferVegaLiteSpec()`:

```ts
x: {
  field: request.xField,
  type: request.xType ?? inferFieldType(csv.rows, xIndex),
},
y: {
  field: request.yField,
  type: request.yType ?? inferFieldType(csv.rows, yIndex),
},
// color (when colorField is set):
color: {
  field: request.colorField,
  type: request.colorType ?? "nominal",
}
```

`inferFieldType()` is unchanged.

### Command (`packages/cli/src/commands/infer.ts`)

Add a shared parser:

```ts
const VALID_FIELD_TYPES = ["quantitative", "nominal", "ordinal", "temporal"] as const;

function parseFieldType(
  value: string | undefined,
  flag: string,
): VegaLiteFieldType | undefined {
  if (value === undefined) return undefined;
  if ((VALID_FIELD_TYPES as readonly string[]).includes(value)) {
    return value as VegaLiteFieldType;
  }
  throw new VegaPaperError(
    `Invalid value "${value}" for ${flag}. Expected one of: quantitative, nominal, ordinal, temporal.`,
  );
}
```

Add `xType`, `yType`, `colorType` to `InferCommandOptions` and validate in `normalizeInferOptions()`:

- Parse each flag through `parseFieldType()`.
- If `colorType` is set but `colorField` is undefined, throw: `The "--color-type" option requires "--color <field>".`

## Error Handling

| Condition | Error message |
|-----------|---------------|
| `--x-type` is not a valid type | `Invalid value "..." for --x-type. Expected one of: quantitative, nominal, ordinal, temporal.` |
| `--y-type` is not a valid type | `Invalid value "..." for --y-type. Expected one of: quantitative, nominal, ordinal, temporal.` |
| `--color-type` is not a valid type | `Invalid value "..." for --color-type. Expected one of: quantitative, nominal, ordinal, temporal.` |
| `--color-type` without `--color` | `The "--color-type" option requires "--color <field>".` |

## Testing

**Core tests** (`packages/cli/test/infer.test.ts`):

- `xType: "temporal"` produces `x.type: "temporal"` in the spec.
- `xType: "ordinal"` overrides what inference would have inferred.
- `colorType: "ordinal"` produces `color.type: "ordinal"` instead of `"nominal"`.
- All three overrides omitted → existing inference and `nominal` color behavior unchanged.

**Command tests** (`packages/cli/test/infer-command.test.ts`):

- `--x-type temporal` is passed through to `InferRequest.xType`.
- `--color-type ordinal` is passed through to `InferRequest.colorType`.
- `--x-type invalid` throws `VegaPaperError` with the expected message.
- `--color-type nominal` without `--color` throws `VegaPaperError`.
- Omitting all type flags leaves existing behavior unchanged.

Verification:

```bash
bun test
bun run typecheck
bun run build
```

## Expected User Impact

Date columns, discrete steps, and ordered categories can now be encoded correctly without manual spec editing. The change is purely additive — all existing `infer` invocations continue to work unchanged.
