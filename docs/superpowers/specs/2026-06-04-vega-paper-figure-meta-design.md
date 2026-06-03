# VegaPaper Figure Meta Design

Date: 2026-06-04

## Context

`initial-design.md` §11.2 defines a reproducibility bundle for paper figures:

```text
figure.svg
figure.vl.json
figure.vg.json
figure.data.csv
figure.meta.json
```

The CLI already writes Vega-Lite specs via `infer --spec-out` / implicit sibling `.vl.json`, and SVG via `infer --out`. **`figure.meta.json` is not implemented yet.**

This slice adds provenance metadata when `infer` completes the full infer → spec → render pipeline.

## Goals

- When `vega-paper infer … --out <path.svg>` succeeds, also write a sibling `<path>.meta.json`.
- Record enough information to reproduce the infer + render run from a paper repository.
- Match `initial-design.md` core fields plus `specOut` and an `infer` options snapshot.
- Read installed `vega` and `vega-lite` versions from `node_modules` at write time.
- Keep logic in a dedicated core helper; wire it from `infer` after a successful render only.

## Non-Goals

- Writing meta from `vega-paper render` (follow-up slice).
- Opt-in flags such as `--meta-out` or `--write-meta`.
- Full reproducibility bundle: copying data, saving `.vg.json`, or `--save-spec` / `--save-vega`.
- `vegaPaperVersion`, lint profile, or `strict` in meta (follow-up).
- Path normalization to absolute paths or cwd-relative rewrites.
- Schema validation CLI or JSON Schema publication in this slice.

## User-Facing Behavior

No new flags. Existing usage gains a sidecar file:

```bash
vega-paper infer examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --theme paper-clean \
  --out examples/training-curve/output.svg
```

Writes:

```text
examples/training-curve/chart.vl.json   # implicit specOut (existing)
examples/training-curve/output.svg       # render output (existing)
examples/training-curve/output.meta.json # new
```

Stdout should include a third line after render, e.g. `Wrote examples/training-curve/output.meta.json`.

When `--spec-out` is explicit, `specOut` in meta records that CLI string. When omitted, meta records the derived sibling path (same rule as `toSiblingSpecPath`).

## Write Timing

| Event | Meta written? |
|-------|----------------|
| Spec write succeeds, no `--out` | No |
| Lint exits non-zero before render | No |
| Render succeeds after `--out` | Yes |
| Render throws | No (infer fails as today) |

Meta is written **after** render succeeds, not before.

## Meta File Path

Derive from `--out` the same way spec paths are derived today:

```ts
// figures/f1.svg → figures/f1.meta.json
function toSiblingMetaPath(outputPath: string): string
```

Do **not** base meta location on `--spec-out` when `--out` is set.

## JSON Schema

Top-level provenance fields (always present when meta is written):

| Field | Type | Description |
|-------|------|-------------|
| `generatedBy` | `"vega-paper"` | Fixed literal |
| `input` | `string` | CLI `<input>` argument, as passed |
| `output` | `string` | `--out` value, as passed |
| `specOut` | `string` | `--spec-out` if passed, else derived `.vl.json` sibling of `--out` |
| `createdAt` | `string` | ISO 8601 UTC (`Date.toISOString()`) |
| `vegaVersion` | `string` | Installed `vega` package version |
| `vegaLiteVersion` | `string` | Installed `vega-lite` package version |
| `theme` | `string` | Present only when `--theme` was passed |
| `infer` | `object` | Infer options snapshot (see below) |

### `infer` snapshot

Nested object. Include **only options the user effectively set** (omit unset optional keys).

| Key | Source | Notes |
|-----|--------|-------|
| `chart` | `--chart` | Always set (required) |
| `x` | `--x` | Always set (required) |
| `y` | `--y` | Always set (required) |
| `color` | `--color` | Optional |
| `facet` | `--facet` | Optional |
| `aggregate` | `--aggregate` | Optional |
| `errorBand` | `--error-band` | camelCase in JSON |
| `inlineData` | `--inline-data` | `true` only when flag passed |
| `xType` | `--x-type` | Optional |
| `yType` | `--y-type` | Optional |
| `colorType` | `--color-type` | Optional |
| `title` | `--title` | Optional |
| `width` | `--width` | number |
| `height` | `--height` | number |

Do not include `lintProfile`, `strict`, or internal `specOutputPath` field names from `InferRequest`.

### Example

```json
{
  "generatedBy": "vega-paper",
  "theme": "paper-clean",
  "input": "examples/training-curve/data.csv",
  "output": "examples/training-curve/output.svg",
  "specOut": "examples/training-curve/chart.vl.json",
  "createdAt": "2026-06-03T12:00:00.000Z",
  "vegaVersion": "6.2.0",
  "vegaLiteVersion": "6.4.1",
  "infer": {
    "chart": "line",
    "x": "epoch",
    "y": "f1",
    "color": "model",
    "title": "Training F1"
  }
}
```

Without `--theme`:

```json
{
  "generatedBy": "vega-paper",
  "input": "data.csv",
  "output": "figure.svg",
  "specOut": "figure.vl.json",
  "createdAt": "2026-06-03T12:00:00.000Z",
  "vegaVersion": "6.2.0",
  "vegaLiteVersion": "6.4.1",
  "infer": {
    "chart": "line",
    "x": "epoch",
    "y": "f1"
  }
}
```

File format: UTF-8 JSON with trailing newline, `JSON.stringify(meta, null, 2)`.

## Architecture

| File | Purpose |
|------|---------|
| `packages/cli/src/core/figure-meta.ts` | Types, `buildFigureMeta`, `toSiblingMetaPath`, `writeFigureMeta`, version lookup |
| `packages/cli/src/commands/infer.ts` | Call meta writer after successful render |
| `packages/cli/test/figure-meta.test.ts` | Pure helper tests |
| `packages/cli/test/infer-command.test.ts` | Integration: meta written on `--out`, not without |

### Core API (sketch)

```ts
export type FigureMetaInferSnapshot = {
  chart: InferChartType;
  x: string;
  y: string;
  color?: string;
  facet?: string;
  aggregate?: InferAggregateMethod;
  errorBand?: string;
  inlineData?: true;
  xType?: VegaLiteFieldType;
  yType?: VegaLiteFieldType;
  colorType?: VegaLiteFieldType;
  title?: string;
  width?: number;
  height?: number;
};

export type FigureMeta = {
  generatedBy: "vega-paper";
  input: string;
  output: string;
  specOut: string;
  createdAt: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
  infer: FigureMetaInferSnapshot;
};

export function toSiblingMetaPath(outputPath: string): string;

export function buildFigureMeta(input: BuildFigureMetaInput): FigureMeta;

export async function writeFigureMeta(
  metaOutputPath: string,
  meta: FigureMeta,
): Promise<void>;
```

### Version lookup

Resolve installed versions at runtime:

1. Locate `packages/cli/node_modules/vega/package.json` and `vega-lite/package.json` via workspace-relative paths (same resolution strategy as other CLI dependency reads).
2. Read `"version"` from each.
3. If a package cannot be read, throw `VegaPaperError` with a clear message (meta write should not silently omit versions).

Use semver strings as stored in package.json (no `"latest"` from workspace dependencies).

### Building the infer snapshot

Map from normalized `InferRequest` + raw CLI options:

- Required infer keys always appear: `chart`, `x`, `y`.
- Optional keys appear only when the corresponding CLI option was provided (not merely inferred defaults for width/height).
- `inlineData: true` only when `--inline-data` flag was present.

Prefer passing explicit CLI option presence from `infer.ts` into `buildFigureMeta` rather than inferring “was this set?” from `InferRequest` alone (width/height defaults live in core infer, not in request).

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Meta directory not writable | `VegaPaperError`: could not write meta (same pattern as spec write) |
| Vega package.json missing | `VegaPaperError` with package name |
| Render failed | No meta file; existing render error |

## Testing

### `figure-meta.test.ts`

- `toSiblingMetaPath("figures/f1.svg")` → `"figures/f1.meta.json"`
- `buildFigureMeta` omits `theme` when unset
- `buildFigureMeta` includes only provided optional infer keys
- `errorBand` camelCase from `--error-band`
- Version lookup returns installed semver (mock or read real node_modules in test)

### `infer-command.test.ts`

- With `--out`, mocked render succeeds → meta file created at sibling path, stdout mentions it
- Without `--out` → no meta file
- Lint strict failure before render → no meta file
- Meta JSON parses and contains expected top-level + `infer` fields

## Future Work

- `render` command meta sidecar
- `vegaPaperVersion` field
- Lint provenance (`lintProfile`, `strict`)
- Optional full bundle flags aligned with `initial-design.md` §11.2
