# VegaPaper Infer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `vega-paper infer` so CSV experiment results can produce a reproducible Vega-Lite spec and optionally render SVG through the existing render workflow.

**Architecture:** Add a focused `core/infer` module for CSV parsing, field validation, type inference, and Vega-Lite spec generation. Add a thin `commands/infer` orchestration layer that resolves output paths, writes the generated spec, and calls the existing render core when `--out` is present. Register the command in the CLI entrypoint and add a smoke fixture for end-to-end usage.

**Tech Stack:** Bun, TypeScript, Commander, Bun test, existing VegaPaper CLI render core.

---

## File Structure

- Create `packages/cli/src/core/infer.ts`
  - Owns CSV parsing, chart type validation, minimal type inference, `data.url` generation, and Vega-Lite spec construction.
- Create `packages/cli/test/infer.test.ts`
  - Tests the core infer API and CSV parser behavior.
- Create `packages/cli/src/commands/infer.ts`
  - Owns CLI option parsing, command-level validation, spec output path resolution, spec writing, and optional render orchestration.
- Create `packages/cli/test/infer-command.test.ts`
  - Tests command behavior with injected infer/render runners.
- Modify `packages/cli/src/index.ts`
  - Registers `vega-paper infer`.
- Create `examples/training-curve/data.csv`
  - Smoke-test CSV fixture used by acceptance verification.

## Task 1: Add Core Infer Spec Generator

**Files:**
- Create: `packages/cli/src/core/infer.ts`
- Create: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing core infer tests**

Create `packages/cli/test/infer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VegaPaperError } from "../src/core/errors";
import {
  inferVegaLiteSpec,
  parseCsv,
} from "../src/core/infer";

describe("parseCsv", () => {
  test("parses headers and rows", () => {
    expect(parseCsv("epoch,accuracy,model\n1,0.62,base\n2,0.68,large\n")).toEqual({
      header: ["epoch", "accuracy", "model"],
      rows: [
        ["1", "0.62", "base"],
        ["2", "0.68", "large"],
      ],
    });
  });

  test("parses quoted values, commas, escaped quotes, and trailing empty cells", () => {
    expect(
      parseCsv('name,note,empty\n"a,b","said ""hi""",\nplain,"x",\n'),
    ).toEqual({
      header: ["name", "note", "empty"],
      rows: [
        ["a,b", 'said "hi"', ""],
        ["plain", "x", ""],
      ],
    });
  });

  test("rejects empty CSV", () => {
    expect(() => parseCsv("\n\n")).toThrow(VegaPaperError);
    expect(() => parseCsv("\n\n")).toThrow("CSV is empty.");
  });

  test("rejects empty header names", () => {
    expect(() => parseCsv("epoch,,accuracy\n1,base,0.62\n")).toThrow(
      "CSV header contains an empty field name.",
    );
  });
});

describe("inferVegaLiteSpec", () => {
  test("generates a line spec from CSV", async () => {
    await withCsv("epoch,accuracy,model\n1,0.62,base\n2,0.68,large\n", async (inputPath, workspacePath) => {
      const specOutputPath = join(workspacePath, "figures", "accuracy.vl.json");

      expect(
        await inferVegaLiteSpec({
          inputPath,
          specOutputPath,
          chart: "line",
          xField: "epoch",
          yField: "accuracy",
          colorField: "model",
          title: "Accuracy by epoch",
        }),
      ).toEqual({
        spec: {
          $schema: "https://vega.github.io/schema/vega-lite/v6.json",
          data: { url: "../data.csv" },
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "epoch" },
            y: { field: "accuracy", type: "quantitative", title: "accuracy" },
            color: { field: "model", type: "nominal", title: "model" },
          },
          title: "Accuracy by epoch",
          width: 360,
          height: 240,
        },
      });
    });
  });

  test("maps bar and scatter chart types", async () => {
    await withCsv("label,value\nA,1\nB,2\n", async (inputPath, workspacePath) => {
      const baseRequest = {
        inputPath,
        specOutputPath: join(workspacePath, "chart.vl.json"),
        xField: "label",
        yField: "value",
      };

      expect((await inferVegaLiteSpec({ ...baseRequest, chart: "bar" })).spec.mark).toBe("bar");
      expect((await inferVegaLiteSpec({ ...baseRequest, chart: "scatter" })).spec.mark).toBe("point");
    });
  });

  test("infers nominal x or y when values are not numeric", async () => {
    await withCsv("epoch,label\none,good\ntwo,bad\n", async (inputPath, workspacePath) => {
      const result = await inferVegaLiteSpec({
        inputPath,
        specOutputPath: join(workspacePath, "chart.vl.json"),
        chart: "scatter",
        xField: "epoch",
        yField: "label",
      });

      expect(result.spec.encoding).toEqual({
        x: { field: "epoch", type: "nominal", title: "epoch" },
        y: { field: "label", type: "nominal", title: "label" },
      });
    });
  });

  test("keeps color nominal even when color values are numeric", async () => {
    await withCsv("x,y,group\n1,2,10\n2,3,11\n", async (inputPath, workspacePath) => {
      const result = await inferVegaLiteSpec({
        inputPath,
        specOutputPath: join(workspacePath, "chart.vl.json"),
        chart: "line",
        xField: "x",
        yField: "y",
        colorField: "group",
      });

      expect((result.spec.encoding as Record<string, unknown>).color).toEqual({
        field: "group",
        type: "nominal",
        title: "group",
      });
    });
  });

  test("uses explicit width and height", async () => {
    await withCsv("x,y\n1,2\n", async (inputPath, workspacePath) => {
      const result = await inferVegaLiteSpec({
        inputPath,
        specOutputPath: join(workspacePath, "chart.vl.json"),
        chart: "line",
        xField: "x",
        yField: "y",
        width: 480,
        height: 320,
      });

      expect(result.spec.width).toBe(480);
      expect(result.spec.height).toBe(320);
    });
  });

  test("rejects missing fields", async () => {
    await withCsv("x,y\n1,2\n", async (inputPath, workspacePath) => {
      await expect(
        inferVegaLiteSpec({
          inputPath,
          specOutputPath: join(workspacePath, "chart.vl.json"),
          chart: "line",
          xField: "epoch",
          yField: "y",
        }),
      ).rejects.toThrow('CSV field "epoch" was not found.');
    });
  });

  test("rejects invalid chart types", async () => {
    await withCsv("x,y\n1,2\n", async (inputPath, workspacePath) => {
      await expect(
        inferVegaLiteSpec({
          inputPath,
          specOutputPath: join(workspacePath, "chart.vl.json"),
          chart: "heatmap",
          xField: "x",
          yField: "y",
        }),
      ).rejects.toThrow(
        'Unsupported chart type "heatmap". Expected one of: line, bar, scatter.',
      );
    });
  });

  test("rejects unreadable CSV files", async () => {
    await expect(
      inferVegaLiteSpec({
        inputPath: "missing.csv",
        specOutputPath: "chart.vl.json",
        chart: "line",
        xField: "x",
        yField: "y",
      }),
    ).rejects.toThrow("CSV file not found or unreadable: missing.csv");
  });
});

async function withCsv(
  contents: string,
  callback: (inputPath: string, workspacePath: string) => Promise<void>,
) {
  const workspacePath = await mkdtemp(join(tmpdir(), "vega-paper-infer-test-"));
  const inputPath = join(workspacePath, "data.csv");
  await writeFile(inputPath, contents, "utf8");

  try {
    await callback(inputPath, workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.test.ts
```

Expected: FAIL because `packages/cli/src/core/infer.ts` does not exist.

- [ ] **Step 3: Implement core infer module**

Create `packages/cli/src/core/infer.ts`:

```ts
import { readFile } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";
import { VegaPaperError } from "./errors";
import type { JsonObject } from "./spec";

export type InferChartType = "line" | "bar" | "scatter";
type VegaLiteFieldType = "quantitative" | "nominal";

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

export type ParsedCsv = {
  header: string[];
  rows: string[][];
};

const INFER_CHART_TYPES: InferChartType[] = ["line", "bar", "scatter"];

export async function inferVegaLiteSpec(
  request: InferRequest,
): Promise<InferResult> {
  const chart = parseChartType(request.chart);
  const csv = parseCsv(await readCsv(request.inputPath));
  validateField(csv.header, request.xField);
  validateField(csv.header, request.yField);

  if (request.colorField !== undefined) {
    validateField(csv.header, request.colorField);
  }

  const encoding: JsonObject = {
    x: fieldEncoding(
      request.xField,
      inferFieldType(csv, request.xField),
    ),
    y: fieldEncoding(
      request.yField,
      inferFieldType(csv, request.yField),
    ),
  };

  if (request.colorField !== undefined) {
    encoding.color = fieldEncoding(request.colorField, "nominal");
  }

  const spec: JsonObject = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {
      url: toVegaLiteRelativeUrl(
        request.specOutputPath,
        request.inputPath,
      ),
    },
    mark: chartToMark(chart),
    encoding,
    width: request.width ?? 360,
    height: request.height ?? 240,
  };

  if (request.title !== undefined) {
    spec.title = request.title;
  }

  return { spec };
}

export function parseCsv(contents: string): ParsedCsv {
  const records = parseCsvRecords(contents).filter((row) =>
    row.some((cell) => cell.length > 0),
  );

  if (records.length === 0) {
    throw new VegaPaperError("CSV is empty.");
  }

  const header = records[0]?.map((field) => field.trim()) ?? [];

  if (header.length === 0) {
    throw new VegaPaperError("CSV has no header row.");
  }

  if (header.some((field) => field.length === 0)) {
    throw new VegaPaperError("CSV header contains an empty field name.");
  }

  return {
    header,
    rows: records.slice(1),
  };
}

async function readCsv(inputPath: string): Promise<string> {
  try {
    return await readFile(inputPath, "utf8");
  } catch {
    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }
}

function parseCsvRecords(contents: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const finishCell = () => {
    row.push(cell);
    cell = "";
  };
  const finishRow = () => {
    finishCell();
    records.push(row);
    row = [];
  };

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents.charAt(index);

    if (inQuotes) {
      if (char === '"' && contents[index + 1] === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      cell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      finishCell();
      continue;
    }

    if (char === "\n") {
      finishRow();
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    finishRow();
  }

  return records;
}

function parseChartType(chart: string): InferChartType {
  if (isInferChartType(chart)) {
    return chart;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${chart}". Expected one of: ${INFER_CHART_TYPES.join(
      ", ",
    )}.`,
  );
}

function isInferChartType(value: string): value is InferChartType {
  return (INFER_CHART_TYPES as string[]).includes(value);
}

function validateField(header: string[], field: string): void {
  if (!header.includes(field)) {
    throw new VegaPaperError(`CSV field "${field}" was not found.`);
  }
}

function fieldEncoding(field: string, type: VegaLiteFieldType): JsonObject {
  return { field, type, title: field };
}

function inferFieldType(csv: ParsedCsv, field: string): VegaLiteFieldType {
  const fieldIndex = csv.header.indexOf(field);
  const values = csv.rows
    .map((row) => row[fieldIndex] ?? "")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return "nominal";
  }

  return values.every(isFiniteNumberText) ? "quantitative" : "nominal";
}

function isFiniteNumberText(value: string): boolean {
  return Number.isFinite(Number(value));
}

function chartToMark(chart: InferChartType): "line" | "bar" | "point" {
  return chart === "scatter" ? "point" : chart;
}

function toVegaLiteRelativeUrl(
  specOutputPath: string,
  inputPath: string,
): string {
  const relativePath = relative(dirname(specOutputPath), inputPath);
  return sep === "/" ? relativePath : relativePath.split(sep).join("/");
}
```

- [ ] **Step 4: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: infer tests pass and typecheck passes.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add infer spec generator"
```

## Task 2: Add Infer Command Orchestration

**Files:**
- Create: `packages/cli/src/commands/infer.ts`
- Create: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command tests**

Create `packages/cli/test/infer-command.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeInferOptions,
  registerInferCommand,
  type RunInfer,
  type RunRender,
} from "../src/commands/infer";
import type { RenderRequest } from "../src/core/render";

describe("normalizeInferOptions", () => {
  test("resolves explicit spec output without render output", () => {
    expect(
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        specOut: "figures/accuracy.vl.json",
      }),
    ).toEqual({
      inputPath: "results.csv",
      chart: "line",
      xField: "epoch",
      yField: "accuracy",
      colorField: undefined,
      title: undefined,
      width: undefined,
      height: undefined,
      specOutputPath: "figures/accuracy.vl.json",
      outputPath: undefined,
      themeName: undefined,
    });
  });

  test("derives sibling spec output from svg output", () => {
    expect(
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        out: "figures/accuracy.svg",
      }).specOutputPath,
    ).toBe("figures/accuracy.vl.json");
  });

  test("uses explicit spec output when rendering", () => {
    expect(
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        out: "figures/accuracy.svg",
        specOut: "specs/accuracy.vl.json",
      }),
    ).toMatchObject({
      specOutputPath: "specs/accuracy.vl.json",
      outputPath: "figures/accuracy.svg",
    });
  });

  test("parses positive width and height", () => {
    expect(
      normalizeInferOptions("results.csv", {
        chart: "bar",
        x: "model",
        y: "accuracy",
        specOut: "chart.vl.json",
        width: "480",
        height: "320",
      }),
    ).toMatchObject({
      width: 480,
      height: 320,
    });
  });

  test("requires chart, x, and y", () => {
    expect(() =>
      normalizeInferOptions("results.csv", {
        x: "epoch",
        y: "accuracy",
        specOut: "chart.vl.json",
      }),
    ).toThrow("Missing --chart <type>.");
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        y: "accuracy",
        specOut: "chart.vl.json",
      }),
    ).toThrow("Missing --x <field>.");
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        specOut: "chart.vl.json",
      }),
    ).toThrow("Missing --y <field>.");
  });

  test("requires an output path or spec output path", () => {
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
      }),
    ).toThrow("Missing output. Provide --out <path> or --spec-out <path>.");
  });

  test("requires svg output", () => {
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        out: "figure.png",
      }),
    ).toThrow('Unsupported output path "figure.png". This MVP supports only .svg output.');
  });

  test("rejects theme without render output", () => {
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        specOut: "chart.vl.json",
        theme: "paper-clean",
      }),
    ).toThrow("--theme requires --out because themes are applied during rendering.");
  });

  test("rejects non-positive dimensions", () => {
    expect(() =>
      normalizeInferOptions("results.csv", {
        chart: "line",
        x: "epoch",
        y: "accuracy",
        specOut: "chart.vl.json",
        width: "0",
      }),
    ).toThrow("--width must be a positive finite number.");
  });
});

describe("infer command", () => {
  test("writes spec output without rendering", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specOutputPath = join(workspacePath, "figures", "chart.vl.json");
      const result = await runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "line",
          "--x",
          "epoch",
          "--y",
          "accuracy",
          "--spec-out",
          specOutputPath,
        ],
        async () => ({ spec: cleanSpec() }),
      );

      expect(result.renderRequests).toEqual([]);
      expect(await readJson(specOutputPath)).toEqual(cleanSpec());
      expect(result.stdout).toBe(`Wrote ${specOutputPath}\n`);
    });
  });

  test("derives spec output next to svg output and renders it", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const outputPath = join(workspacePath, "figures", "chart.svg");
      const specOutputPath = join(workspacePath, "figures", "chart.vl.json");
      const result = await runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "line",
          "--x",
          "epoch",
          "--y",
          "accuracy",
          "--theme",
          "paper-clean",
          "--out",
          outputPath,
        ],
        async () => ({ spec: cleanSpec() }),
      );

      expect(await readJson(specOutputPath)).toEqual(cleanSpec());
      expect(result.renderRequests).toEqual([
        {
          inputPath: specOutputPath,
          outputPath,
          format: "svg",
          themeName: "paper-clean",
        },
      ]);
      expect(result.stdout).toBe(`Wrote ${specOutputPath}\nRendered ${outputPath}\n`);
    });
  });

  test("renders from explicit spec output path", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const outputPath = join(workspacePath, "figures", "chart.svg");
      const specOutputPath = join(workspacePath, "specs", "chart.vl.json");
      const result = await runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "scatter",
          "--x",
          "epoch",
          "--y",
          "accuracy",
          "--out",
          outputPath,
          "--spec-out",
          specOutputPath,
        ],
        async () => ({ spec: cleanSpec() }),
      );

      expect(result.renderRequests[0]?.inputPath).toBe(specOutputPath);
      expect(await readJson(specOutputPath)).toEqual(cleanSpec());
    });
  });

  test("passes normalized infer request to injected infer runner", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specOutputPath = join(workspacePath, "chart.vl.json");
      let receivedRequest: unknown;

      await runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "bar",
          "--x",
          "model",
          "--y",
          "score",
          "--color",
          "group",
          "--title",
          "Scores",
          "--width",
          "480",
          "--height",
          "320",
          "--spec-out",
          specOutputPath,
        ],
        async (request) => {
          receivedRequest = request;
          return { spec: cleanSpec() };
        },
      );

      expect(receivedRequest).toEqual({
        inputPath: "results.csv",
        chart: "bar",
        xField: "model",
        yField: "score",
        colorField: "group",
        title: "Scores",
        width: 480,
        height: 320,
        specOutputPath,
      });
    });
  });

  test("propagates command validation errors", async () => {
    await expect(
      runInferCommand(
        ["infer", "results.csv", "--chart", "line", "--x", "epoch", "--y", "accuracy"],
        async () => ({ spec: cleanSpec() }),
      ),
    ).rejects.toThrow("Missing output. Provide --out <path> or --spec-out <path>.");
  });
});

async function runInferCommand(
  args: string[],
  inferRunner: RunInfer,
): Promise<{ stdout: string; renderRequests: RenderRequest[] }> {
  let stdout = "";
  const renderRequests: RenderRequest[] = [];
  const program = new Command();
  program.exitOverride();

  const renderRunner: RunRender = async (request) => {
    renderRequests.push(request);
    return { outputPath: request.outputPath, warnings: [] };
  };

  registerInferCommand(
    program,
    (value) => {
      stdout += value;
    },
    inferRunner,
    renderRunner,
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, renderRequests };
}

function cleanSpec() {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    mark: "line",
    encoding: {},
    width: 360,
    height: 240,
  };
}

async function withTemporaryWorkspace(
  callback: (workspacePath: string) => Promise<void>,
) {
  const workspacePath = await mkdtemp(join(tmpdir(), "vega-paper-infer-command-test-"));

  try {
    await callback(workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer-command.test.ts
```

Expected: FAIL because `packages/cli/src/commands/infer.ts` does not exist.

- [ ] **Step 3: Implement infer command**

Create `packages/cli/src/commands/infer.ts`:

```ts
import type { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { VegaPaperError } from "../core/errors";
import {
  inferVegaLiteSpec,
  type InferRequest,
  type InferResult,
} from "../core/infer";
import { renderChart, type RenderRequest, type RenderResult } from "../core/render";

type InferCommandOptions = {
  chart?: string;
  x?: string;
  y?: string;
  color?: string;
  title?: string;
  width?: string;
  height?: string;
  theme?: string;
  out?: string;
  specOut?: string;
};

export type NormalizedInferOptions = InferRequest & {
  outputPath?: string | undefined;
  themeName?: string | undefined;
};

type WriteOutput = (value: string) => void;
export type RunInfer = (request: InferRequest) => Promise<InferResult>;
export type RunRender = (request: RenderRequest) => Promise<RenderResult>;

export function normalizeInferOptions(
  inputPath: string,
  options: InferCommandOptions,
): NormalizedInferOptions {
  if (!options.chart) {
    throw new VegaPaperError("Missing --chart <type>.");
  }

  if (!options.x) {
    throw new VegaPaperError("Missing --x <field>.");
  }

  if (!options.y) {
    throw new VegaPaperError("Missing --y <field>.");
  }

  if (!options.out && !options.specOut) {
    throw new VegaPaperError(
      "Missing output. Provide --out <path> or --spec-out <path>.",
    );
  }

  if (options.theme && !options.out) {
    throw new VegaPaperError(
      "--theme requires --out because themes are applied during rendering.",
    );
  }

  if (options.out && extname(options.out).toLowerCase() !== ".svg") {
    throw new VegaPaperError(
      `Unsupported output path "${options.out}". This MVP supports only .svg output.`,
    );
  }

  return {
    inputPath,
    chart: options.chart,
    xField: options.x,
    yField: options.y,
    colorField: options.color,
    title: options.title,
    width: parsePositiveNumberOption("--width", options.width),
    height: parsePositiveNumberOption("--height", options.height),
    specOutputPath: options.specOut ?? deriveSpecOutputPath(options.out as string),
    outputPath: options.out,
    themeName: options.theme,
  };
}

export function registerInferCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runInfer: RunInfer = inferVegaLiteSpec,
  runRender: RunRender = renderChart,
): void {
  program
    .command("infer")
    .argument("<csv>", "CSV input path")
    .description("Generate a Vega-Lite spec from CSV and optionally render SVG")
    .option("--chart <type>", "chart type: line, bar, or scatter")
    .option("--x <field>", "x encoding field")
    .option("--y <field>", "y encoding field")
    .option("--color <field>", "color encoding field")
    .option("--title <text>", "chart title")
    .option("--width <number>", "chart width")
    .option("--height <number>", "chart height")
    .option("--theme <name>", "theme name used when rendering")
    .option("--out <path>", "SVG output path")
    .option("--spec-out <path>", "Vega-Lite spec output path")
    .action(async (inputPath: string, options: InferCommandOptions) => {
      const normalized = normalizeInferOptions(inputPath, options);
      const { outputPath, themeName, ...inferRequest } = normalized;
      const result = await runInfer(inferRequest);

      await writeJsonFile(normalized.specOutputPath, result.spec);
      writeOutput(`Wrote ${normalized.specOutputPath}\n`);

      if (outputPath) {
        await runRender({
          inputPath: normalized.specOutputPath,
          outputPath,
          format: "svg",
          themeName,
        });
        writeOutput(`Rendered ${outputPath}\n`);
      }
    });
}

function deriveSpecOutputPath(outputPath: string): string {
  return outputPath.replace(/\.svg$/i, ".vl.json");
}

function parsePositiveNumberOption(
  optionName: string,
  value: string | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new VegaPaperError(`${optionName} must be a positive finite number.`);
  }

  return parsed;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
```

- [ ] **Step 4: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer-command.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: infer command tests, infer core tests, and typecheck pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: add infer command"
```

## Task 3: Register CLI Command and Add Smoke Fixture

**Files:**
- Modify: `packages/cli/src/index.ts`
- Create: `examples/training-curve/data.csv`
- Create: `packages/cli/test/infer.integration.test.ts`

- [ ] **Step 1: Write failing CLI registration and smoke tests**

Create `packages/cli/test/infer.integration.test.ts`:

```ts
import { access, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

const specOutputPath = "examples/training-curve/output.vl.json";
const svgOutputPath = "examples/training-curve/output.svg";

describe("infer integration", () => {
  afterEach(async () => {
    await rm(specOutputPath, { force: true });
    await rm(svgOutputPath, { force: true });
  });

  test("infers a Vega-Lite spec from the training curve fixture", async () => {
    const proc = Bun.spawn(
      [
        "bun",
        "packages/cli/src/index.ts",
        "infer",
        "examples/training-curve/data.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "accuracy",
        "--color",
        "model",
        "--spec-out",
        specOutputPath,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(await readJson(specOutputPath)).toMatchObject({
      data: { url: "data.csv" },
      mark: "line",
      encoding: {
        x: { field: "epoch", type: "quantitative", title: "epoch" },
        y: { field: "accuracy", type: "quantitative", title: "accuracy" },
        color: { field: "model", type: "nominal", title: "model" },
      },
    });
  });

  test("can render the inferred spec through the render core", async () => {
    if (!(await hasVegaLiteSvgBinary())) {
      console.warn("Skipping infer render integration: no vl2svg binary is installed.");
      return;
    }

    const proc = Bun.spawn(
      [
        "bun",
        "packages/cli/src/index.ts",
        "infer",
        "examples/training-curve/data.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "accuracy",
        "--color",
        "model",
        "--theme",
        "paper-clean",
        "--out",
        svgOutputPath,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    await access(specOutputPath);
    await access(svgOutputPath);
    expect(await readFile(svgOutputPath, "utf8")).toContain("<svg");
  });
});

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function hasVegaLiteSvgBinary(): Promise<boolean> {
  const candidates = [
    join("node_modules", ".bin", "vl2svg"),
    join("node_modules", ".bun", "node_modules", "vega-lite", "bin", "vl2svg"),
  ];

  try {
    const entries = await readdir(join("node_modules", ".bun"));
    candidates.push(
      ...entries
        .filter((entry) => entry.startsWith("vega-lite@"))
        .map((entry) =>
          join(
            "node_modules",
            ".bun",
            entry,
            "node_modules",
            "vega-lite",
            "bin",
            "vl2svg",
          ),
        ),
    );
  } catch {
    // No Bun package store means this integration test cannot render locally.
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Try the next supported install layout.
    }
  }

  return false;
}
```

- [ ] **Step 2: Run focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.integration.test.ts
```

Expected: FAIL because `infer` is not registered and `examples/training-curve/data.csv` does not exist.

- [ ] **Step 3: Register the command**

Modify `packages/cli/src/index.ts`.

Add import:

```ts
import { registerInferCommand } from "./commands/infer";
```

Register before lint/themes/doctor:

```ts
registerRenderCommand(program);
registerInferCommand(program);
registerLintCommand(program);
registerThemesCommand(program);
registerDoctorCommand(program);
```

- [ ] **Step 4: Add smoke CSV fixture**

Create `examples/training-curve/data.csv`:

```csv
epoch,accuracy,model
1,0.62,baseline
2,0.68,baseline
3,0.72,baseline
1,0.66,large
2,0.73,large
3,0.79,large
```

- [ ] **Step 5: Run focused and broad checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.integration.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer-command.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass. If the render integration test is guarded because the Vega-Lite CLI binary is unavailable, the spec-only CLI registration test must still pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/cli/src/index.ts examples/training-curve/data.csv packages/cli/test/infer.integration.test.ts
git commit -m "feat: register infer command"
```

## Task 4: Final Acceptance Verification

**Files:**
- Modify only files needed to fix verification issues.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 2: Run spec-only smoke command**

Run:

```bash
rm -f /tmp/vega-paper-infer-smoke.vl.json
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper infer examples/training-curve/data.csv --chart line --x epoch --y accuracy --color model --spec-out /tmp/vega-paper-infer-smoke.vl.json
PATH="$HOME/.bun/bin:$PATH" bun -e 'const spec=await Bun.file("/tmp/vega-paper-infer-smoke.vl.json").json(); if (typeof spec.data?.url !== "string") process.exit(2); if (spec.mark !== "line") process.exit(3); if (spec.encoding?.x?.type !== "quantitative") process.exit(4); console.log("INFER_SPEC_SMOKE=ok");'
```

Expected:

```text
INFER_SPEC_SMOKE=ok
```

The exact `data.url` from `/tmp` depends on the workspace path. This smoke checks that `data.url` exists and the generated mark/types are correct.

- [ ] **Step 3: Run project-local render smoke command**

Run:

```bash
rm -f examples/training-curve/output.vl.json examples/training-curve/output.svg
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper infer examples/training-curve/data.csv --chart line --x epoch --y accuracy --color model --theme paper-clean --out examples/training-curve/output.svg
test -f examples/training-curve/output.vl.json
test -f examples/training-curve/output.svg
PATH="$HOME/.bun/bin:$PATH" bun -e 'const spec=await Bun.file("examples/training-curve/output.vl.json").json(); if (spec.data?.url !== "data.csv") process.exit(2); const svg=await Bun.file("examples/training-curve/output.svg").text(); if (!svg.includes("<svg")) process.exit(3); console.log("INFER_RENDER_SMOKE=ok");'
```

Expected:

```text
INFER_RENDER_SMOKE=ok
```

- [ ] **Step 4: Run error smoke commands**

Run:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper infer examples/training-curve/data.csv --chart line --x epoch --y accuracy
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper infer examples/training-curve/data.csv --chart heatmap --x epoch --y accuracy --spec-out /tmp/vega-paper-invalid.vl.json
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper infer examples/training-curve/data.csv --chart line --x missing --y accuracy --spec-out /tmp/vega-paper-invalid.vl.json
```

Expected: each exits `1` and prints a `vega-paper:` prefixed `VegaPaperError`.

- [ ] **Step 5: Remove generated smoke artifacts**

Run:

```bash
rm -f /tmp/vega-paper-infer-smoke.vl.json /tmp/vega-paper-invalid.vl.json examples/training-curve/output.vl.json examples/training-curve/output.svg
```

- [ ] **Step 6: Check git status**

Run:

```bash
git status --short
```

Expected: clean implementation worktree. In the main checkout, pre-existing untracked `docs/initial-design.md` may remain and must not be committed unless explicitly requested.

- [ ] **Step 7: Commit verification fixes after code changes**

If acceptance verification required code changes:

```bash
git add packages/cli/src/core/infer.ts packages/cli/src/commands/infer.ts packages/cli/src/index.ts packages/cli/test/infer.test.ts packages/cli/test/infer-command.test.ts packages/cli/test/infer.integration.test.ts examples/training-curve/data.csv
git commit -m "fix: complete infer MVP verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: this plan covers CSV-only input, line/bar/scatter, explicit chart/x/y options, optional color/title/width/height/theme/out/spec-out, `data.url`, spec output rules, optional SVG render reuse, no linting, CSV parser behavior, minimal type inference, user-facing errors, tests, and smoke commands.
- Deferred scope remains explicit: no JSON input, no auto chart detection, no field role inference, no aggregation, no type overrides, no lint integration, no PDF/PNG output.
- Type consistency: `InferRequest`, `InferResult`, `InferChartType`, `NormalizedInferOptions`, `RunInfer`, and `RunRender` are defined before dependent tasks reference them.
