# VegaPaper Infer JSON Input Design

## Context

`vega-paper infer` generates a Vega-Lite spec from tabular data with deterministic encoding and optional SVG rendering. The MVP slice supports CSV input with `data.url` referencing the source file. Type overrides (`--x-type`, `--y-type`, `--color-type`) and optional lint-before-render are already implemented.

The next slice adds JSON array input and an optional `--inline-data` flag for self-contained specs. CSV behavior remains the default path; JSON follows the same infer → write spec → optional lint → optional render workflow.

## Goals

- Accept `.json` files whose top level is a non-empty array of objects: `[{...}, {...}]`.
- Detect input format by file extension (`.csv` or `.json`).
- Default spec output uses `data.url` with a relative path to the input file (same as CSV).
- Add `--inline-data` to embed parsed rows as `data.values` (no `data.url`).
- Support `--inline-data` for both CSV and JSON input.
- Reuse existing chart types, encoding options, type overrides, and lint integration unchanged when flags are omitted.
- Unify missing-field errors to `Field "..." was not found.` (replacing CSV-only wording).

## Non-Goals

- No JSONL, TSV, Parquet, Arrow, or dataframe bridge.
- No automatic temporal detection for JSON (string normalization + existing `inferFieldType` only).
- No native JSON type inference (numbers stay numbers in `data.values`, but inference uses string rows).
- No nested object or array cell values in JSON tabular normalization.
- No changes to `render`, `lint` rules, themes, or other commands.
- No `--inline-data` coercion of CSV strings to numbers (values remain strings in `data.values`).

## CLI Behavior

### Input detection

Extension is taken from `inputPath` using `extname`, lowercased:

| Extension | Reader |
|-----------|--------|
| `.csv` | Existing CSV parser (unchanged) |
| `.json` | New JSON array reader |
| Other | Error |

Update the infer command argument description to: `CSV or JSON input path`.

### New option

```text
--inline-data    embed parsed data in the generated spec as data.values
```

Rules:

- When omitted, generated spec uses `data: { url: <relative-path> }` for both CSV and JSON.
- When set, generated spec uses `data: { values: <array> }` only (no `url`).
- All other infer options behave as today.

Examples:

```bash
# JSON with external data file (default)
vega-paper infer results.json \
  --chart line \
  --x epoch \
  --y f1 \
  --spec-out figures/f1.vl.json

# JSON self-contained spec
vega-paper infer results.json \
  --chart line \
  --x epoch \
  --y f1 \
  --inline-data \
  --spec-out figures/f1.vl.json

# CSV self-contained spec
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --inline-data \
  --out figures/f1.svg
```

## JSON Input Rules

### Valid top-level shape

- Must parse as JSON.
- Top level must be a **non-empty array**.
- Every element must be a **plain object** (not `null`, not an array, not a primitive).

Invalid: `[]`, `{}`, `[1, 2]`, `[null]`, a Vega-Lite spec object, or any non-array JSON.

### Field list (header)

- Collect the **union of all keys** across all objects.
- Order keys by **first encounter** while scanning the array in order, then each object's own key enumeration order.

### Row normalization (for type inference)

Build `rows: string[][]` aligned to the header:

| Cell value | Normalized string |
|------------|-------------------|
| Missing key | `""` |
| `null` | `""` |
| `number`, `boolean`, `string` | `String(value)` |
| `object` or `array` | Error |

Type inference uses the same `inferFieldType()` as CSV on these string rows. Type overrides (`--x-type`, etc.) behave unchanged.

### Inline values for JSON

When `--inline-data` is set, `data.values` is the **parsed object array** as read from the file (native JSON types preserved). Normalized string rows are used only for inference, not written into `data.values`.

## CSV Inline Data Rules

When `--inline-data` is set on CSV input:

- Build `data.values` as an array of objects, one per data row.
- Keys are CSV header names; values are **always strings** from parsed cells (including empty cells as `""`).
- Do not attach `data.url`.

## Architecture

Changes are confined to `packages/cli/src/core/infer.ts` and `packages/cli/src/commands/infer.ts`.

### Core (`packages/cli/src/core/infer.ts`)

Extend `InferRequest`:

```ts
export type InferRequest = {
  // ...existing fields...
  inlineData?: boolean | undefined;
};
```

Add internal tabular loading:

```text
loadTabularInput(inputPath)
  ├─ .csv  → readCsv (existing) + optional buildValuesFromCsvRows for inline
  └─ .json → readJsonArray → { header, rows, rawObjects }
```

`inferVegaLiteSpec()`:

1. Load tabular data by extension.
2. Resolve field indices with `findFieldIndex` (rename error messages to `Field`).
3. Build encoding (unchanged logic).
4. Set `data`:
   - `inlineData` false → `{ url: toRelativeDataUrl(specOutputPath, inputPath) }`
   - `inlineData` true → `{ values: <array> }` (CSV string objects or JSON raw objects)

Export `parseJsonArray(contents: string)` (or equivalent) for unit tests alongside `parseCsv`.

Keep CSV parsing implementation unchanged.

### Command (`packages/cli/src/commands/infer.ts`)

- Register `--inline-data`.
- Pass `inlineData: Boolean(options.inlineData)` through `normalizeInferOptions()`.
- Update command argument/description text for JSON support.

Extension detection lives in core via `inputPath`; the command does not duplicate format branching.

## Data Flow

```text
vega-paper infer data.json --chart line --x epoch --y f1 --spec-out out.vl.json
  → loadTabularInput (json)
  → inferVegaLiteSpec
  → spec.data.url = relative path to data.json
  → write spec → optional lint → optional render
```

```text
vega-paper infer data.json ... --inline-data --spec-out out.vl.json
  → loadTabularInput (json)
  → inferVegaLiteSpec
  → spec.data.values = [{ epoch: 1, f1: 0.9 }, ...]
  → write spec → optional lint → optional render
```

## Error Handling

Use `VegaPaperError` for all new user-facing failures.

| Condition | Message |
|-----------|---------|
| Unsupported extension | `Unsupported input format "<ext>". Expected a .csv or .json file.` |
| JSON file missing/unreadable | `JSON file not found or unreadable: <path>` |
| Invalid JSON syntax | `Invalid JSON in input file: <path>` |
| Top level not a non-empty object array | `JSON input must be a non-empty array of objects: <path>` |
| Array element not a plain object | `JSON input must contain only objects: <path>` |
| Nested cell value | `JSON field "<key>" contains a nested value.` |
| Field not in header/keys | `Field "<name>" was not found.` |

Update existing CSV field-not-found messages from `CSV field` to `Field` for consistency.

## Lint Interaction

No lint rule changes in this slice. When `--inline-data` is used with a large dataset, existing `inline-data-large` warnings may appear after spec generation; that is expected.

## Testing

### Core (`packages/cli/test/infer.test.ts`)

- `parseJsonArray` / JSON loader: union keys, key order, missing keys, CRLF file not required for unit tests.
- JSON default: `data.url` points to relative JSON path; encoding types match string normalization.
- JSON `--inline-data`: `data.values` equals source objects; no `data.url`.
- JSON errors: invalid syntax, empty array, non-object elements, nested cell.
- CSV `--inline-data`: `data.values` is array of all-string objects; no `data.url`.
- Field-not-found uses `Field "..."` message for CSV and JSON.
- Existing CSV tests without `--inline-data` remain unchanged.

### Command (`packages/cli/test/infer-command.test.ts`)

- `--inline-data` passes `inlineData: true` on `InferRequest`.
- Omitting `--inline-data` leaves `inlineData` undefined/false.
- Unsupported extension surfaces `VegaPaperError` when exercised through command or core.

Verification:

```bash
bun test
bun run typecheck
bun run build
```

## Expected User Impact

Experiment results stored as JSON arrays can flow through the same `infer` command as CSV, with optional self-contained specs for sharing or linting without bundling a separate data file. CSV users gain the same inline embedding when needed. All existing invocations without `--inline-data` continue to behave as today.
