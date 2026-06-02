# VegaPaper Infer MVP Design

## Context

VegaPaper now has a Bun-first CLI with SVG rendering, theme inspection, doctor checks, and static linting with selectable profiles. The next CLI MVP slice is `vega-paper infer`: a constrained, deterministic way to create a Vega-Lite spec from a CSV file and optionally render it through the existing render workflow.

The broader project goal is not free-form natural-language chart generation. In the MVP, the user or AI agent explicitly provides the chart type and encoding fields, and VegaPaper produces reproducible Vega-Lite artifacts.

## Goals

- Add `vega-paper infer` for CSV input.
- Support `line`, `bar`, and `scatter` charts.
- Require explicit `--chart`, `--x`, and `--y` options.
- Support optional `--color`, `--title`, `--width`, `--height`, `--theme`, `--out`, and `--spec-out`.
- Generate a Vega-Lite JSON spec with `data.url` pointing to the input CSV.
- Save the generated spec either to `--spec-out` or next to `--out`.
- Optionally render SVG by reusing the existing render core when `--out` is provided.
- Keep linting out of this slice.

## Non-Goals

- No JSON input support.
- No TSV, JSONL, Parquet, Arrow, or dataframe bridge.
- No natural-language chart intent parser.
- No chart type auto-detection.
- No field role auto-selection.
- No aggregation, binning, sorting, faceting, error bands, or tooltips.
- No type override options such as `--x-type`.
- No automatic lint execution.
- No PDF or PNG output from `infer` in this slice.

## CLI Behavior

Example:

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "F1 by epoch" \
  --theme paper-clean \
  --out figures/f1.svg
```

Supported options:

```text
--chart <type>     line | bar | scatter
--x <field>        required x encoding field
--y <field>        required y encoding field
--color <field>    optional color encoding field
--title <text>     optional chart title
--width <number>   optional chart width
--height <number>  optional chart height
--theme <name>     optional theme name, used only when rendering
--out <path>       optional SVG output path
--spec-out <path>  optional Vega-Lite spec output path
```

At least one of `--out` or `--spec-out` is required.

If `--spec-out` is provided, the generated spec is written there.

If `--out` is provided without `--spec-out`, the generated spec is written next to the SVG output by replacing the `.svg` extension with `.vl.json`. For example:

```text
figures/f1.svg -> figures/f1.vl.json
```

If both `--spec-out` and `--out` are provided, the generated spec is written to `--spec-out`, and that same file is passed to the render core.

`--out` must end in `.svg` for this MVP. The render path uses the existing SVG render implementation and should inherit its theme behavior and render backend errors.

`--theme` is valid only when `--out` is provided. When only writing a spec, no theme is applied because theme application belongs to rendering.

## Architecture

Use a Core Spec Generator plus Command Orchestration.

### Core

Add `packages/cli/src/core/infer.ts`.

Responsibilities:

- Read a CSV file.
- Parse header and rows.
- Validate requested fields.
- Infer minimal Vega-Lite field types.
- Build a Vega-Lite spec object.
- Return the generated spec and metadata needed by the command.

Public types:

```ts
export type InferChartType = "line" | "bar" | "scatter";

export type InferRequest = {
  inputPath: string;
  chart: string;
  xField: string;
  yField: string;
  colorField?: string | undefined;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  specOutputPath: string;
};

export type InferResult = {
  spec: JsonObject;
};
```

The core does not render. It does not know about `--out` or themes. It only needs `specOutputPath` to compute the `data.url` relative to the generated spec file.

### Command

Add `packages/cli/src/commands/infer.ts`.

Responsibilities:

- Parse CLI options with Commander.
- Validate command-level output rules.
- Resolve the spec output path.
- Call `inferVegaLiteSpec()`.
- Create the parent directory for the generated spec when needed.
- Write the generated spec.
- If `--out` is provided, call the existing render core with the generated spec path.

Update `packages/cli/src/index.ts` to register the new command.

## Data Flow

```text
vega-paper infer results.csv --chart line --x epoch --y f1 --theme paper-clean --out figures/f1.svg
  -> infer command parses options
  -> resolve spec path as figures/f1.vl.json
  -> inferVegaLiteSpec({ inputPath, chart, xField, yField, specOutputPath })
  -> write figures/f1.vl.json
  -> renderChart({
       inputPath: "figures/f1.vl.json",
       outputPath: "figures/f1.svg",
       format: "svg",
       themeName: "paper-clean"
     })
```

## Generated Vega-Lite Spec

The generated spec uses Vega-Lite v6 schema and `data.url`.

Example:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "../results.csv" },
  "mark": "line",
  "encoding": {
    "x": { "field": "epoch", "type": "quantitative", "title": "epoch" },
    "y": { "field": "f1", "type": "quantitative", "title": "f1" },
    "color": { "field": "model", "type": "nominal", "title": "model" }
  },
  "title": "F1 by epoch",
  "width": 360,
  "height": 240
}
```

Chart mapping:

- `line` -> `mark: "line"`
- `bar` -> `mark: "bar"`
- `scatter` -> `mark: "point"`

Defaults:

- `width`: `360`
- `height`: `240`
- `title`: omitted unless `--title` is provided
- `color`: omitted unless `--color` is provided

`data.url` should be relative from the directory containing the generated spec file to the input CSV file. Use forward slashes in the generated spec, even on platforms whose native path separator differs. This keeps the spec portable within a paper repository.

## CSV Parsing

The MVP supports simple comma-separated CSV with a single header row.

Rules:

- The first row is the header.
- Header names must be non-empty after trimming.
- Field lookup uses trimmed header names.
- Rows may contain quoted values, commas inside quoted values, and escaped double quotes.
- Empty trailing cells are preserved.
- Empty lines are ignored.
- Values are used only for type inference; the generated spec references the CSV via `data.url`.

Implement this as a small parser function in `core/infer.ts`. No broad data-processing dependency is required for this slice.

## Type Inference

Minimal inference:

- For `x` and `y`, inspect non-empty values in the selected field.
- If every non-empty value parses as a finite number, use `quantitative`.
- Otherwise use `nominal`.
- If a field has only empty values, use `nominal`.
- `color` is always `nominal` in this MVP, even if all values are numeric.

No temporal inference is included in this slice.

## Error Handling

Use `VegaPaperError` for user-facing errors.

Errors:

- CSV file cannot be read.
- CSV is empty.
- CSV has no header row.
- A header name is empty after trimming.
- `--chart` is not `line`, `bar`, or `scatter`.
- `--x` is missing.
- `--y` is missing.
- `--x`, `--y`, or `--color` references a field not present in the header.
- Neither `--out` nor `--spec-out` is provided.
- `--theme` is provided without `--out`.
- `--out` does not end in `.svg`.
- `--width` or `--height` is provided but is not a positive finite number.

Render errors from the existing render core should propagate unchanged.

## Testing

Add focused core tests for:

- CSV parsing with header and rows.
- Quoted CSV values with commas and escaped quotes.
- Line spec generation.
- Bar and scatter mark mapping.
- Numeric `x` and `y` infer as `quantitative`.
- String `x` or `y` infer as `nominal`.
- `color` is always `nominal`.
- Missing field errors.
- Empty CSV errors.
- Invalid chart type errors.
- Relative `data.url` from spec output path to input CSV.

Add command tests for:

- `--spec-out` writes only the generated spec.
- `--out` without `--spec-out` writes a sibling `.vl.json` and calls the render runner.
- `--spec-out` with `--out` renders from the explicit spec path.
- `--theme` is passed to the render runner.
- `--theme` without `--out` throws a `VegaPaperError`.
- Missing both `--out` and `--spec-out` throws a `VegaPaperError`.
- Non-SVG `--out` throws a `VegaPaperError`.

Acceptance checks:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Smoke command:

```bash
vega-paper infer examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y accuracy \
  --color model \
  --theme paper-clean \
  --out examples/training-curve/output.svg
```

Expected:

- `examples/training-curve/output.vl.json` exists.
- `examples/training-curve/output.svg` exists.
- Generated spec references `data.csv` through `data.url`.

## Expected User Impact

Users and AI agents can turn a CSV experiment result into a reproducible Vega-Lite spec and optional SVG with one constrained command. The first version intentionally favors predictable behavior over automatic chart intelligence, leaving richer inference, JSON input, lint integration, and aggregation for later slices.
