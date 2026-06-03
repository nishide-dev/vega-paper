# VegaPaper Render Meta Design

Date: 2026-06-04

## Context

PR #21 added `figure.meta.json` for `vega-paper infer … --out`. The follow-up slice covers hand-written spec rendering:

```bash
vega-paper render chart.vl.json --theme paper-clean --out figures/f1.svg
```

`render` always requires `--out`, so every successful render can emit provenance metadata using the same sibling path rule as infer.

## Goals

- Write `<out>.meta.json` after `vega-paper render` succeeds.
- Add `"command": "render"` to render meta; add `"command": "infer"` to existing infer meta in the same slice.
- Reuse `core/figure-meta.ts` helpers (`toSiblingMetaPath`, version lookup, file write).
- Record CLI paths as passed; omit unset optional keys.

## Non-Goals

- `vegaPaperVersion` (next slice).
- `format` in render meta (MVP is SVG-only).
- `specOut` on render meta (spec path is `input`).
- `infer` snapshot on render meta.
- Full reproducibility bundle (data copy, `.vg.json` save).

## User-Facing Behavior

No new flags:

```bash
vega-paper render chart.vl.json --theme paper-clean --out figures/f1.svg
```

Writes:

```text
figures/f1.svg
figures/f1.meta.json
```

Stdout:

```text
Rendered figures/f1.svg
Wrote figures/f1.meta.json
```

## Write Timing

| Event | Meta written? |
|-------|----------------|
| Render succeeds | Yes |
| Render throws | No |

## Meta File Path

Same as infer: `toSiblingMetaPath("--out")` → `figures/f1.svg` → `figures/f1.meta.json`.

## JSON Schema

### Shared base fields

| Field | Type | Notes |
|-------|------|-------|
| `generatedBy` | `"vega-paper"` | Fixed |
| `command` | `"infer"` \| `"render"` | Required on all new meta |
| `input` | `string` | infer: data path; render: spec path |
| `output` | `string` | `--out` as passed |
| `createdAt` | `string` | ISO 8601 UTC |
| `vegaVersion` | `string` | Installed `vega` version |
| `vegaLiteVersion` | `string` | Installed `vega-lite` version |
| `theme` | `string` | Only when `--theme` passed |

### Render-only shape

No `specOut`, no `infer`, no `format`.

```json
{
  "generatedBy": "vega-paper",
  "command": "render",
  "theme": "paper-clean",
  "input": "chart.vl.json",
  "output": "figures/f1.svg",
  "createdAt": "2026-06-03T12:00:00.000Z",
  "vegaVersion": "6.2.0",
  "vegaLiteVersion": "6.4.1"
}
```

### Infer shape change

Add `"command": "infer"`; all other infer meta fields unchanged.

```json
{
  "generatedBy": "vega-paper",
  "command": "infer",
  "input": "data.csv",
  "output": "figures/f1.svg",
  "specOut": "figures/f1.vl.json",
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

## Architecture

| File | Change |
|------|--------|
| `packages/cli/src/core/figure-meta.ts` | Discriminated `FigureMeta` types; `buildRenderFigureMeta`; infer builder adds `command: "infer"` |
| `packages/cli/src/commands/render.ts` | Write meta after successful render; optional DI for tests |
| `packages/cli/src/commands/infer.ts` | No logic change beyond updated builder output |
| `packages/cli/test/figure-meta.test.ts` | Render builder + infer `command` field |
| `packages/cli/test/render-command.test.ts` | **New** command integration tests |
| `packages/cli/test/infer-command.test.ts` | Expect `command: "infer"` |

## Core API (sketch)

```ts
export type InferFigureMeta = {
  generatedBy: "vega-paper";
  command: "infer";
  input: string;
  output: string;
  specOut: string;
  createdAt: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
  infer: FigureMetaInferSnapshot;
};

export type RenderFigureMeta = {
  generatedBy: "vega-paper";
  command: "render";
  input: string;
  output: string;
  createdAt: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
};

export type FigureMeta = InferFigureMeta | RenderFigureMeta;

export function buildRenderFigureMeta(input: BuildRenderFigureMetaInput): RenderFigureMeta;
```

## Testing

### `figure-meta.test.ts`

- `buildRenderFigureMeta` omits `theme` when unset
- `buildFigureMeta` includes `command: "infer"`

### `render-command.test.ts`

- Successful render writes sibling meta with `command: "render"`, no `specOut` / `infer`
- `--theme` recorded when set
- Stdout includes `Wrote …meta.json`

### `infer-command.test.ts`

- Existing meta test expects `command: "infer"`

## Future Work

- `vegaPaperVersion` on both meta shapes
- `format` when PDF/PNG land
- Lint provenance on infer meta
