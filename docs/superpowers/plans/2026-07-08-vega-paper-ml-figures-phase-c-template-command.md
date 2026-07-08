# Phase C: `vega-paper template` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `vega-paper template <template-name> <data> [options]` command with four structured ML-paper figure templates (`benchmark-heatmap`, `pareto-frontier`, `scaling-law`, `calibration-curve`), template figure metadata, and wired example folders.

**Architecture:** A new command file `packages/cli/src/commands/template.ts` mirrors the existing `commands/infer.ts` pattern (injectable dependencies, commander registration, `Wrote`/`Rendered` stdout lines). It parses CLI options into a discriminated-union `TemplateRequest`, loads the CSV with the existing `parseCsv` utility, and calls a pure synchronous dispatcher `buildTemplateSpec(request): JsonObject` in `packages/cli/src/core/template.ts`, which delegates to one builder file per template under `packages/cli/src/core/templates/`. Rendering reuses `renderChart` via `buildRenderRequest`; metadata extends `core/figure-meta.ts` with a `TemplateFigureMeta` variant (`command: "template"`).

**Tech Stack:** Bun 1.3.14 workspace, TypeScript, commander, Vega-Lite v6, biome, `bun test`.

**Spec:** `docs/vega-paper-ml-conference-figures-spec.md` — Phase C (§12), driven by §7.3 (template path), §7.4, §7.5, §7.6, and §8.

## Global Constraints

- Vega-Lite schema URL: `https://vega.github.io/schema/vega-lite/v6.json` (exactly, as in `core/infer.ts`).
- Default chart size: width `360`, height `240` (same constants as `infer`).
- All user-facing errors are `VegaPaperError` from `packages/cli/src/core/errors.ts` (message strings are exact; tests assert them verbatim).
- stdout lines match existing style exactly: `Wrote <path>\n` for spec/meta files, `Rendered <path>\n` for rendered output (spec §8.3).
- Mandated names (later phases depend on them — do not deviate): `packages/cli/src/commands/template.ts`; `packages/cli/src/core/template.ts` exporting `buildTemplateSpec(request: TemplateRequest): JsonObject` and `type TemplateName = "benchmark-heatmap" | "pareto-frontier" | "scaling-law" | "calibration-curve"`; builders `packages/cli/src/core/templates/benchmark-heatmap.ts` (`buildBenchmarkHeatmapSpec`), `templates/pareto-frontier.ts` (`buildParetoFrontierSpec`), `templates/scaling-law.ts` (`buildScalingLawSpec`), `templates/calibration-curve.ts` (`buildCalibrationCurveSpec`).
- Reuse existing utilities by name: `parseCsv`, `findFieldIndex`, `toRelativeDataUrl` (from `core/infer.ts`), `renderChart` (`core/render.ts`), `buildRenderRequest` (`core/render-format.ts`), `toSiblingMetaPath`, `resolveFigureMetaVersions`, `writeFigureMeta` (`core/figure-meta.ts`), `writeSpecFile`, `toSiblingSpecPath` (`commands/infer.ts`).
- No new dependencies. Code style: biome (double quotes, trailing commas, 100-col); run `bun run check` before each commit.
- Commit messages follow repo convention: `feat: ...`.
- All commands below run from the repo root `/Users/ryusei0623/projects/vega-paper`.

## Design Decisions (resolved spec ambiguities)

1. **Top-level command** (spec Open Question 1): `template` is a new top-level command, not an `infer` submode (mandated by this phase).
2. **Pareto frontier computation** (spec Open Question 4): the `max-y-min-x` frontier is computed **in TypeScript from the CSV rows at spec-generation time** and injected as an **inline `data.values` layer** in the generated spec. Templates are allowed this semantic computation; the base scatter/label layers still reference the CSV via `data.url` so the figure stays reproducible from committed artifacts. Algorithm: parse x/y as numbers, sort by x ascending (ties: y descending), scan keeping points whose y strictly exceeds the running maximum.
3. **No calibration metric computation** (spec §7.6 acceptance criteria): `calibration-curve` requires pre-binned input; `--ece` is a user-supplied annotation value only. The count histogram subplot is deferred; `--count` maps bin counts to point size in v1.
4. **`--label` default for benchmark-heatmap**: defaults to the `--score` field. When the label field equals the score field the text encoding is quantitative with `format: ".1f"`; otherwise nominal with no format.
5. **scaling-law fit method**: `--fit regression` emits a Vega-Lite `transform: [{ regression: <y>, on: <x>, method: "log" | "linear", groupby?: [<color>] }]` layer — `"log"` when `--x-scale log` is set (scaling-law convention), `"linear"` otherwise.
6. **`zero: false` y scales**: `pareto-frontier` and `scaling-law` y encodings use `scale: { zero: false }` (scores/losses far from zero), matching the existing boxplot precedent.
7. **CSV-only input in v1**: template input must be a `.csv` file (all spec §7 template examples are CSV). JSON input can be added later without CLI changes.
8. **Metadata** (spec §8.4): `.meta.json` is written only when `--out` is passed (matches `infer` behavior; the spec's stdout example only shows meta next to rendered output). `options` snapshot contains template-specific options only with camelCase keys (`x`, `y`, `score`, `label`, `highlightBest`, `color`, `size`, `xScale`, `frontier`, `fit`, `confidence`, `accuracy`, `count`, `ece`); `title`/`width`/`height` are already captured in the committed spec.
9. **No `--lint-profile` on template v1** (YAGNI): spec §8.3 does not require lint integration for templates; `vega-paper lint` can be run on the written spec separately.
10. **Validation order**: template name and output-path options are validated first, then the CSV is loaded, then per-template options (required fields, enum values) are validated, then builders validate that fields exist in the CSV header. The CSV loader is an injectable dependency so option-validation tests stub it.
11. **`examples/benchmark-heatmap/`** (prerequisite: Phase B has landed): Phase B owns `examples/benchmark-heatmap/data.csv`, `README.md`, `chart.vl.json`, and the hand-written 2-layer `chart-labeled.vl.json` (plus an examples test asserting `chart-labeled.vl.json` has exactly 2 layers). This plan does NOT create or overwrite any of those files. It only ADDS the template-generated spec under a new name, `examples/benchmark-heatmap/chart-template.vl.json`, generated from Phase B's committed `data.csv`, and appends a template section to Phase B's `README.md` via a targeted sentence replacement (Task 10). If Phase B has not landed yet, pause Task 10 until it does.

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | export `findFieldIndex`, `toRelativeDataUrl` |
| `packages/cli/src/core/template.ts` | **create**: `TemplateName`, `TemplateRequest` union, `parseTemplateName`, `buildTemplateSpec` |
| `packages/cli/src/core/templates/shared.ts` | **create**: schema/size constants, `getCell`, `parseNumericCell`, `buildTemplateFrame` |
| `packages/cli/src/core/templates/benchmark-heatmap.ts` | **create**: `buildBenchmarkHeatmapSpec`, `computeBestCells` |
| `packages/cli/src/core/templates/pareto-frontier.ts` | **create**: `buildParetoFrontierSpec`, `computeMaxYMinXFrontier` |
| `packages/cli/src/core/templates/scaling-law.ts` | **create**: `buildScalingLawSpec` |
| `packages/cli/src/core/templates/calibration-curve.ts` | **create**: `buildCalibrationCurveSpec` |
| `packages/cli/src/core/figure-meta.ts` | add `TemplateFigureMeta`, `TemplateOptionsSnapshot`, `buildTemplateFigureMeta`; widen `FigureMeta` |
| `packages/cli/src/commands/infer.ts` | export `writeSpecFile`, `toSiblingSpecPath` |
| `packages/cli/src/commands/template.ts` | **create**: `registerTemplateCommand`, `buildTemplateRequest`, `buildTemplateOptionsSnapshot` |
| `packages/cli/src/index.ts` | register template command |
| `packages/cli/test/infer.test.ts` | tests for newly exported utilities |
| `packages/cli/test/template.test.ts` | **create**: `parseTemplateName`, `parseNumericCell`, `buildTemplateSpec` dispatch |
| `packages/cli/test/template-benchmark-heatmap.test.ts` | **create** |
| `packages/cli/test/template-pareto-frontier.test.ts` | **create** |
| `packages/cli/test/template-scaling-law.test.ts` | **create** |
| `packages/cli/test/template-calibration-curve.test.ts` | **create** |
| `packages/cli/test/figure-meta.test.ts` | `buildTemplateFigureMeta` tests |
| `packages/cli/test/template-command.test.ts` | **create** |
| `packages/cli/test/examples.test.ts` | structure tests for the four template example specs |
| `examples/benchmark-heatmap/` | **extend** (Phase B files are prerequisites): modify `README.md` (append template section), add generated `chart-template.vl.json` |
| `examples/pareto-frontier/` | **create**: `README.md`, `data.csv`, generated `chart.vl.json` |
| `examples/scaling-law/` | **create**: `README.md`, `data.csv`, generated `chart.vl.json` |
| `examples/calibration-curve/` | **create**: `README.md`, `data.csv`, generated `chart.vl.json` |
| `package.json` (root) | `template:*` scripts and `template:examples` chain |

---

### Task 1: Export CSV field utilities from `core/infer.ts`

The template builders reuse `infer`'s header validation (`findFieldIndex`) and relative data URL computation (`toRelativeDataUrl`). Both already exist as private functions in `packages/cli/src/core/infer.ts`; export them unchanged.

**Files:**
- Modify: `packages/cli/src/core/infer.ts` (functions `findFieldIndex` around line 446 and `toRelativeDataUrl` around line 481)
- Test: `packages/cli/test/infer.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function findFieldIndex(header: string[], field: string): number` (throws `VegaPaperError` `'Field "<field>" was not found.'`); `export function toRelativeDataUrl(specOutputPath: string, inputPath: string): string`.

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/infer.test.ts`, change the import line

```typescript
import { type InferRequest, inferVegaLiteSpec, parseCsv, parseJsonArray } from "../src/core/infer";
```

to

```typescript
import {
  findFieldIndex,
  type InferRequest,
  inferVegaLiteSpec,
  parseCsv,
  parseJsonArray,
  toRelativeDataUrl,
} from "../src/core/infer";
```

and append these describe blocks at the end of the file:

```typescript
describe("findFieldIndex", () => {
  test("returns the index of an existing field", () => {
    expect(findFieldIndex(["model", "task", "score"], "task")).toBe(1);
  });

  test("throws VegaPaperError for a missing field", () => {
    expect(() => findFieldIndex(["model", "task"], "score")).toThrow(
      new VegaPaperError('Field "score" was not found.'),
    );
  });
});

describe("toRelativeDataUrl", () => {
  test("computes the data url relative to the spec directory", () => {
    expect(
      toRelativeDataUrl("examples/pareto-frontier/chart.vl.json", "examples/pareto-frontier/data.csv"),
    ).toBe("data.csv");
    expect(toRelativeDataUrl("figures/chart.vl.json", "results.csv")).toBe("../results.csv");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/infer.test.ts`
Expected: FAIL — `SyntaxError: Export named 'findFieldIndex' not found in module '.../src/core/infer.ts'`.

- [ ] **Step 3: Export the functions**

In `packages/cli/src/core/infer.ts` change

```typescript
function findFieldIndex(header: string[], field: string): number {
```

to

```typescript
export function findFieldIndex(header: string[], field: string): number {
```

and change

```typescript
function toRelativeDataUrl(specOutputPath: string, inputPath: string): string {
```

to

```typescript
export function toRelativeDataUrl(specOutputPath: string, inputPath: string): string {
```

No other changes to either function body.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/infer.test.ts`
Expected: PASS (all existing tests plus 4 new assertions, `0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: export csv field utilities for template builders"
```

---

### Task 2: Template core types, `parseTemplateName`, and shared builder helpers

**Files:**
- Create: `packages/cli/src/core/template.ts` (types + `parseTemplateName`; `buildTemplateSpec` is added in Task 7)
- Create: `packages/cli/src/core/templates/shared.ts`
- Test: `packages/cli/test/template.test.ts`

**Interfaces:**
- Consumes: `VegaPaperError` (`core/errors.ts`), `JsonObject` (`core/spec.ts`), `toRelativeDataUrl` (Task 1).
- Produces (consumed by Tasks 3–9 and later phases):
  - `TEMPLATE_NAMES: readonly ["benchmark-heatmap", "pareto-frontier", "scaling-law", "calibration-curve"]`
  - `type TemplateName = "benchmark-heatmap" | "pareto-frontier" | "scaling-law" | "calibration-curve"`
  - `type TemplateTable = { header: string[]; rows: string[][] }`
  - `type TemplateAxisScale = "linear" | "log"`
  - `type TemplateCommonRequest`, per-template option types, per-template request types, `type TemplateRequest` (see code below)
  - `parseTemplateName(value: string): TemplateName`
  - From `templates/shared.ts`: `TEMPLATE_VEGA_LITE_SCHEMA`, `TEMPLATE_DEFAULT_WIDTH = 360`, `TEMPLATE_DEFAULT_HEIGHT = 240`, `getCell(row: string[], index: number): string`, `parseNumericCell(value: string, field: string): number`, `buildTemplateFrame(request: TemplateCommonRequest, layer: JsonObject[]): JsonObject`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/template.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import { parseTemplateName } from "../src/core/template";
import { parseNumericCell } from "../src/core/templates/shared";

describe("parseTemplateName", () => {
  test("accepts the four initial template names", () => {
    expect(parseTemplateName("benchmark-heatmap")).toBe("benchmark-heatmap");
    expect(parseTemplateName("pareto-frontier")).toBe("pareto-frontier");
    expect(parseTemplateName("scaling-law")).toBe("scaling-law");
    expect(parseTemplateName("calibration-curve")).toBe("calibration-curve");
  });

  test("rejects unknown template names", () => {
    expect(() => parseTemplateName("violin")).toThrow(
      new VegaPaperError(
        'Unknown template "violin". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve.',
      ),
    );
  });
});

describe("parseNumericCell", () => {
  test("parses plain and scientific-notation numbers", () => {
    expect(parseNumericCell("68.2", "score")).toBe(68.2);
    expect(parseNumericCell(" 12 ", "latency_ms")).toBe(12);
    expect(parseNumericCell("1.2e20", "flops")).toBe(1.2e20);
  });

  test("rejects empty and non-numeric cells", () => {
    expect(() => parseNumericCell("", "score")).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "".'),
    );
    expect(() => parseNumericCell("n/a", "score")).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "n/a".'),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template.test.ts`
Expected: FAIL — `Cannot find module '../src/core/template'`.

- [ ] **Step 3: Create `packages/cli/src/core/template.ts`**

```typescript
import { VegaPaperError } from "./errors";

export const TEMPLATE_NAMES = [
  "benchmark-heatmap",
  "pareto-frontier",
  "scaling-law",
  "calibration-curve",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export type TemplateTable = {
  header: string[];
  rows: string[][];
};

export type TemplateAxisScale = "linear" | "log";

export type TemplateCommonRequest = {
  inputPath: string;
  specOutputPath: string;
  table: TemplateTable;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

export type BenchmarkHeatmapOptions = {
  xField: string;
  yField: string;
  scoreField: string;
  labelField?: string | undefined;
  highlightBest?: boolean | undefined;
};

export type ParetoFrontierOptions = {
  xField: string;
  yField: string;
  labelField?: string | undefined;
  colorField?: string | undefined;
  sizeField?: string | undefined;
  xScale?: TemplateAxisScale | undefined;
  frontier?: "max-y-min-x" | undefined;
};

export type ScalingLawOptions = {
  xField: string;
  yField: string;
  colorField?: string | undefined;
  xScale?: TemplateAxisScale | undefined;
  fit?: "regression" | undefined;
};

export type CalibrationCurveOptions = {
  confidenceField: string;
  accuracyField: string;
  countField?: string | undefined;
  ece?: number | undefined;
};

export type BenchmarkHeatmapRequest = TemplateCommonRequest & {
  template: "benchmark-heatmap";
  options: BenchmarkHeatmapOptions;
};

export type ParetoFrontierRequest = TemplateCommonRequest & {
  template: "pareto-frontier";
  options: ParetoFrontierOptions;
};

export type ScalingLawRequest = TemplateCommonRequest & {
  template: "scaling-law";
  options: ScalingLawOptions;
};

export type CalibrationCurveRequest = TemplateCommonRequest & {
  template: "calibration-curve";
  options: CalibrationCurveOptions;
};

export type TemplateRequest =
  | BenchmarkHeatmapRequest
  | ParetoFrontierRequest
  | ScalingLawRequest
  | CalibrationCurveRequest;

export function parseTemplateName(value: string): TemplateName {
  if ((TEMPLATE_NAMES as readonly string[]).includes(value)) {
    return value as TemplateName;
  }

  throw new VegaPaperError(
    `Unknown template "${value}". Expected one of: ${TEMPLATE_NAMES.join(", ")}.`,
  );
}
```

- [ ] **Step 4: Create `packages/cli/src/core/templates/shared.ts`**

```typescript
import { VegaPaperError } from "../errors";
import { toRelativeDataUrl } from "../infer";
import type { JsonObject } from "../spec";
import type { TemplateCommonRequest } from "../template";

export const TEMPLATE_VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";
export const TEMPLATE_DEFAULT_WIDTH = 360;
export const TEMPLATE_DEFAULT_HEIGHT = 240;

export function getCell(row: string[], index: number): string {
  return row[index] ?? "";
}

export function parseNumericCell(value: string, field: string): number {
  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);

  if (trimmedValue === "" || !Number.isFinite(numericValue)) {
    throw new VegaPaperError(`Field "${field}" contains a non-numeric value "${value}".`);
  }

  return numericValue;
}

export function buildTemplateFrame(
  request: TemplateCommonRequest,
  layer: JsonObject[],
): JsonObject {
  const spec: JsonObject = {
    $schema: TEMPLATE_VEGA_LITE_SCHEMA,
    data: { url: toRelativeDataUrl(request.specOutputPath, request.inputPath) },
    width: request.width ?? TEMPLATE_DEFAULT_WIDTH,
    height: request.height ?? TEMPLATE_DEFAULT_HEIGHT,
    layer,
  };

  if (request.title !== undefined) {
    spec.title = request.title;
  }

  return spec;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template.test.ts`
Expected: PASS (`4 pass, 0 fail`).

- [ ] **Step 6: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/template.ts packages/cli/src/core/templates/shared.ts packages/cli/test/template.test.ts
git commit -m "feat: add template core types and shared template helpers"
```

---

### Task 3: `benchmark-heatmap` builder

Layered rect + text spec, with an optional third layer outlining the best score per `--x` column (spec §7.3 template path).

**Files:**
- Create: `packages/cli/src/core/templates/benchmark-heatmap.ts`
- Test: `packages/cli/test/template-benchmark-heatmap.test.ts`

**Interfaces:**
- Consumes: `findFieldIndex` (Task 1), `BenchmarkHeatmapRequest` (Task 2), shared helpers (Task 2).
- Produces: `buildBenchmarkHeatmapSpec(request: BenchmarkHeatmapRequest): JsonObject`; `computeBestCells(rows: string[][], xIndex: number, yIndex: number, scoreIndex: number, options: { xField: string; yField: string; scoreField: string }): JsonObject[]` (exported for tests).

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/template-benchmark-heatmap.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { BenchmarkHeatmapRequest } from "../src/core/template";
import { buildBenchmarkHeatmapSpec } from "../src/core/templates/benchmark-heatmap";

function createRequest(
  optionOverrides: Partial<BenchmarkHeatmapRequest["options"]> = {},
  commonOverrides: Partial<Omit<BenchmarkHeatmapRequest, "template" | "options">> = {},
): BenchmarkHeatmapRequest {
  return {
    template: "benchmark-heatmap",
    inputPath: "examples/benchmark-heatmap/data.csv",
    specOutputPath: "examples/benchmark-heatmap/chart-template.vl.json",
    table: {
      header: ["model", "task", "score"],
      rows: [
        ["Baseline", "MMLU", "68.2"],
        ["Baseline", "GSM8K", "56.1"],
        ["Ours", "MMLU", "72.4"],
        ["Ours", "GSM8K", "61.8"],
      ],
    },
    options: {
      xField: "task",
      yField: "model",
      scoreField: "score",
      ...optionOverrides,
    },
    ...commonOverrides,
  };
}

describe("buildBenchmarkHeatmapSpec", () => {
  test("builds a layered rect+text spec with score labels by default", () => {
    expect(buildBenchmarkHeatmapSpec(createRequest())).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          mark: "rect",
          encoding: {
            x: { field: "task", type: "ordinal" },
            y: { field: "model", type: "ordinal" },
            color: { field: "score", type: "quantitative" },
          },
        },
        {
          mark: "text",
          encoding: {
            x: { field: "task", type: "ordinal" },
            y: { field: "model", type: "ordinal" },
            text: { field: "score", type: "quantitative", format: ".1f" },
          },
        },
      ],
    });
  });

  test("uses a nominal text encoding when the label field differs from the score field", () => {
    const spec = buildBenchmarkHeatmapSpec(createRequest({ labelField: "model" }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[1]?.encoding).toMatchObject({
      text: { field: "model", type: "nominal" },
    });
  });

  test("adds a best-cell outline layer per x column when highlightBest is set", () => {
    const spec = buildBenchmarkHeatmapSpec(createRequest({ highlightBest: true }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(3);
    expect(layer[2]).toEqual({
      data: {
        values: [
          { task: "MMLU", model: "Ours" },
          { task: "GSM8K", model: "Ours" },
        ],
      },
      mark: { type: "rect", fill: null, stroke: "#1a1a1a", strokeWidth: 2 },
      encoding: {
        x: { field: "task", type: "ordinal" },
        y: { field: "model", type: "ordinal" },
      },
    });
  });

  test("applies title, width, and height overrides", () => {
    const spec = buildBenchmarkHeatmapSpec(
      createRequest({}, { title: "Benchmark results", width: 420, height: 200 }),
    );

    expect(spec.title).toBe("Benchmark results");
    expect(spec.width).toBe(420);
    expect(spec.height).toBe(200);
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildBenchmarkHeatmapSpec(createRequest({ scoreField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });

  test("rejects non-numeric scores when computing best cells", () => {
    const request = createRequest({ highlightBest: true });
    request.table.rows[0] = ["Baseline", "MMLU", "n/a"];

    expect(() => buildBenchmarkHeatmapSpec(request)).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "n/a".'),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-benchmark-heatmap.test.ts`
Expected: FAIL — `Cannot find module '../src/core/templates/benchmark-heatmap'`.

- [ ] **Step 3: Create `packages/cli/src/core/templates/benchmark-heatmap.ts`**

```typescript
import { VegaPaperError } from "../errors";
import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { BenchmarkHeatmapRequest } from "../template";
import { buildTemplateFrame, getCell, parseNumericCell } from "./shared";

export function buildBenchmarkHeatmapSpec(request: BenchmarkHeatmapRequest): JsonObject {
  const { header, rows } = request.table;
  const options = request.options;
  const xIndex = findFieldIndex(header, options.xField);
  const yIndex = findFieldIndex(header, options.yField);
  const scoreIndex = findFieldIndex(header, options.scoreField);
  const labelField = options.labelField ?? options.scoreField;
  findFieldIndex(header, labelField);

  const layer: JsonObject[] = [
    {
      mark: "rect",
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
        color: { field: options.scoreField, type: "quantitative" },
      },
    },
    {
      mark: "text",
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
        text: buildTextEncoding(labelField, options.scoreField),
      },
    },
  ];

  if (options.highlightBest === true) {
    layer.push({
      data: { values: computeBestCells(rows, xIndex, yIndex, scoreIndex, options) },
      mark: { type: "rect", fill: null, stroke: "#1a1a1a", strokeWidth: 2 },
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

export function computeBestCells(
  rows: string[][],
  xIndex: number,
  yIndex: number,
  scoreIndex: number,
  options: { xField: string; yField: string; scoreField: string },
): JsonObject[] {
  const bestByColumn = new Map<string, { y: string; score: number }>();
  const columnOrder: string[] = [];

  for (const row of rows) {
    const x = getCell(row, xIndex);
    const y = getCell(row, yIndex);
    const score = parseNumericCell(getCell(row, scoreIndex), options.scoreField);
    const best = bestByColumn.get(x);

    if (best === undefined) {
      columnOrder.push(x);
      bestByColumn.set(x, { y, score });
      continue;
    }

    if (score > best.score) {
      bestByColumn.set(x, { y, score });
    }
  }

  return columnOrder.map((x) => {
    const best = bestByColumn.get(x);

    if (best === undefined) {
      throw new VegaPaperError(`Could not determine the best score for column "${x}".`);
    }

    return { [options.xField]: x, [options.yField]: best.y };
  });
}

function axisEncoding(field: string): JsonObject {
  return { field, type: "ordinal" };
}

function buildTextEncoding(labelField: string, scoreField: string): JsonObject {
  if (labelField === scoreField) {
    return { field: labelField, type: "quantitative", format: ".1f" };
  }

  return { field: labelField, type: "nominal" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-benchmark-heatmap.test.ts`
Expected: PASS (`6 pass, 0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/templates/benchmark-heatmap.ts packages/cli/test/template-benchmark-heatmap.test.ts
git commit -m "feat: add benchmark-heatmap template builder"
```

---

### Task 4: `pareto-frontier` builder

Scatter with optional text labels, color, size, log x-scale, and a computed Pareto frontier line injected as inline data (spec §7.4; Design Decision 2).

**Files:**
- Create: `packages/cli/src/core/templates/pareto-frontier.ts`
- Test: `packages/cli/test/template-pareto-frontier.test.ts`

**Interfaces:**
- Consumes: `findFieldIndex`, `ParetoFrontierRequest`, shared helpers.
- Produces: `buildParetoFrontierSpec(request: ParetoFrontierRequest): JsonObject`; `computeMaxYMinXFrontier(rows: string[][], xIndex: number, yIndex: number, options: { xField: string; yField: string }): JsonObject[]` (exported for tests).

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/template-pareto-frontier.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { ParetoFrontierRequest } from "../src/core/template";
import {
  buildParetoFrontierSpec,
  computeMaxYMinXFrontier,
} from "../src/core/templates/pareto-frontier";

function createRequest(
  optionOverrides: Partial<ParetoFrontierRequest["options"]> = {},
): ParetoFrontierRequest {
  return {
    template: "pareto-frontier",
    inputPath: "examples/pareto-frontier/data.csv",
    specOutputPath: "examples/pareto-frontier/chart.vl.json",
    table: {
      header: ["model", "family", "score", "latency_ms", "params_b"],
      rows: [
        ["TinyLM", "baseline", "68.1", "12", "1.3"],
        ["BaseLM", "baseline", "72.4", "28", "7.0"],
        ["Ours-S", "ours", "73.0", "18", "3.0"],
        ["Ours-L", "ours", "77.2", "42", "13.0"],
      ],
    },
    options: {
      xField: "latency_ms",
      yField: "score",
      ...optionOverrides,
    },
  };
}

describe("computeMaxYMinXFrontier", () => {
  test("keeps only non-dominated points sorted by x", () => {
    const request = createRequest();
    const options = { xField: "latency_ms", yField: "score" };

    expect(computeMaxYMinXFrontier(request.table.rows, 3, 2, options)).toEqual([
      { latency_ms: 12, score: 68.1 },
      { latency_ms: 18, score: 73 },
      { latency_ms: 42, score: 77.2 },
    ]);
  });

  test("prefers the higher y for tied x values", () => {
    const rows = [
      ["a", "10", "5"],
      ["b", "10", "7"],
      ["c", "20", "6"],
      ["d", "30", "9"],
    ];

    expect(computeMaxYMinXFrontier(rows, 1, 2, { xField: "x", yField: "y" })).toEqual([
      { x: 10, y: 7 },
      { x: 30, y: 9 },
    ]);
  });

  test("rejects non-numeric coordinates", () => {
    const rows = [["a", "fast", "5"]];

    expect(() => computeMaxYMinXFrontier(rows, 1, 2, { xField: "x", yField: "y" })).toThrow(
      new VegaPaperError('Field "x" contains a non-numeric value "fast".'),
    );
  });
});

describe("buildParetoFrontierSpec", () => {
  test("builds the full layered spec with frontier, points, and labels", () => {
    const spec = buildParetoFrontierSpec(
      createRequest({
        labelField: "model",
        colorField: "family",
        sizeField: "params_b",
        xScale: "log",
        frontier: "max-y-min-x",
      }),
    );

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          data: {
            values: [
              { latency_ms: 12, score: 68.1 },
              { latency_ms: 18, score: 73 },
              { latency_ms: 42, score: 77.2 },
            ],
          },
          mark: { type: "line", color: "#888888", strokeDash: [4, 3] },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
          },
        },
        {
          mark: { type: "point", filled: true },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
            size: { field: "params_b", type: "quantitative" },
          },
        },
        {
          mark: { type: "text", align: "left", dx: 6, dy: -6 },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
            text: { field: "model", type: "nominal" },
          },
        },
      ],
    });
  });

  test("builds a single point layer without optional channels", () => {
    const spec = buildParetoFrontierSpec(createRequest());
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(1);
    expect(layer[0]).toEqual({
      mark: { type: "point", filled: true },
      encoding: {
        x: { field: "latency_ms", type: "quantitative" },
        y: { field: "score", type: "quantitative", scale: { zero: false } },
      },
    });
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildParetoFrontierSpec(createRequest({ sizeField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-pareto-frontier.test.ts`
Expected: FAIL — `Cannot find module '../src/core/templates/pareto-frontier'`.

- [ ] **Step 3: Create `packages/cli/src/core/templates/pareto-frontier.ts`**

```typescript
import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { ParetoFrontierRequest } from "../template";
import { buildTemplateFrame, getCell, parseNumericCell } from "./shared";

export function buildParetoFrontierSpec(request: ParetoFrontierRequest): JsonObject {
  const { header, rows } = request.table;
  const options = request.options;
  const xIndex = findFieldIndex(header, options.xField);
  const yIndex = findFieldIndex(header, options.yField);

  if (options.labelField !== undefined) {
    findFieldIndex(header, options.labelField);
  }

  if (options.colorField !== undefined) {
    findFieldIndex(header, options.colorField);
  }

  if (options.sizeField !== undefined) {
    findFieldIndex(header, options.sizeField);
  }

  const layer: JsonObject[] = [];

  if (options.frontier === "max-y-min-x") {
    layer.push({
      data: {
        values: computeMaxYMinXFrontier(rows, xIndex, yIndex, {
          xField: options.xField,
          yField: options.yField,
        }),
      },
      mark: { type: "line", color: "#888888", strokeDash: [4, 3] },
      encoding: { x: buildXEncoding(options), y: buildYEncoding(options) },
    });
  }

  const pointEncoding: JsonObject = { x: buildXEncoding(options), y: buildYEncoding(options) };

  if (options.colorField !== undefined) {
    pointEncoding.color = { field: options.colorField, type: "nominal" };
  }

  if (options.sizeField !== undefined) {
    pointEncoding.size = { field: options.sizeField, type: "quantitative" };
  }

  layer.push({ mark: { type: "point", filled: true }, encoding: pointEncoding });

  if (options.labelField !== undefined) {
    layer.push({
      mark: { type: "text", align: "left", dx: 6, dy: -6 },
      encoding: {
        x: buildXEncoding(options),
        y: buildYEncoding(options),
        text: { field: options.labelField, type: "nominal" },
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

export function computeMaxYMinXFrontier(
  rows: string[][],
  xIndex: number,
  yIndex: number,
  options: { xField: string; yField: string },
): JsonObject[] {
  const points = rows.map((row) => ({
    x: parseNumericCell(getCell(row, xIndex), options.xField),
    y: parseNumericCell(getCell(row, yIndex), options.yField),
  }));

  points.sort((a, b) => (a.x === b.x ? b.y - a.y : a.x - b.x));

  const frontier: JsonObject[] = [];
  let bestY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.y > bestY) {
      bestY = point.y;
      frontier.push({ [options.xField]: point.x, [options.yField]: point.y });
    }
  }

  return frontier;
}

function buildXEncoding(options: {
  xField: string;
  xScale?: "linear" | "log" | undefined;
}): JsonObject {
  const encoding: JsonObject = { field: options.xField, type: "quantitative" };

  if (options.xScale === "log") {
    encoding.scale = { type: "log" };
  }

  return encoding;
}

function buildYEncoding(options: { yField: string }): JsonObject {
  return { field: options.yField, type: "quantitative", scale: { zero: false } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-pareto-frontier.test.ts`
Expected: PASS (`6 pass, 0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/templates/pareto-frontier.ts packages/cli/test/template-pareto-frontier.test.ts
git commit -m "feat: add pareto-frontier template builder"
```

---

### Task 5: `scaling-law` builder

Line/point spec with optional log x-scale and optional Vega-Lite `regression` transform layer (spec §7.5; Design Decision 5).

**Files:**
- Create: `packages/cli/src/core/templates/scaling-law.ts`
- Test: `packages/cli/test/template-scaling-law.test.ts`

**Interfaces:**
- Consumes: `findFieldIndex`, `ScalingLawRequest`, `ScalingLawOptions`, shared helpers.
- Produces: `buildScalingLawSpec(request: ScalingLawRequest): JsonObject`.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/template-scaling-law.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { ScalingLawRequest } from "../src/core/template";
import { buildScalingLawSpec } from "../src/core/templates/scaling-law";

function createRequest(
  optionOverrides: Partial<ScalingLawRequest["options"]> = {},
): ScalingLawRequest {
  return {
    template: "scaling-law",
    inputPath: "examples/scaling-law/data.csv",
    specOutputPath: "examples/scaling-law/chart.vl.json",
    table: {
      header: ["family", "params_b", "tokens_b", "flops", "loss", "accuracy"],
      rows: [
        ["baseline", "1.3", "300", "1.2e20", "2.81", "61.2"],
        ["baseline", "7.0", "1000", "2.8e21", "2.34", "68.1"],
        ["ours", "3.0", "500", "7.0e20", "2.42", "69.3"],
        ["ours", "13.0", "1200", "5.4e21", "2.11", "74.8"],
      ],
    },
    options: {
      xField: "flops",
      yField: "loss",
      ...optionOverrides,
    },
  };
}

describe("buildScalingLawSpec", () => {
  test("builds a log-x line spec with a grouped log regression layer", () => {
    const spec = buildScalingLawSpec(
      createRequest({ colorField: "family", xScale: "log", fit: "regression" }),
    );

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          mark: { type: "line", point: true },
          encoding: {
            x: { field: "flops", type: "quantitative", scale: { type: "log" } },
            y: { field: "loss", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
          },
        },
        {
          transform: [{ regression: "loss", on: "flops", method: "log", groupby: ["family"] }],
          mark: { type: "line", strokeDash: [4, 3], opacity: 0.6 },
          encoding: {
            x: { field: "flops", type: "quantitative", scale: { type: "log" } },
            y: { field: "loss", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
          },
        },
      ],
    });
  });

  test("uses linear regression without --x-scale log and omits groupby without color", () => {
    const spec = buildScalingLawSpec(createRequest({ fit: "regression" }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[1]?.transform).toEqual([{ regression: "loss", on: "flops", method: "linear" }]);
    expect(layer[0]?.encoding).toEqual({
      x: { field: "flops", type: "quantitative" },
      y: { field: "loss", type: "quantitative", scale: { zero: false } },
    });
  });

  test("emits a single line layer without --fit", () => {
    const spec = buildScalingLawSpec(createRequest({ xScale: "log" }));

    expect(spec.layer as unknown[]).toHaveLength(1);
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildScalingLawSpec(createRequest({ colorField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-scaling-law.test.ts`
Expected: FAIL — `Cannot find module '../src/core/templates/scaling-law'`.

- [ ] **Step 3: Create `packages/cli/src/core/templates/scaling-law.ts`**

```typescript
import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { ScalingLawOptions, ScalingLawRequest } from "../template";
import { buildTemplateFrame } from "./shared";

export function buildScalingLawSpec(request: ScalingLawRequest): JsonObject {
  const { header } = request.table;
  const options = request.options;
  findFieldIndex(header, options.xField);
  findFieldIndex(header, options.yField);

  if (options.colorField !== undefined) {
    findFieldIndex(header, options.colorField);
  }

  const layer: JsonObject[] = [
    { mark: { type: "line", point: true }, encoding: buildEncoding(options) },
  ];

  if (options.fit === "regression") {
    const regression: JsonObject = {
      regression: options.yField,
      on: options.xField,
      method: options.xScale === "log" ? "log" : "linear",
    };

    if (options.colorField !== undefined) {
      regression.groupby = [options.colorField];
    }

    layer.push({
      transform: [regression],
      mark: { type: "line", strokeDash: [4, 3], opacity: 0.6 },
      encoding: buildEncoding(options),
    });
  }

  return buildTemplateFrame(request, layer);
}

function buildEncoding(options: ScalingLawOptions): JsonObject {
  const x: JsonObject = { field: options.xField, type: "quantitative" };

  if (options.xScale === "log") {
    x.scale = { type: "log" };
  }

  const encoding: JsonObject = {
    x,
    y: { field: options.yField, type: "quantitative", scale: { zero: false } },
  };

  if (options.colorField !== undefined) {
    encoding.color = { field: options.colorField, type: "nominal" };
  }

  return encoding;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-scaling-law.test.ts`
Expected: PASS (`4 pass, 0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/templates/scaling-law.ts packages/cli/test/template-scaling-law.test.ts
git commit -m "feat: add scaling-law template builder"
```

---

### Task 6: `calibration-curve` builder

Accuracy-vs-confidence line/point spec plus a diagonal `y = x` rule layer, optional per-bin count encoded as point size, optional ECE text annotation. Does NOT compute calibration metrics (spec §7.6; Design Decision 3).

**Files:**
- Create: `packages/cli/src/core/templates/calibration-curve.ts`
- Test: `packages/cli/test/template-calibration-curve.test.ts`

**Interfaces:**
- Consumes: `findFieldIndex`, `CalibrationCurveRequest`, `CalibrationCurveOptions`, shared helpers.
- Produces: `buildCalibrationCurveSpec(request: CalibrationCurveRequest): JsonObject`.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/template-calibration-curve.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { CalibrationCurveRequest } from "../src/core/template";
import { buildCalibrationCurveSpec } from "../src/core/templates/calibration-curve";

function createRequest(
  optionOverrides: Partial<CalibrationCurveRequest["options"]> = {},
): CalibrationCurveRequest {
  return {
    template: "calibration-curve",
    inputPath: "examples/calibration-curve/data.csv",
    specOutputPath: "examples/calibration-curve/chart.vl.json",
    table: {
      header: ["bin", "confidence", "accuracy", "count"],
      rows: [
        ["0", "0.05", "0.02", "120"],
        ["1", "0.15", "0.11", "240"],
        ["2", "0.25", "0.21", "310"],
      ],
    },
    options: {
      confidenceField: "confidence",
      accuracyField: "accuracy",
      ...optionOverrides,
    },
  };
}

describe("buildCalibrationCurveSpec", () => {
  test("builds the full spec with diagonal rule, sized points, and ECE annotation", () => {
    const spec = buildCalibrationCurveSpec(createRequest({ countField: "count", ece: 0.041 }));

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          mark: { type: "rule", color: "#888888", strokeDash: [4, 4] },
          encoding: { x: { datum: 0 }, y: { datum: 0 }, x2: { datum: 1 }, y2: { datum: 1 } },
        },
        {
          mark: { type: "line", point: false },
          encoding: {
            x: { field: "confidence", type: "quantitative", scale: { domain: [0, 1] } },
            y: { field: "accuracy", type: "quantitative", scale: { domain: [0, 1] } },
          },
        },
        {
          mark: { type: "point", filled: true },
          encoding: {
            x: { field: "confidence", type: "quantitative", scale: { domain: [0, 1] } },
            y: { field: "accuracy", type: "quantitative", scale: { domain: [0, 1] } },
            size: { field: "count", type: "quantitative" },
          },
        },
        {
          data: { values: [{}] },
          mark: { type: "text", align: "left", baseline: "top" },
          encoding: {
            x: { datum: 0.05 },
            y: { datum: 0.95 },
            text: { value: "ECE = 0.041" },
          },
        },
      ],
    });
  });

  test("builds diagonal plus pointed line without count and ece", () => {
    const spec = buildCalibrationCurveSpec(createRequest());
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(2);
    expect(layer[0]?.mark).toEqual({ type: "rule", color: "#888888", strokeDash: [4, 4] });
    expect(layer[1]?.mark).toEqual({ type: "line", point: true });
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildCalibrationCurveSpec(createRequest({ countField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-calibration-curve.test.ts`
Expected: FAIL — `Cannot find module '../src/core/templates/calibration-curve'`.

- [ ] **Step 3: Create `packages/cli/src/core/templates/calibration-curve.ts`**

```typescript
import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { CalibrationCurveRequest } from "../template";
import { buildTemplateFrame } from "./shared";

export function buildCalibrationCurveSpec(request: CalibrationCurveRequest): JsonObject {
  const { header } = request.table;
  const options = request.options;
  findFieldIndex(header, options.confidenceField);
  findFieldIndex(header, options.accuracyField);

  if (options.countField !== undefined) {
    findFieldIndex(header, options.countField);
  }

  const layer: JsonObject[] = [
    {
      mark: { type: "rule", color: "#888888", strokeDash: [4, 4] },
      encoding: { x: { datum: 0 }, y: { datum: 0 }, x2: { datum: 1 }, y2: { datum: 1 } },
    },
    {
      mark: { type: "line", point: options.countField === undefined },
      encoding: {
        x: buildBinEncoding(options.confidenceField),
        y: buildBinEncoding(options.accuracyField),
      },
    },
  ];

  if (options.countField !== undefined) {
    layer.push({
      mark: { type: "point", filled: true },
      encoding: {
        x: buildBinEncoding(options.confidenceField),
        y: buildBinEncoding(options.accuracyField),
        size: { field: options.countField, type: "quantitative" },
      },
    });
  }

  if (options.ece !== undefined) {
    layer.push({
      data: { values: [{}] },
      mark: { type: "text", align: "left", baseline: "top" },
      encoding: {
        x: { datum: 0.05 },
        y: { datum: 0.95 },
        text: { value: `ECE = ${options.ece}` },
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

function buildBinEncoding(field: string): JsonObject {
  return { field, type: "quantitative", scale: { domain: [0, 1] } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-calibration-curve.test.ts`
Expected: PASS (`3 pass, 0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/templates/calibration-curve.ts packages/cli/test/template-calibration-curve.test.ts
git commit -m "feat: add calibration-curve template builder"
```

---

### Task 7: `buildTemplateSpec` dispatcher

**Files:**
- Modify: `packages/cli/src/core/template.ts`
- Test: `packages/cli/test/template.test.ts`

**Interfaces:**
- Consumes: the four builders (Tasks 3–6).
- Produces: `export function buildTemplateSpec(request: TemplateRequest): JsonObject` — the exact signature the `template` command (Task 9) and later phases call.

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/test/template.test.ts` (and extend the template import at the top of the file to `import { buildTemplateSpec, parseTemplateName, type TemplateRequest } from "../src/core/template";`):

```typescript
describe("buildTemplateSpec", () => {
  const commonRequest = {
    inputPath: "data.csv",
    specOutputPath: "chart.vl.json",
  };

  test("dispatches benchmark-heatmap requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "benchmark-heatmap",
      table: { header: ["model", "task", "score"], rows: [["Ours", "MMLU", "72.4"]] },
      options: { xField: "task", yField: "model", scoreField: "score" },
    };
    const spec = buildTemplateSpec(request);
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
  });

  test("dispatches pareto-frontier requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "pareto-frontier",
      table: { header: ["model", "score", "latency_ms"], rows: [["Ours", "72.4", "18"]] },
      options: { xField: "latency_ms", yField: "score" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toEqual({ type: "point", filled: true });
  });

  test("dispatches scaling-law requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "scaling-law",
      table: { header: ["family", "flops", "loss"], rows: [["ours", "1.2e20", "2.81"]] },
      options: { xField: "flops", yField: "loss", fit: "regression" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[1]?.transform).toEqual([{ regression: "loss", on: "flops", method: "linear" }]);
  });

  test("dispatches calibration-curve requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "calibration-curve",
      table: { header: ["confidence", "accuracy"], rows: [["0.05", "0.02"]] },
      options: { confidenceField: "confidence", accuracyField: "accuracy" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toEqual({ type: "rule", color: "#888888", strokeDash: [4, 4] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template.test.ts`
Expected: FAIL — `Export named 'buildTemplateSpec' not found`.

- [ ] **Step 3: Add the dispatcher to `packages/cli/src/core/template.ts`**

Replace the import line

```typescript
import { VegaPaperError } from "./errors";
```

with

```typescript
import { VegaPaperError } from "./errors";
import type { JsonObject } from "./spec";
import { buildBenchmarkHeatmapSpec } from "./templates/benchmark-heatmap";
import { buildCalibrationCurveSpec } from "./templates/calibration-curve";
import { buildParetoFrontierSpec } from "./templates/pareto-frontier";
import { buildScalingLawSpec } from "./templates/scaling-law";
```

and append at the end of the file:

```typescript
export function buildTemplateSpec(request: TemplateRequest): JsonObject {
  switch (request.template) {
    case "benchmark-heatmap":
      return buildBenchmarkHeatmapSpec(request);
    case "pareto-frontier":
      return buildParetoFrontierSpec(request);
    case "scaling-law":
      return buildScalingLawSpec(request);
    case "calibration-curve":
      return buildCalibrationCurveSpec(request);
  }
}
```

(The builders import only types from `./template`, so this value-import direction creates no runtime cycle.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template.test.ts`
Expected: PASS (`8 pass, 0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/template.ts packages/cli/test/template.test.ts
git commit -m "feat: add buildTemplateSpec dispatcher"
```

---

### Task 8: Template figure metadata

Extend `core/figure-meta.ts` with a `template` meta variant per spec §8.4.

**Files:**
- Modify: `packages/cli/src/core/figure-meta.ts`
- Test: `packages/cli/test/figure-meta.test.ts`

**Interfaces:**
- Consumes: `TemplateName` (Task 2), existing `FigureMetaVersions`, `RenderFormat`, `applyOutputFormatMeta`.
- Produces:
  - `type TemplateOptionsSnapshot = Record<string, string | number | boolean>`
  - `type TemplateFigureMeta` (fields listed in the code below; `command: "template"`)
  - `type FigureMeta = InferFigureMeta | RenderFigureMeta | TemplateFigureMeta`
  - `type BuildTemplateFigureMetaInput`
  - `buildTemplateFigureMeta(input: BuildTemplateFigureMetaInput): TemplateFigureMeta`

- [ ] **Step 1: Write the failing tests**

In `packages/cli/test/figure-meta.test.ts`, change the import block to

```typescript
import { describe, expect, test } from "bun:test";
import {
  buildFigureMeta,
  buildInferSnapshot,
  buildRenderFigureMeta,
  buildTemplateFigureMeta,
  resolveFigureMetaVersions,
  toSiblingMetaPath,
} from "../src/core/figure-meta";
```

and append at the end of the file:

```typescript
describe("buildTemplateFigureMeta", () => {
  test("builds template provenance with an options snapshot", () => {
    const meta = buildTemplateFigureMeta({
      template: "pareto-frontier",
      inputPath: "examples/pareto-frontier/data.csv",
      outputPath: "examples/pareto-frontier/output.svg",
      specOutPath: "examples/pareto-frontier/chart.vl.json",
      themeName: "paper-clean",
      format: "svg",
      options: { x: "latency_ms", y: "score", label: "model", color: "family" },
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      versions: {
        vegaPaperVersion: "0.1.5",
        vegaVersion: "6.2.0",
        vegaLiteVersion: "6.4.1",
      },
    });

    expect(meta).toEqual({
      generatedBy: "vega-paper",
      command: "template",
      template: "pareto-frontier",
      input: "examples/pareto-frontier/data.csv",
      output: "examples/pareto-frontier/output.svg",
      specOut: "examples/pareto-frontier/chart.vl.json",
      createdAt: "2026-07-08T00:00:00.000Z",
      vegaPaperVersion: "0.1.5",
      vegaVersion: "6.2.0",
      vegaLiteVersion: "6.4.1",
      theme: "paper-clean",
      format: "svg",
      options: { x: "latency_ms", y: "score", label: "model", color: "family" },
    });
  });

  test("omits theme when unset and records scale only above 1 for raster formats", () => {
    const meta = buildTemplateFigureMeta({
      template: "scaling-law",
      inputPath: "data.csv",
      outputPath: "output.png",
      specOutPath: "chart.vl.json",
      format: "png",
      scale: 2,
      options: { x: "flops", y: "loss" },
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      versions: {
        vegaPaperVersion: "0.1.5",
        vegaVersion: "6.2.0",
        vegaLiteVersion: "6.4.1",
      },
    });

    expect(meta.theme).toBeUndefined();
    expect(meta.format).toBe("png");
    expect(meta.scale).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/figure-meta.test.ts`
Expected: FAIL — `Export named 'buildTemplateFigureMeta' not found`.

- [ ] **Step 3: Extend `packages/cli/src/core/figure-meta.ts`**

Add to the import block, directly AFTER the `import type { RenderFormat } from "./render-format";` line (biome sorts module specifiers alphabetically: `./errors` < `./infer` < `./install-root` < `./render-format` < `./template`):

```typescript
import type { TemplateName } from "./template";
```

Replace

```typescript
export type FigureMeta = InferFigureMeta | RenderFigureMeta;
```

with

```typescript
export type TemplateOptionsSnapshot = Record<string, string | number | boolean>;

export type TemplateFigureMeta = {
  generatedBy: "vega-paper";
  command: "template";
  template: TemplateName;
  input: string;
  output: string;
  specOut: string;
  createdAt: string;
  vegaPaperVersion: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
  format?: RenderFormat;
  scale?: number;
  options: TemplateOptionsSnapshot;
};

export type FigureMeta = InferFigureMeta | RenderFigureMeta | TemplateFigureMeta;

export type BuildTemplateFigureMetaInput = {
  template: TemplateName;
  inputPath: string;
  outputPath: string;
  specOutPath: string;
  themeName?: string | undefined;
  format: RenderFormat;
  scale?: number | undefined;
  options: TemplateOptionsSnapshot;
  createdAt?: Date;
  versions?: FigureMetaVersions;
};
```

Then add this function directly after the existing `buildRenderFigureMeta` function:

```typescript
export function buildTemplateFigureMeta(input: BuildTemplateFigureMetaInput): TemplateFigureMeta {
  const createdAt = input.createdAt ?? new Date();
  const versions = input.versions;

  if (versions === undefined) {
    throw new VegaPaperError("Figure meta requires version metadata.");
  }

  const meta: TemplateFigureMeta = {
    generatedBy: "vega-paper",
    command: "template",
    template: input.template,
    input: input.inputPath,
    output: input.outputPath,
    specOut: input.specOutPath,
    createdAt: createdAt.toISOString(),
    vegaPaperVersion: versions.vegaPaperVersion,
    vegaVersion: versions.vegaVersion,
    vegaLiteVersion: versions.vegaLiteVersion,
    options: input.options,
  };

  if (input.themeName !== undefined) {
    meta.theme = input.themeName;
  }

  applyOutputFormatMeta(meta, input.format, input.scale ?? 1);

  return meta;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/figure-meta.test.ts`
Expected: PASS (all existing tests plus the 2 new ones, `0 fail`).

- [ ] **Step 5: Check style and commit**

```bash
bun run check
git add packages/cli/src/core/figure-meta.ts packages/cli/test/figure-meta.test.ts
git commit -m "feat: add template figure meta"
```

---

### Task 9: `template` command and registration

Command file mirroring `commands/infer.ts`: injectable dependencies, spec write + `Wrote` line, optional render via the shared render pipeline + `Rendered` line, sibling `.meta.json` + `Wrote` line (spec §8.2, §8.3, §8.4).

**Files:**
- Modify: `packages/cli/src/commands/infer.ts` (export `writeSpecFile` and `toSiblingSpecPath`)
- Create: `packages/cli/src/commands/template.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/template-command.test.ts`

**Interfaces:**
- Consumes: `parseTemplateName`, `buildTemplateSpec`, `TemplateRequest`, `TemplateTable`, `TEMPLATE_NAMES` (Tasks 2/7); `parseCsv` (`core/infer.ts`); `buildTemplateFigureMeta`, `TemplateOptionsSnapshot`, `toSiblingMetaPath`, `resolveFigureMetaVersions`, `writeFigureMeta` (Task 8 / existing); `renderChart`, `buildRenderRequest`; `writeSpecFile`, `toSiblingSpecPath` (exported here from `commands/infer.ts`).
- Produces:
  - `registerTemplateCommand(program: Command, writeOutput?, runRender?, writeSpec?, writeFigureMetaFile?, loadTable?): void`
  - `buildTemplateRequest(template: TemplateName, inputPath: string, specOutputPath: string, options: TemplateCommandOptions, table: TemplateTable): TemplateRequest`
  - `buildTemplateOptionsSnapshot(request: TemplateRequest): TemplateOptionsSnapshot`
  - From `commands/infer.ts`: `export async function writeSpecFile(specOutputPath: string, spec: InferResult["spec"]): Promise<void>`; `export function toSiblingSpecPath(outputPath: string): string`

- [ ] **Step 1: Export the shared helpers from `commands/infer.ts`**

In `packages/cli/src/commands/infer.ts` change

```typescript
async function writeSpecFile(specOutputPath: string, spec: InferResult["spec"]): Promise<void> {
```

to

```typescript
export async function writeSpecFile(
  specOutputPath: string,
  spec: InferResult["spec"],
): Promise<void> {
```

and change

```typescript
function toSiblingSpecPath(outputPath: string): string {
```

to

```typescript
export function toSiblingSpecPath(outputPath: string): string {
```

- [ ] **Step 2: Write the failing tests**

Create `packages/cli/test/template-command.test.ts`:

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerTemplateCommand } from "../src/commands/template";
import { VegaPaperError } from "../src/core/errors";
import type { FigureMeta } from "../src/core/figure-meta";
import type { RenderRequest, RenderResult } from "../src/core/render";
import type { JsonObject } from "../src/core/spec";
import type { TemplateTable } from "../src/core/template";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const BENCHMARK_CSV = "model,task,score\nBaseline,MMLU,68.2\nOurs,MMLU,72.4\n";
const PARETO_CSV =
  "model,family,score,latency_ms,params_b\n" +
  "TinyLM,baseline,68.1,12,1.3\n" +
  "BaseLM,baseline,72.4,28,7.0\n" +
  "Ours-S,ours,73.0,18,3.0\n" +
  "Ours-L,ours,77.2,42,13.0\n";

const STUB_TABLE: TemplateTable = { header: ["a"], rows: [] };
const stubLoadTable = async (): Promise<TemplateTable> => STUB_TABLE;

describe("template command", () => {
  test("writes only the generated spec when --spec-out is provided", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    await writeFile(inputPath, BENCHMARK_CSV, "utf8");

    const { stdout } = await runTemplateCommand([
      "template",
      "benchmark-heatmap",
      inputPath,
      "--x",
      "task",
      "--y",
      "model",
      "--score",
      "score",
      "--spec-out",
      specOutputPath,
    ]);

    const spec = (await readJson(specOutputPath)) as JsonObject;
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(stdout).toBe(`Wrote ${specOutputPath}\n`);
    expect(spec.data).toEqual({ url: "../data.csv" });
    expect(layer).toHaveLength(2);
    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
  });

  test("renders a sibling spec and writes template figure meta when --out is provided", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const outputPath = join(workspace, "figures", "output.svg");
    const specOutputPath = join(workspace, "figures", "output.vl.json");
    const metaOutputPath = join(workspace, "figures", "output.meta.json");
    await writeFile(inputPath, PARETO_CSV, "utf8");
    const renderCalls: RenderRequest[] = [];

    const { stdout } = await runTemplateCommand(
      [
        "template",
        "pareto-frontier",
        inputPath,
        "--x",
        "latency_ms",
        "--y",
        "score",
        "--label",
        "model",
        "--color",
        "family",
        "--theme",
        "paper-clean",
        "--out",
        outputPath,
      ],
      {
        render: async (request) => {
          renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(renderCalls).toEqual([
      {
        inputPath: specOutputPath,
        outputPath,
        format: "svg",
        scale: 1,
        themeName: "paper-clean",
      },
    ]);
    expect(stdout).toContain(`Wrote ${specOutputPath}`);
    expect(stdout).toContain(`Rendered ${outputPath}`);
    expect(stdout).toContain(`Wrote ${metaOutputPath}`);

    const meta = (await readJson(metaOutputPath)) as Record<string, unknown>;

    expect(meta.generatedBy).toBe("vega-paper");
    expect(meta.command).toBe("template");
    expect(meta.template).toBe("pareto-frontier");
    expect(meta.input).toBe(inputPath);
    expect(meta.output).toBe(outputPath);
    expect(meta.specOut).toBe(specOutputPath);
    expect(meta.theme).toBe("paper-clean");
    expect(meta.format).toBe("svg");
    expect(meta.options).toEqual({
      x: "latency_ms",
      y: "score",
      label: "model",
      color: "family",
    });
  });

  test("rejects unknown template names", async () => {
    await expect(
      runTemplateCommand(
        ["template", "violin", "data.csv", "--spec-out", "chart.vl.json"],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError(
        'Unknown template "violin". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve.',
      ),
    );
  });

  test("rejects missing required options per template", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "benchmark-heatmap",
          "data.csv",
          "--x",
          "task",
          "--y",
          "model",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError("Missing required option --score <field>."));

    await expect(
      runTemplateCommand(
        [
          "template",
          "calibration-curve",
          "data.csv",
          "--confidence",
          "confidence",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError("Missing required option --accuracy <field>."));
  });

  test("rejects options that are not supported by the template", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "pareto-frontier",
          "data.csv",
          "--x",
          "latency_ms",
          "--y",
          "score",
          "--score",
          "score",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('The "--score" option is not supported by template "pareto-frontier".'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--frontier",
          "max-y-min-x",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('The "--frontier" option is not supported by template "scaling-law".'),
    );
  });

  test("rejects invalid enum and numeric option values", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "pareto-frontier",
          "data.csv",
          "--x",
          "latency_ms",
          "--y",
          "score",
          "--frontier",
          "min-y",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "min-y" for --frontier. Expected: max-y-min-x.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--x-scale",
          "sqrt",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "sqrt" for --x-scale. Expected one of: linear, log.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--fit",
          "spline",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "spline" for --fit. Expected: regression.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "calibration-curve",
          "data.csv",
          "--confidence",
          "confidence",
          "--accuracy",
          "accuracy",
          "--ece",
          "abc",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "abc" for --ece. Expected a finite non-negative number.'),
    );
  });

  test("rejects --theme without --out and missing output destinations", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--theme",
          "paper-clean",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError('The "--theme" option requires "--out <path>".'));

    await expect(
      runTemplateCommand(
        ["template", "scaling-law", "data.csv", "--x", "flops", "--y", "loss"],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError(
        'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".',
      ),
    );
  });

  test("rejects non-csv input files", async () => {
    await expect(
      runTemplateCommand([
        "template",
        "scaling-law",
        "data.json",
        "--x",
        "flops",
        "--y",
        "loss",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(
      new VegaPaperError('Unsupported input format ".json". Template input must be a .csv file.'),
    );
  });
});

type TemplateCommandHarness = {
  render?: (request: RenderRequest) => Promise<RenderResult>;
  writeSpec?: (specOutputPath: string, spec: JsonObject) => Promise<void>;
  writeFigureMeta?: (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
  loadTable?: (inputPath: string) => Promise<TemplateTable>;
};

async function runTemplateCommand(
  args: string[],
  harness: TemplateCommandHarness = {},
): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerTemplateCommand(
    program,
    (value) => {
      stdout += value;
    },
    harness.render,
    harness.writeSpec,
    harness.writeFigureMeta,
    harness.loadTable,
  );

  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-template-command-"));
  temporaryDirectories.push(workspace);
  return workspace;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-command.test.ts`
Expected: FAIL — `Cannot find module '../src/commands/template'`.

- [ ] **Step 4: Create `packages/cli/src/commands/template.ts`**

```typescript
import { extname } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  buildTemplateFigureMeta,
  type FigureMeta,
  resolveFigureMetaVersions,
  type TemplateOptionsSnapshot,
  toSiblingMetaPath,
  writeFigureMeta,
} from "../core/figure-meta";
import { parseCsv } from "../core/infer";
import { type RenderRequest, type RenderResult, renderChart } from "../core/render";
import { buildRenderRequest } from "../core/render-format";
import type { JsonObject } from "../core/spec";
import {
  buildTemplateSpec,
  parseTemplateName,
  TEMPLATE_NAMES,
  type TemplateAxisScale,
  type TemplateName,
  type TemplateRequest,
  type TemplateTable,
} from "../core/template";
import { toSiblingSpecPath, writeSpecFile } from "./infer";

type TemplateCommandOptions = {
  x?: string;
  y?: string;
  score?: string;
  label?: string;
  color?: string;
  size?: string;
  confidence?: string;
  accuracy?: string;
  count?: string;
  ece?: string;
  highlightBest?: boolean;
  xScale?: string;
  frontier?: string;
  fit?: string;
  title?: string;
  width?: string;
  height?: string;
  theme?: string;
  format?: string;
  scale?: string;
  out?: string;
  specOut?: string;
};

type WriteOutput = (value: string) => void;
type RunRender = (request: RenderRequest) => Promise<RenderResult>;
type WriteSpec = (specOutputPath: string, spec: JsonObject) => Promise<void>;
type WriteFigureMetaFile = (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
type LoadTable = (inputPath: string) => Promise<TemplateTable>;

export function registerTemplateCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runRender: RunRender = renderChart,
  writeSpec: WriteSpec = writeSpecFile,
  writeFigureMetaFile: WriteFigureMetaFile = writeFigureMeta,
  loadTable: LoadTable = readTemplateCsv,
): void {
  program
    .command("template")
    .argument("<template-name>", `template name: ${TEMPLATE_NAMES.join(", ")}`)
    .argument("<data>", "CSV input path")
    .description("Generate a structured ML paper figure spec from a named template")
    .option("--x <field>", "x encoding field")
    .option("--y <field>", "y encoding field")
    .option("--score <field>", "cell score field (benchmark-heatmap)")
    .option("--label <field>", "text label field")
    .option("--color <field>", "color encoding field")
    .option("--size <field>", "point size field (pareto-frontier)")
    .option("--confidence <field>", "per-bin confidence field (calibration-curve)")
    .option("--accuracy <field>", "per-bin accuracy field (calibration-curve)")
    .option("--count <field>", "per-bin sample count field (calibration-curve)")
    .option("--ece <number>", "expected calibration error annotation (calibration-curve)")
    .option("--highlight-best", "outline the best score per --x column (benchmark-heatmap)")
    .option("--x-scale <type>", "x axis scale: linear or log")
    .option("--frontier <mode>", "Pareto frontier mode: max-y-min-x")
    .option("--fit <method>", "fitted trend overlay: regression")
    .option("--title <text>", "chart title")
    .option("--width <number>", "chart width")
    .option("--height <number>", "chart height")
    .option(
      "--theme <name|path>",
      "built-in theme name or path to theme JSON, used only when rendering",
    )
    .option("--format <format>", "output format when rendering: svg, png, or pdf")
    .option("--scale <factor>", "resolution scale for png or pdf (default 1)")
    .option("--out <path>", "rendered output path (.svg, .png, or .pdf)")
    .option("--spec-out <path>", "Vega-Lite spec output path")
    .action(
      async (templateNameValue: string, inputPath: string, options: TemplateCommandOptions) => {
        const template = parseTemplateName(templateNameValue);
        const specOutputPath = resolveTemplateOutputs(options);
        const table = await loadTable(inputPath);
        const request = buildTemplateRequest(template, inputPath, specOutputPath, options, table);
        const spec = buildTemplateSpec(request);

        try {
          await writeSpec(specOutputPath, spec);
        } catch (error) {
          throw toSpecWriteError(specOutputPath, error);
        }

        writeOutput(`Wrote ${specOutputPath}\n`);

        if (options.out === undefined) {
          return;
        }

        const renderRequest = buildRenderRequest({
          inputPath: specOutputPath,
          outputPath: options.out,
          format: options.format,
          scale: options.scale,
          themeName: options.theme,
        });
        const renderResult = await runRender(renderRequest);

        writeOutput(`Rendered ${renderResult.outputPath}\n`);

        const metaOutputPath = toSiblingMetaPath(options.out);
        const versions = await resolveFigureMetaVersions();
        const meta = buildTemplateFigureMeta({
          template,
          inputPath,
          outputPath: options.out,
          specOutPath: specOutputPath,
          themeName: options.theme,
          format: renderRequest.format,
          scale: renderRequest.scale,
          options: buildTemplateOptionsSnapshot(request),
          versions,
        });

        try {
          await writeFigureMetaFile(metaOutputPath, meta);
        } catch (error) {
          throw toMetaWriteError(metaOutputPath, error);
        }

        writeOutput(`Wrote ${metaOutputPath}\n`);
      },
    );
}

const TEMPLATE_OPTION_FLAGS = {
  x: "--x",
  y: "--y",
  score: "--score",
  label: "--label",
  color: "--color",
  size: "--size",
  confidence: "--confidence",
  accuracy: "--accuracy",
  count: "--count",
  ece: "--ece",
  highlightBest: "--highlight-best",
  xScale: "--x-scale",
  frontier: "--frontier",
  fit: "--fit",
} as const;

type TemplateOptionKey = keyof typeof TEMPLATE_OPTION_FLAGS;

const ALLOWED_OPTIONS_BY_TEMPLATE: Record<TemplateName, readonly TemplateOptionKey[]> = {
  "benchmark-heatmap": ["x", "y", "score", "label", "highlightBest"],
  "pareto-frontier": ["x", "y", "label", "color", "size", "xScale", "frontier"],
  "scaling-law": ["x", "y", "color", "xScale", "fit"],
  "calibration-curve": ["confidence", "accuracy", "count", "ece"],
};

export function buildTemplateRequest(
  template: TemplateName,
  inputPath: string,
  specOutputPath: string,
  options: TemplateCommandOptions,
  table: TemplateTable,
): TemplateRequest {
  rejectUnsupportedOptions(template, options);

  const common = {
    inputPath,
    specOutputPath,
    table,
    title: options.title,
    width: parsePositiveDimension(options.width, "--width <number>"),
    height: parsePositiveDimension(options.height, "--height <number>"),
  };

  if (template === "benchmark-heatmap") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        scoreField: requireOption(options.score, "--score <field>"),
        labelField: options.label,
        highlightBest: options.highlightBest === true ? true : undefined,
      },
    };
  }

  if (template === "pareto-frontier") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        labelField: options.label,
        colorField: options.color,
        sizeField: options.size,
        xScale: parseAxisScale(options.xScale),
        frontier: parseFrontierMode(options.frontier),
      },
    };
  }

  if (template === "scaling-law") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        colorField: options.color,
        xScale: parseAxisScale(options.xScale),
        fit: parseFitMethod(options.fit),
      },
    };
  }

  return {
    ...common,
    template,
    options: {
      confidenceField: requireOption(options.confidence, "--confidence <field>"),
      accuracyField: requireOption(options.accuracy, "--accuracy <field>"),
      countField: options.count,
      ece: parseEce(options.ece),
    },
  };
}

export function buildTemplateOptionsSnapshot(request: TemplateRequest): TemplateOptionsSnapshot {
  const snapshot: TemplateOptionsSnapshot = {};

  switch (request.template) {
    case "benchmark-heatmap": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;
      snapshot.score = options.scoreField;

      if (options.labelField !== undefined) {
        snapshot.label = options.labelField;
      }

      if (options.highlightBest === true) {
        snapshot.highlightBest = true;
      }

      break;
    }
    case "pareto-frontier": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;

      if (options.labelField !== undefined) {
        snapshot.label = options.labelField;
      }

      if (options.colorField !== undefined) {
        snapshot.color = options.colorField;
      }

      if (options.sizeField !== undefined) {
        snapshot.size = options.sizeField;
      }

      if (options.xScale !== undefined) {
        snapshot.xScale = options.xScale;
      }

      if (options.frontier !== undefined) {
        snapshot.frontier = options.frontier;
      }

      break;
    }
    case "scaling-law": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;

      if (options.colorField !== undefined) {
        snapshot.color = options.colorField;
      }

      if (options.xScale !== undefined) {
        snapshot.xScale = options.xScale;
      }

      if (options.fit !== undefined) {
        snapshot.fit = options.fit;
      }

      break;
    }
    case "calibration-curve": {
      const options = request.options;
      snapshot.confidence = options.confidenceField;
      snapshot.accuracy = options.accuracyField;

      if (options.countField !== undefined) {
        snapshot.count = options.countField;
      }

      if (options.ece !== undefined) {
        snapshot.ece = options.ece;
      }

      break;
    }
  }

  return snapshot;
}

function rejectUnsupportedOptions(template: TemplateName, options: TemplateCommandOptions): void {
  const allowed = ALLOWED_OPTIONS_BY_TEMPLATE[template];

  for (const key of Object.keys(TEMPLATE_OPTION_FLAGS) as TemplateOptionKey[]) {
    if (options[key] !== undefined && !allowed.includes(key)) {
      throw new VegaPaperError(
        `The "${TEMPLATE_OPTION_FLAGS[key]}" option is not supported by template "${template}".`,
      );
    }
  }
}

function resolveTemplateOutputs(options: TemplateCommandOptions): string {
  const outputPath = options.out;
  const specOutputPath =
    options.specOut ?? (outputPath === undefined ? undefined : toSiblingSpecPath(outputPath));

  if (specOutputPath === undefined) {
    throw new VegaPaperError(
      'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".',
    );
  }

  if (options.theme !== undefined && outputPath === undefined) {
    throw new VegaPaperError('The "--theme" option requires "--out <path>".');
  }

  if (outputPath !== undefined) {
    try {
      buildRenderRequest({
        inputPath: "placeholder.vl.json",
        outputPath,
        format: options.format,
        scale: options.scale,
      });
    } catch (error) {
      if (error instanceof VegaPaperError) {
        throw error;
      }

      throw new VegaPaperError(
        error instanceof Error ? error.message : "Invalid render output options.",
      );
    }
  }

  return specOutputPath;
}

async function readTemplateCsv(inputPath: string): Promise<TemplateTable> {
  const extension = extname(inputPath).toLowerCase();

  if (extension !== ".csv") {
    throw new VegaPaperError(
      `Unsupported input format "${extension}". Template input must be a .csv file.`,
    );
  }

  const file = Bun.file(inputPath);

  if (!(await file.exists())) {
    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }

  try {
    return parseCsv(await file.text());
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }
}

function parseAxisScale(value: string | undefined): TemplateAxisScale | undefined {
  if (value === undefined || value === "linear" || value === "log") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --x-scale. Expected one of: linear, log.`);
}

function parseFrontierMode(value: string | undefined): "max-y-min-x" | undefined {
  if (value === undefined || value === "max-y-min-x") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --frontier. Expected: max-y-min-x.`);
}

function parseFitMethod(value: string | undefined): "regression" | undefined {
  if (value === undefined || value === "regression") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --fit. Expected: regression.`);
}

function parseEce(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new VegaPaperError(
      `Invalid value "${value}" for --ece. Expected a finite non-negative number.`,
    );
  }

  return numericValue;
}

function requireOption(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") {
    throw new VegaPaperError(`Missing required option ${flag}.`);
  }

  return value;
}

function parsePositiveDimension(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new VegaPaperError(`Invalid value for ${flag}. Expected a positive finite number.`);
  }

  return numericValue;
}

function toSpecWriteError(specOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write generated spec to ${specOutputPath}.`);
}

function toMetaWriteError(metaOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write figure meta to ${metaOutputPath}.`);
}
```

- [ ] **Step 5: Register the command in `packages/cli/src/index.ts`**

Change the imports and registration block:

```typescript
import { registerDoctorCommand } from "./commands/doctor";
import { registerInferCommand } from "./commands/infer";
import { registerLintCommand } from "./commands/lint";
import { registerRenderCommand } from "./commands/render";
import { registerTemplateCommand } from "./commands/template";
import { registerThemesCommand } from "./commands/themes";
```

and

```typescript
registerRenderCommand(program);
registerInferCommand(program);
registerTemplateCommand(program);
registerLintCommand(program);
registerThemesCommand(program);
registerDoctorCommand(program);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-command.test.ts`
Expected: PASS (`8 pass, 0 fail`).

Also run the whole suite to catch regressions: `bun test`
Expected: `0 fail`.

- [ ] **Step 7: Smoke-test the CLI end to end**

```bash
printf 'model,task,score\nBaseline,MMLU,68.2\nOurs,MMLU,72.4\n' > /tmp/vega-paper-template-smoke.csv
bun run packages/cli/src/index.ts template benchmark-heatmap /tmp/vega-paper-template-smoke.csv --x task --y model --score score --highlight-best --spec-out /tmp/vega-paper-template-smoke.vl.json
```

Expected stdout: `Wrote /tmp/vega-paper-template-smoke.vl.json`
Then clean up: `rm /tmp/vega-paper-template-smoke.csv /tmp/vega-paper-template-smoke.vl.json`

- [ ] **Step 8: Check style and commit**

```bash
bun run check
git add packages/cli/src/commands/template.ts packages/cli/src/commands/infer.ts packages/cli/src/index.ts packages/cli/test/template-command.test.ts
git commit -m "feat: add vega-paper template command"
```

---

### Task 10: `examples/benchmark-heatmap/` template files and script

Adds the template-generated labeled+highlighted heatmap (spec §7.3 template path) ON TOP of Phase B's committed files. Phase B owns `data.csv` (4 models × 5 tasks: Baseline/SFT/RLHF/Ours × MMLU/GSM8K/HellaSwag/ARC/HumanEval), `README.md`, `chart.vl.json`, and the hand-written 2-layer `chart-labeled.vl.json`; this task must not create or overwrite any of them (Design Decision 11). The template output is committed under the new name `chart-template.vl.json`.

**Files:**
- Prerequisites (exist from Phase B, unchanged content): `examples/benchmark-heatmap/data.csv`, `examples/benchmark-heatmap/chart.vl.json`, `examples/benchmark-heatmap/chart-labeled.vl.json`
- Modify: `examples/benchmark-heatmap/README.md` (append template section via sentence replacement)
- Create (generated): `examples/benchmark-heatmap/chart-template.vl.json`
- Modify: `package.json` (root) — `template:benchmark-heatmap` script
- Test: `packages/cli/test/examples.test.ts`

**Interfaces:**
- Consumes: the `template` command (Task 9); Phase B's `examples/benchmark-heatmap/data.csv` and `README.md`.
- Produces: committed reference spec `examples/benchmark-heatmap/chart-template.vl.json`; root script `template:benchmark-heatmap` (chained by Task 13).

- [ ] **Step 1: Verify the Phase B prerequisites**

```bash
head -1 examples/benchmark-heatmap/data.csv
git status --short examples/benchmark-heatmap
```

Expected: header `model,task,score`; `git status --short` prints nothing (Phase B's files are committed and clean). If `examples/benchmark-heatmap/` does not exist, STOP — Phase B must land first (Design Decision 11). Do not edit `data.csv`, `chart.vl.json`, or `chart-labeled.vl.json` in this task.

- [ ] **Step 2: Append the template section to `examples/benchmark-heatmap/README.md`**

In Phase B's `examples/benchmark-heatmap/README.md`, replace this exact sentence (it closes the "Labeled heatmap (hand-written spec)" section):

```text
A `benchmark-heatmap` template command that generates this shape (plus best-score highlighting) is planned.
```

with:

````markdown
The `benchmark-heatmap` template (below) generates this shape plus best-score highlighting.

## Labeled heatmap with best-score highlight (template)

The `benchmark-heatmap` template layers formatted score labels (`.1f`) on top of the heatmap. `--highlight-best` outlines the best score in each task column; the winning cells are computed from the CSV when the spec is generated and embedded inline in the spec.

```bash
vega-paper template benchmark-heatmap examples/benchmark-heatmap/data.csv \
  --x task \
  --y model \
  --score score \
  --label score \
  --highlight-best \
  --title "Benchmark results" \
  --width 420 \
  --spec-out examples/benchmark-heatmap/chart-template.vl.json
```

`chart-template.vl.json` is regenerated with `bun run template:benchmark-heatmap` from the repo root. Passing `--theme paper-clean --out examples/benchmark-heatmap/output.svg` directly to the `template` command renders in one step and also writes `output.meta.json` with `command: "template"` provenance.
````

Leave every other line of the README untouched. (If the sentence is not present verbatim, Phase B's README changed — append the same `## Labeled heatmap with best-score highlight (template)` section, from the `##` heading down, immediately before the `## Render / lint` heading instead, and drop the replacement sentence.)

- [ ] **Step 3: Add the script to the root `package.json`**

Insert after the last `"infer:*"` script line (Phase B appends more `infer:*` scripts after `"infer:embedding-scatter"`; keep all `template:*` scripts together directly after the `infer:*` group, inside `"scripts"`):

```json
    "template:benchmark-heatmap": "bun run packages/cli/src/index.ts template benchmark-heatmap examples/benchmark-heatmap/data.csv --x task --y model --score score --label score --highlight-best --title \"Benchmark results\" --width 420 --spec-out examples/benchmark-heatmap/chart-template.vl.json",
```

- [ ] **Step 4: Generate the spec**

Run: `bun run template:benchmark-heatmap`
Expected stdout: `Wrote examples/benchmark-heatmap/chart-template.vl.json`

Confirm Phase B's files are untouched: `git status --short examples/benchmark-heatmap` must show only the new untracked `chart-template.vl.json` and the modified `README.md`.

Verify `examples/benchmark-heatmap/chart-template.vl.json` contains exactly (best cells computed from Phase B's `data.csv` — `Ours` has the top score in every task column):

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data.csv" },
  "width": 420,
  "height": 240,
  "layer": [
    {
      "mark": "rect",
      "encoding": {
        "x": { "field": "task", "type": "ordinal" },
        "y": { "field": "model", "type": "ordinal" },
        "color": { "field": "score", "type": "quantitative" }
      }
    },
    {
      "mark": "text",
      "encoding": {
        "x": { "field": "task", "type": "ordinal" },
        "y": { "field": "model", "type": "ordinal" },
        "text": { "field": "score", "type": "quantitative", "format": ".1f" }
      }
    },
    {
      "data": {
        "values": [
          { "task": "MMLU", "model": "Ours" },
          { "task": "GSM8K", "model": "Ours" },
          { "task": "HellaSwag", "model": "Ours" },
          { "task": "ARC", "model": "Ours" },
          { "task": "HumanEval", "model": "Ours" }
        ]
      },
      "mark": { "type": "rect", "fill": null, "stroke": "#1a1a1a", "strokeWidth": 2 },
      "encoding": {
        "x": { "field": "task", "type": "ordinal" },
        "y": { "field": "model", "type": "ordinal" }
      }
    }
  ],
  "title": "Benchmark results"
}
```

- [ ] **Step 5: Add the example structure test**

Append inside the `describe("examples", ...)` block in `packages/cli/test/examples.test.ts`:

```typescript
  test("benchmark-heatmap template chart layers rect, text, and best-cell outline", async () => {
    const spec = await readExampleSpec("examples/benchmark-heatmap/chart-template.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(3);
    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
    expect(layer[2]?.mark).toEqual({
      type: "rect",
      fill: null,
      stroke: "#1a1a1a",
      strokeWidth: 2,
    });
  });
```

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS (`0 fail`) — including Phase B's existing test that `chart-labeled.vl.json` has exactly 2 layers, which stays valid because this task does not touch that file.

- [ ] **Step 6: Check style and commit**

```bash
bun run check
git add examples/benchmark-heatmap/README.md examples/benchmark-heatmap/chart-template.vl.json package.json packages/cli/test/examples.test.ts
git commit -m "feat: add benchmark-heatmap template example"
```

---

### Task 11: `examples/pareto-frontier/`

Spec §7.4: data schema, template CLI, committed spec.

**Files:**
- Create: `examples/pareto-frontier/data.csv`, `examples/pareto-frontier/README.md`
- Create (generated): `examples/pareto-frontier/chart.vl.json`
- Modify: `package.json` (root)
- Test: `packages/cli/test/examples.test.ts`

**Interfaces:**
- Consumes: `template` command (Task 9).
- Produces: root script `template:pareto-frontier` (chained by Task 13).

- [ ] **Step 1: Write `examples/pareto-frontier/data.csv`** (schema from spec §7.4)

```csv
model,family,score,latency_ms,params_b
TinyLM,baseline,68.1,12,1.3
BaseLM,baseline,72.4,28,7.0
Ours-S,ours,73.0,18,3.0
Ours-L,ours,77.2,42,13.0
```

- [ ] **Step 2: Write `examples/pareto-frontier/README.md`**

````markdown
# Pareto frontier (template)

Quality/resource trade-off scatter: each point is a model, x is a resource metric (latency, parameters, FLOPs, cost), y is a quality score. Points to the upper-left dominate: they are better and cheaper. Typical ML paper uses: accuracy vs latency, score vs parameter count, loss vs FLOPs.

The `--frontier max-y-min-x` line connects the non-dominated points (no other point has lower-or-equal x and a higher y). The frontier is computed by the CLI from the CSV rows when the spec is generated and embedded inline in the spec; the scatter and label layers still read `data.csv`, so regenerating the spec after editing the data also refreshes the frontier.

```bash
vega-paper template pareto-frontier examples/pareto-frontier/data.csv \
  --x latency_ms \
  --y score \
  --label model \
  --color family \
  --size params_b \
  --x-scale log \
  --frontier max-y-min-x \
  --title "Score vs latency" \
  --spec-out examples/pareto-frontier/chart.vl.json
```

Use `--x-scale log` whenever the resource axis spans an order of magnitude or more. Keep `--label` to a handful of points; dense labels overlap at paper sizes.

## Render

```bash
vega-paper render examples/pareto-frontier/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/pareto-frontier/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
````

- [ ] **Step 3: Add the script to the root `package.json`**

Insert directly after the `"template:benchmark-heatmap"` line:

```json
    "template:pareto-frontier": "bun run packages/cli/src/index.ts template pareto-frontier examples/pareto-frontier/data.csv --x latency_ms --y score --label model --color family --size params_b --x-scale log --frontier max-y-min-x --title \"Score vs latency\" --spec-out examples/pareto-frontier/chart.vl.json",
```

- [ ] **Step 4: Generate the spec**

Run: `bun run template:pareto-frontier`
Expected stdout: `Wrote examples/pareto-frontier/chart.vl.json`

Verify `examples/pareto-frontier/chart.vl.json` contains exactly:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data.csv" },
  "width": 360,
  "height": 240,
  "layer": [
    {
      "data": {
        "values": [
          { "latency_ms": 12, "score": 68.1 },
          { "latency_ms": 18, "score": 73 },
          { "latency_ms": 42, "score": 77.2 }
        ]
      },
      "mark": { "type": "line", "color": "#888888", "strokeDash": [4, 3] },
      "encoding": {
        "x": { "field": "latency_ms", "type": "quantitative", "scale": { "type": "log" } },
        "y": { "field": "score", "type": "quantitative", "scale": { "zero": false } }
      }
    },
    {
      "mark": { "type": "point", "filled": true },
      "encoding": {
        "x": { "field": "latency_ms", "type": "quantitative", "scale": { "type": "log" } },
        "y": { "field": "score", "type": "quantitative", "scale": { "zero": false } },
        "color": { "field": "family", "type": "nominal" },
        "size": { "field": "params_b", "type": "quantitative" }
      }
    },
    {
      "mark": { "type": "text", "align": "left", "dx": 6, "dy": -6 },
      "encoding": {
        "x": { "field": "latency_ms", "type": "quantitative", "scale": { "type": "log" } },
        "y": { "field": "score", "type": "quantitative", "scale": { "zero": false } },
        "text": { "field": "model", "type": "nominal" }
      }
    }
  ],
  "title": "Score vs latency"
}
```

- [ ] **Step 5: Add the example structure test**

Append inside `describe("examples", ...)` in `packages/cli/test/examples.test.ts`:

```typescript
  test("pareto-frontier chart layers frontier line, points, and labels with log x", async () => {
    const spec = await readExampleSpec("examples/pareto-frontier/chart.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(3);
    expect(layer[0]?.data).toEqual({
      values: [
        { latency_ms: 12, score: 68.1 },
        { latency_ms: 18, score: 73 },
        { latency_ms: 42, score: 77.2 },
      ],
    });
    expect(layer[1]?.encoding).toMatchObject({
      x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
      size: { field: "params_b", type: "quantitative" },
    });
    expect(layer[2]?.encoding).toMatchObject({
      text: { field: "model", type: "nominal" },
    });
  });
```

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS (`0 fail`).

- [ ] **Step 6: Check style and commit**

```bash
bun run check
git add examples/pareto-frontier package.json packages/cli/test/examples.test.ts
git commit -m "feat: add pareto-frontier template example"
```

---

### Task 12: `examples/scaling-law/`

Spec §7.5: data schema, template CLI with `--x-scale log --fit regression`, committed spec.

**Files:**
- Create: `examples/scaling-law/data.csv`, `examples/scaling-law/README.md`
- Create (generated): `examples/scaling-law/chart.vl.json`
- Modify: `package.json` (root)
- Test: `packages/cli/test/examples.test.ts`

**Interfaces:**
- Consumes: `template` command (Task 9).
- Produces: root script `template:scaling-law` (chained by Task 13).

- [ ] **Step 1: Write `examples/scaling-law/data.csv`** (schema from spec §7.5)

```csv
family,params_b,tokens_b,flops,loss,accuracy
baseline,1.3,300,1.2e20,2.81,61.2
baseline,7.0,1000,2.8e21,2.34,68.1
ours,3.0,500,7.0e20,2.42,69.3
ours,13.0,1200,5.4e21,2.11,74.8
```

- [ ] **Step 2: Write `examples/scaling-law/README.md`**

````markdown
# Scaling law (template)

Compute-performance curve for foundation-model papers: x is a compute or capacity metric (FLOPs, parameters, tokens) on a log scale, y is loss or a quality score, one series per model family.

Conventions: for loss-style metrics lower is better and the curve slopes down; for score-style metrics higher is better and the curve slopes up. VegaPaper does not invert axes automatically — if you want an inverted loss axis, edit the committed spec explicitly so the figure is never silently flipped.

`--fit regression` overlays a dashed Vega-Lite regression trend per family. With `--x-scale log` the fit uses `method: "log"` (linear in log-x, the usual scaling-law reading); without it the fit is `method: "linear"`.

```bash
vega-paper template scaling-law examples/scaling-law/data.csv \
  --x flops \
  --y loss \
  --color family \
  --x-scale log \
  --fit regression \
  --title "Scaling behavior" \
  --spec-out examples/scaling-law/chart.vl.json
```

The default 360×240 size stays readable at single-column paper width; pass `--width`/`--height` to adjust.

## Render

```bash
vega-paper render examples/scaling-law/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/scaling-law/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
````

- [ ] **Step 3: Add the script to the root `package.json`**

Insert directly after the `"template:pareto-frontier"` line:

```json
    "template:scaling-law": "bun run packages/cli/src/index.ts template scaling-law examples/scaling-law/data.csv --x flops --y loss --color family --x-scale log --fit regression --title \"Scaling behavior\" --spec-out examples/scaling-law/chart.vl.json",
```

- [ ] **Step 4: Generate the spec**

Run: `bun run template:scaling-law`
Expected stdout: `Wrote examples/scaling-law/chart.vl.json`

Verify `examples/scaling-law/chart.vl.json` contains exactly:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data.csv" },
  "width": 360,
  "height": 240,
  "layer": [
    {
      "mark": { "type": "line", "point": true },
      "encoding": {
        "x": { "field": "flops", "type": "quantitative", "scale": { "type": "log" } },
        "y": { "field": "loss", "type": "quantitative", "scale": { "zero": false } },
        "color": { "field": "family", "type": "nominal" }
      }
    },
    {
      "transform": [
        { "regression": "loss", "on": "flops", "method": "log", "groupby": ["family"] }
      ],
      "mark": { "type": "line", "strokeDash": [4, 3], "opacity": 0.6 },
      "encoding": {
        "x": { "field": "flops", "type": "quantitative", "scale": { "type": "log" } },
        "y": { "field": "loss", "type": "quantitative", "scale": { "zero": false } },
        "color": { "field": "family", "type": "nominal" }
      }
    }
  ],
  "title": "Scaling behavior"
}
```

- [ ] **Step 5: Add the example structure test**

Append inside `describe("examples", ...)` in `packages/cli/test/examples.test.ts`:

```typescript
  test("scaling-law chart uses a log x scale with a grouped regression layer", async () => {
    const spec = await readExampleSpec("examples/scaling-law/chart.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(2);
    expect(layer[0]?.encoding).toMatchObject({
      x: { field: "flops", type: "quantitative", scale: { type: "log" } },
    });
    expect(layer[1]?.transform).toEqual([
      { regression: "loss", on: "flops", method: "log", groupby: ["family"] },
    ]);
  });
```

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS (`0 fail`).

- [ ] **Step 6: Check style and commit**

```bash
bun run check
git add examples/scaling-law package.json packages/cli/test/examples.test.ts
git commit -m "feat: add scaling-law template example"
```

---

### Task 13: `examples/calibration-curve/` and the `template:examples` chain

Spec §7.6: pre-binned reliability diagram with diagonal reference and ECE annotation, plus the chain script that regenerates all four template examples.

**Files:**
- Create: `examples/calibration-curve/data.csv`, `examples/calibration-curve/README.md`
- Create (generated): `examples/calibration-curve/chart.vl.json`
- Modify: `package.json` (root) — `template:calibration-curve` and `template:examples`
- Test: `packages/cli/test/examples.test.ts`

**Interfaces:**
- Consumes: `template` command (Task 9); scripts from Tasks 10–12.
- Produces: root scripts `template:calibration-curve` and `template:examples` (regenerates all committed template specs, mirroring `infer:examples`).

- [ ] **Step 1: Write `examples/calibration-curve/data.csv`** (pre-binned; extends the spec §7.6 schema to 10 bins)

```csv
bin,confidence,accuracy,count
0,0.05,0.02,120
1,0.15,0.11,240
2,0.25,0.21,310
3,0.35,0.34,420
4,0.45,0.41,480
5,0.55,0.54,610
6,0.65,0.60,690
7,0.75,0.68,570
8,0.85,0.76,380
9,0.95,0.83,190
```

- [ ] **Step 2: Write `examples/calibration-curve/README.md`**

````markdown
# Calibration curve (template)

Reliability diagram for classifier or LLM confidence calibration: mean predicted confidence per bin on x, empirical accuracy per bin on y, both on a fixed [0, 1] domain, with a dashed diagonal `y = x` reference. Points below the diagonal indicate overconfidence.

**Input must be pre-binned.** Each CSV row is one confidence bin with its mean `confidence`, empirical `accuracy`, and sample `count`. The template does not compute bins, accuracies, or calibration metrics — compute them in your evaluation code. `--ece` is a display-only annotation for a value you computed yourself; `--count` scales point size by bin population.

```bash
vega-paper template calibration-curve examples/calibration-curve/data.csv \
  --confidence confidence \
  --accuracy accuracy \
  --count count \
  --ece 0.041 \
  --title "Reliability diagram" \
  --spec-out examples/calibration-curve/chart.vl.json
```

## Render

```bash
vega-paper render examples/calibration-curve/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/calibration-curve/output.svg
```

Committed `.vl.json` files are reference outputs from the commands above. `output.svg` is generated locally and not committed.
````

- [ ] **Step 3: Add both scripts to the root `package.json`**

Insert directly after the `"template:scaling-law"` line:

```json
    "template:calibration-curve": "bun run packages/cli/src/index.ts template calibration-curve examples/calibration-curve/data.csv --confidence confidence --accuracy accuracy --count count --ece 0.041 --title \"Reliability diagram\" --spec-out examples/calibration-curve/chart.vl.json",
    "template:examples": "bun run template:benchmark-heatmap && bun run template:pareto-frontier && bun run template:scaling-law && bun run template:calibration-curve",
```

- [ ] **Step 4: Generate the spec and run the chain**

Run: `bun run template:calibration-curve`
Expected stdout: `Wrote examples/calibration-curve/chart.vl.json`

Verify `examples/calibration-curve/chart.vl.json` contains exactly:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data.csv" },
  "width": 360,
  "height": 240,
  "layer": [
    {
      "mark": { "type": "rule", "color": "#888888", "strokeDash": [4, 4] },
      "encoding": {
        "x": { "datum": 0 },
        "y": { "datum": 0 },
        "x2": { "datum": 1 },
        "y2": { "datum": 1 }
      }
    },
    {
      "mark": { "type": "line", "point": false },
      "encoding": {
        "x": { "field": "confidence", "type": "quantitative", "scale": { "domain": [0, 1] } },
        "y": { "field": "accuracy", "type": "quantitative", "scale": { "domain": [0, 1] } }
      }
    },
    {
      "mark": { "type": "point", "filled": true },
      "encoding": {
        "x": { "field": "confidence", "type": "quantitative", "scale": { "domain": [0, 1] } },
        "y": { "field": "accuracy", "type": "quantitative", "scale": { "domain": [0, 1] } },
        "size": { "field": "count", "type": "quantitative" }
      }
    },
    {
      "data": { "values": [{}] },
      "mark": { "type": "text", "align": "left", "baseline": "top" },
      "encoding": {
        "x": { "datum": 0.05 },
        "y": { "datum": 0.95 },
        "text": { "value": "ECE = 0.041" }
      }
    }
  ],
  "title": "Reliability diagram"
}
```

Then run the full chain and confirm it is deterministic:

```bash
bun run template:examples
git status --short
```

Expected: four `Wrote examples/...` lines; `git status --short` shows only the files this task added (no modifications to Tasks 10–12 outputs).

- [ ] **Step 5: Add the example structure test**

Append inside `describe("examples", ...)` in `packages/cli/test/examples.test.ts`:

```typescript
  test("calibration-curve chart includes diagonal reference and ECE annotation", async () => {
    const spec = await readExampleSpec("examples/calibration-curve/chart.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(4);
    expect(layer[0]?.encoding).toEqual({
      x: { datum: 0 },
      y: { datum: 0 },
      x2: { datum: 1 },
      y2: { datum: 1 },
    });
    expect(layer[3]?.encoding).toMatchObject({
      text: { value: "ECE = 0.041" },
    });
  });
```

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS (`0 fail`).

- [ ] **Step 6: Check style and commit**

```bash
bun run check
git add examples/calibration-curve package.json packages/cli/test/examples.test.ts
git commit -m "feat: add calibration-curve example and template:examples script"
```

---

### Task 14: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all files pass, `0 fail`.

- [ ] **Step 2: Typecheck and lint**

```bash
bun run typecheck
bun run check
```

Expected: both exit 0 with no diagnostics.

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: exit 0; `packages/cli/dist/index.js` regenerated.

- [ ] **Step 4: Regenerate all examples and confirm determinism**

```bash
bun run infer:examples
bun run template:examples
git status --short
```

Expected: `git status --short` prints nothing for `examples/` spec files (committed specs are byte-identical to regenerated output; `dist/` changes, if any, are not committed).

- [ ] **Step 5: Confirm the working tree is clean**

Run: `git status --short`
Expected: empty (or only untracked local render outputs such as `output.svg`, which are not committed).

---

## Self-Review (completed)

1. **Spec coverage:** §8.2 command shape → Task 9; §7.3 template path (`--x/--y/--score/--label/--highlight-best`) → Tasks 3, 10; §7.4 (`--label/--color/--size/--x-scale log/--frontier max-y-min-x`) → Tasks 4, 11; §7.5 (`--x-scale log`, `--fit regression`, single-column readability note) → Tasks 5, 12; §7.6 (diagonal `y=x`, ECE annotation, pre-binned input, no metric computation) → Tasks 6, 13; §8.3 output/stdout behavior → Task 9; §8.4 metadata (`command: "template"`, `template`, `options`) → Tasks 8, 9; §12 Phase C items 1–6 → Tasks 2–13; §13 unit-test requirements (template option parsing, template metadata) → Tasks 8, 9. Out of Phase C scope by design: `multipanel` and `leaderboard-bar` templates (Phase D / spec §7.2 extension), lint rules (Phase E), README gallery updates (Phase B/doc phases).
2. **Placeholder scan:** every created/modified file has complete content; every test step includes full test code; every command lists expected output. No TBD/TODO items remain.
3. **Type consistency:** `TemplateName`, `TemplateRequest`, `TemplateTable`, `TemplateAxisScale`, builder names (`buildBenchmarkHeatmapSpec`, `buildParetoFrontierSpec`, `buildScalingLawSpec`, `buildCalibrationCurveSpec`), `buildTemplateSpec`, `buildTemplateFigureMeta`, `TemplateOptionsSnapshot`, `writeSpecFile`, `toSiblingSpecPath`, `findFieldIndex`, `toRelativeDataUrl` are used with identical names and signatures across Tasks 1–14.
