# VegaPaper Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `vega-paper lint <spec>` as a static paper-quality lint command for Vega and Vega-Lite specs.

**Architecture:** Implement a pure rule module for static checks, a core `lintSpec()` module that loads/detects specs and returns structured issues, and a thin Commander wrapper for human/JSON output and exit-code behavior. Follow the existing `doctor` and `themes` command patterns, including output and exit-code injection in tests.

**Tech Stack:** Bun, TypeScript, Commander, Bun test, existing VegaPaper CLI core helpers.

---

## File Structure

- Create `packages/cli/src/core/lint-rules.ts`: pure static rule functions for the initial `paper` lint rules.
- Create `packages/cli/src/core/lint.ts`: public lint types, result helpers, and `lintSpec()`.
- Create `packages/cli/src/commands/lint.ts`: CLI command registration, output formatting, and exit code.
- Modify `packages/cli/src/index.ts`: register the lint command after render.
- Create `packages/cli/test/lint.test.ts`: core rule tests, core file-loading tests, and command tests.

## Task 1: Add Pure Lint Rules

**Files:**
- Create: `packages/cli/src/core/lint.ts`
- Create: `packages/cli/src/core/lint-rules.ts`
- Create: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing pure-rule tests**

Create `packages/cli/test/lint.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { runLintRules } from "../src/core/lint-rules";
import type { JsonObject, SpecType } from "../src/core/spec";

describe("runLintRules", () => {
  test("returns no issues for a clean minimal Vega-Lite spec", () => {
    expect(runRules(cleanVegaLiteSpec())).toEqual([]);
  });

  test("warns when axis titles are missing", () => {
    const spec = cleanVegaLiteSpec({
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "accuracy", type: "quantitative" },
      },
    });

    expect(runRules(spec).map((issue) => issue.ruleId)).toEqual([
      "axis-title-missing",
      "axis-title-missing",
    ]);
  });

  test("warns when the title is too long", () => {
    const spec = cleanVegaLiteSpec({
      title: "A".repeat(91),
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: "Title is longer than 90 characters.",
      suggestion: "Shorten the title or move detail into the caption.",
    });
  });

  test("warns when width or height is missing", () => {
    const spec = cleanVegaLiteSpec();
    delete spec.width;
    delete spec.height;

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "size-missing",
      path: "$",
      message: "Width and height are missing.",
      suggestion: "Set explicit width and height for reproducible paper figures.",
    });
  });

  test("warns when size is outside paper range", () => {
    const spec = cleanVegaLiteSpec({ width: 100, height: 900 });

    expect(runRules(spec).map((issue) => issue.ruleId)).toEqual([
      "size-out-of-range",
      "size-out-of-range",
    ]);
  });

  test("warns when inline data is large", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 501 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
        })),
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "inline-data-large",
      path: "$.data.values",
      message: "Inline data has 501 rows.",
      suggestion: "Use external data or pre-aggregate before rendering.",
    });
  });

  test("warns when color has too many categories", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `model-${index}`,
        })),
      },
      encoding: {
        x: { field: "epoch", type: "quantitative", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
        color: { field: "model", type: "nominal", title: "Model" },
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: "$.encoding.color",
      message: "Color field \"model\" has 13 categories.",
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  });

  test("warns when configured font sizes are too small", () => {
    const spec = cleanVegaLiteSpec({
      config: {
        axis: { labelFontSize: 7 },
        legend: { titleFontSize: 6 },
      },
    });

    expect(runRules(spec).map((issue) => issue.path)).toEqual([
      "$.config.axis.labelFontSize",
      "$.config.legend.titleFontSize",
    ]);
  });

  test("warns when bar chart y zero behavior is missing", () => {
    const spec = cleanVegaLiteSpec({
      mark: "bar",
      encoding: {
        x: { field: "epoch", type: "ordinal", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: "$.encoding.y.scale",
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    });
  });

  test("does not run Vega-Lite-only rules for Vega specs", () => {
    expect(
      runRules(
        {
          $schema: "https://vega.github.io/schema/vega/v6.json",
          width: 360,
          height: 240,
          marks: [],
          scales: [],
        },
        "vega",
      ),
    ).toEqual([]);
  });
});

function runRules(spec: JsonObject, specType: SpecType = "vega-lite") {
  return runLintRules({
    inputPath: "chart.vl.json",
    spec,
    specType,
  });
}

function cleanVegaLiteSpec(overrides: JsonObject = {}): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title: "Accuracy by epoch",
    width: 360,
    height: 240,
    data: {
      values: [
        { epoch: 1, accuracy: 0.62, model: "baseline" },
        { epoch: 2, accuracy: 0.68, model: "baseline" },
      ],
    },
    mark: "line",
    encoding: {
      x: { field: "epoch", type: "quantitative", title: "Epoch" },
      y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      color: { field: "model", type: "nominal", title: "Model" },
    },
    ...overrides,
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL because `packages/cli/src/core/lint-rules.ts` does not exist.

- [ ] **Step 3: Add shared lint types**

Create `packages/cli/src/core/lint.ts` with:

```ts
export type LintSeverity = "error" | "warning";

export type LintIssue = {
  severity: LintSeverity;
  ruleId: string;
  path: string;
  message: string;
  suggestion?: string;
};

export type LintResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
};

export type LintRequest = {
  inputPath: string;
};
```

- [ ] **Step 4: Implement pure lint rules**

Create `packages/cli/src/core/lint-rules.ts` with:

```ts
import type { LintIssue } from "./lint";
import type { JsonObject, SpecType } from "./spec";

export type LintRuleContext = {
  inputPath: string;
  spec: JsonObject;
  specType: SpecType;
};

export type LintRule = (context: LintRuleContext) => LintIssue[];

export const paperLintRules: LintRule[] = [
  checkTitleLength,
  checkAxisTitles,
  checkSizePresence,
  checkSizeRange,
  checkInlineDataSize,
  checkLegendCategoryCount,
  checkFontSizes,
  checkBarYAxisZero,
];

export function runLintRules(context: LintRuleContext): LintIssue[] {
  return paperLintRules.flatMap((rule) => rule(context));
}

function checkTitleLength({ spec }: LintRuleContext): LintIssue[] {
  if (typeof spec.title !== "string" || spec.title.length <= 90) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: "Title is longer than 90 characters.",
      suggestion: "Shorten the title or move detail into the caption.",
    },
  ];
}

function checkAxisTitles({ spec, specType }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const encoding = getObject(spec, "encoding");
  const issues: LintIssue[] = [];

  for (const channelName of ["x", "y"] as const) {
    const channel = encoding ? getObject(encoding, channelName) : undefined;

    if (!channel || typeof channel.field !== "string") {
      continue;
    }

    if (typeof channel.title === "string" && channel.title.trim() !== "") {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "axis-title-missing",
      path: `$.encoding.${channelName}`,
      message: `${channelName.toUpperCase()} axis is missing a title.`,
      suggestion: `Add encoding.${channelName}.title.`,
    });
  }

  return issues;
}

function checkSizePresence({ spec }: LintRuleContext): LintIssue[] {
  const missing = ["width", "height"].filter((key) => spec[key] === undefined);

  if (missing.length === 0) {
    return [];
  }

  const message =
    missing.length === 2
      ? "Width and height are missing."
      : `${capitalize(missing[0])} is missing.`;

  return [
    {
      severity: "warning",
      ruleId: "size-missing",
      path: "$",
      message,
      suggestion: "Set explicit width and height for reproducible paper figures.",
    },
  ];
}

function checkSizeRange({ spec }: LintRuleContext): LintIssue[] {
  const issues: LintIssue[] = [];
  const width = getNumber(spec, "width");
  const height = getNumber(spec, "height");

  if (width !== undefined && (width < 180 || width > 720)) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.width",
      message: `Width ${width} is outside the paper range 180-720.`,
      suggestion: "Choose a width that maps cleanly to paper column sizes.",
    });
  }

  if (height !== undefined && (height < 120 || height > 540)) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.height",
      message: `Height ${height} is outside the paper range 120-540.`,
      suggestion: "Choose a height that keeps labels readable without wasting space.",
    });
  }

  return issues;
}

function checkInlineDataSize({ spec }: LintRuleContext): LintIssue[] {
  const values = getInlineDataValues(spec);

  if (!values || values.length <= 500) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "inline-data-large",
      path: "$.data.values",
      message: `Inline data has ${values.length} rows.`,
      suggestion: "Use external data or pre-aggregate before rendering.",
    },
  ];
}

function checkLegendCategoryCount({
  spec,
  specType,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const encoding = getObject(spec, "encoding");
  const color = encoding ? getObject(encoding, "color") : undefined;
  const field = typeof color?.field === "string" ? color.field : undefined;
  const values = getInlineDataValues(spec);

  if (!field || !values) {
    return [];
  }

  const categories = new Set<string>();

  for (const row of values) {
    if (!isPlainObject(row)) {
      continue;
    }

    const value = row[field];

    if (typeof value === "string" || typeof value === "number") {
      categories.add(String(value));
    }
  }

  if (categories.size <= 12) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: "$.encoding.color",
      message: `Color field "${field}" has ${categories.size} categories.`,
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    },
  ];
}

function checkFontSizes({ spec }: LintRuleContext): LintIssue[] {
  const checks = [
    "$.config.axis.labelFontSize",
    "$.config.axis.titleFontSize",
    "$.config.legend.labelFontSize",
    "$.config.legend.titleFontSize",
  ];

  return checks.flatMap((path) => {
    const value = getPathNumber(spec, path);

    if (value === undefined || value >= 8) {
      return [];
    }

    return [
      {
        severity: "warning",
        ruleId: "font-size-small",
        path,
        message: `Font size ${value} is smaller than 8.`,
        suggestion: "Use font sizes of at least 8 for paper figures.",
      },
    ];
  });
}

function checkBarYAxisZero({
  spec,
  specType,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite" || !isBarMark(spec.mark)) {
    return [];
  }

  const encoding = getObject(spec, "encoding");
  const y = encoding ? getObject(encoding, "y") : undefined;

  if (!y || y.type !== "quantitative") {
    return [];
  }

  const scale = getObject(y, "scale");

  if (scale?.zero === true) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: "$.encoding.y.scale",
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    },
  ];
}

function getInlineDataValues(spec: JsonObject): unknown[] | undefined {
  const data = getObject(spec, "data");
  return Array.isArray(data?.values) ? data.values : undefined;
}

function getObject(value: JsonObject, key: string): JsonObject | undefined {
  const child = value[key];
  return isPlainObject(child) ? child : undefined;
}

function getNumber(value: JsonObject, key: string): number | undefined {
  return typeof value[key] === "number" ? value[key] : undefined;
}

function getPathNumber(spec: JsonObject, path: string): number | undefined {
  const segments = path.replace(/^\$\./, "").split(".");
  let current: unknown = spec;

  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return typeof current === "number" ? current : undefined;
}

function isBarMark(mark: unknown): boolean {
  if (mark === "bar") {
    return true;
  }

  return isPlainObject(mark) && mark.type === "bar";
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: all lint rule tests pass and typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/core/lint.ts packages/cli/src/core/lint-rules.ts packages/cli/test/lint.test.ts
git commit -m "feat: add static lint rules"
```

## Task 2: Add Core lintSpec()

**Files:**
- Modify: `packages/cli/src/core/lint.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Add failing core lintSpec tests**

Append these imports to `packages/cli/test/lint.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintSpec } from "../src/core/lint";
```

Append these tests to `packages/cli/test/lint.test.ts`:

```ts
describe("lintSpec", () => {
  test("returns no issues for a clean file", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const inputPath = join(workspace, "clean.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec());

      expect(await lintSpec({ inputPath })).toEqual({
        ok: true,
        errorCount: 0,
        warningCount: 0,
        issues: [],
      });
    });
  });

  test("returns spec-unreadable for invalid JSON", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const inputPath = join(workspace, "invalid.vl.json");
      await writeFile(inputPath, "{", "utf8");

      const result = await lintSpec({ inputPath });

      expect(result.ok).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0]).toEqual({
        severity: "error",
        ruleId: "spec-unreadable",
        path: "$",
        message: `Could not read ${inputPath}: Invalid JSON in input file: ${inputPath}`,
        suggestion: "Provide a readable JSON object file.",
      });
    });
  });

  test("returns spec-unknown-type for unknown JSON objects", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const inputPath = join(workspace, "unknown.json");
      await writeJson(inputPath, { hello: "world" });

      const result = await lintSpec({ inputPath });

      expect(result.ok).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0]).toEqual({
        severity: "error",
        ruleId: "spec-unknown-type",
        path: "$",
        message: "Could not determine whether the input is Vega-Lite or Vega.",
        suggestion: "Add a Vega/Vega-Lite $schema or recognizable mark/encoding or marks/scales fields.",
      });
    });
  });

  test("returns warnings from static rules", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const inputPath = join(workspace, "warnings.vl.json");
      const spec = cleanVegaLiteSpec();
      delete spec.width;
      await writeJson(inputPath, spec);

      const result = await lintSpec({ inputPath });

      expect(result.ok).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(1);
      expect(result.issues[0]?.ruleId).toBe("size-missing");
    });
  });
});

async function withTemporaryWorkspace<T>(
  callback: (workspace: string) => Promise<T>,
): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-lint-test-"));

  try {
    return await callback(workspace);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value), "utf8");
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL because `lintSpec` is not exported from `packages/cli/src/core/lint.ts`.

- [ ] **Step 3: Implement lintSpec core**

Replace `packages/cli/src/core/lint.ts` with:

```ts
import { runLintRules } from "./lint-rules";
import { VegaPaperError } from "./errors";
import { detectSpecType, loadJsonSpec } from "./spec";

export type LintSeverity = "error" | "warning";

export type LintIssue = {
  severity: LintSeverity;
  ruleId: string;
  path: string;
  message: string;
  suggestion?: string;
};

export type LintResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
};

export type LintRequest = {
  inputPath: string;
};

export async function lintSpec(request: LintRequest): Promise<LintResult> {
  let spec: Awaited<ReturnType<typeof loadJsonSpec>>;

  try {
    spec = await loadJsonSpec(request.inputPath);
  } catch (error) {
    return createLintResult([
      {
        severity: "error",
        ruleId: "spec-unreadable",
        path: "$",
        message: `Could not read ${request.inputPath}: ${getErrorMessage(error)}`,
        suggestion: "Provide a readable JSON object file.",
      },
    ]);
  }

  try {
    const specType = detectSpecType(spec);

    return createLintResult(
      runLintRules({
        inputPath: request.inputPath,
        spec,
        specType,
      }),
    );
  } catch (error) {
    if (error instanceof VegaPaperError) {
      return createLintResult([
        {
          severity: "error",
          ruleId: "spec-unknown-type",
          path: "$",
          message: "Could not determine whether the input is Vega-Lite or Vega.",
          suggestion:
            "Add a Vega/Vega-Lite $schema or recognizable mark/encoding or marks/scales fields.",
        },
      ]);
    }

    throw error;
  }
}

export function createLintResult(issues: LintIssue[]): LintResult {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Run focused and broad checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/lint.ts packages/cli/test/lint.test.ts
git commit -m "feat: add lint core"
```

## Task 3: Add lint CLI Command

**Files:**
- Create: `packages/cli/src/commands/lint.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Add failing command tests**

Append these imports to `packages/cli/test/lint.test.ts`:

```ts
import { Command } from "commander";
import { registerLintCommand } from "../src/commands/lint";
import type { LintResult } from "../src/core/lint";
```

Append these tests to `packages/cli/test/lint.test.ts`:

```ts
describe("lint command", () => {
  test("prints a clean human message", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json"],
      cleanLintResult(),
    );

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
  });

  test("prints human issue summary and table", async () => {
    const result = createCommandLintResult([
      {
        severity: "warning",
        ruleId: "axis-title-missing",
        path: "$.encoding.x",
        message: "X axis is missing a title.",
        suggestion: "Add encoding.x.title.",
      },
    ]);

    const output = await runLintCommand(["lint", "chart.vl.json"], result);

    expect(output.stdout).toContain("1 warning, 0 errors");
    expect(output.stdout).toContain("severity  rule                path          message");
    expect(output.stdout).toContain("warning   axis-title-missing  $.encoding.x  X axis is missing a title.");
    expect(output.exitCode).toBeUndefined();
  });

  test("prints JSON without human text", async () => {
    const result = createCommandLintResult([
      {
        severity: "warning",
        ruleId: "size-missing",
        path: "$",
        message: "Width is missing.",
      },
    ]);

    const output = await runLintCommand(["lint", "chart.vl.json", "--json"], result);

    expect(JSON.parse(output.stdout)).toEqual(result);
    expect(output.stdout).not.toContain("warning,");
  });

  test("sets exit code 1 when errors exist", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json", "--json"],
      createCommandLintResult([
        {
          severity: "error",
          ruleId: "spec-unknown-type",
          path: "$",
          message: "Could not determine whether the input is Vega-Lite or Vega.",
        },
      ]),
    );

    expect(output.exitCode).toBe(1);
  });

  test("sets exit code 1 for warnings only in strict mode", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json", "--strict"],
      createCommandLintResult([
        {
          severity: "warning",
          ruleId: "size-missing",
          path: "$",
          message: "Width is missing.",
        },
      ]),
    );

    expect(output.exitCode).toBe(1);
  });
});

async function runLintCommand(
  args: string[],
  result: LintResult,
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  let stdout = "";
  let exitCode: 0 | 1 | undefined;
  const program = new Command();

  program.exitOverride();

  registerLintCommand(
    program,
    (value) => {
      stdout += value;
    },
    async () => result,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}

function cleanLintResult(): LintResult {
  return {
    ok: true,
    errorCount: 0,
    warningCount: 0,
    issues: [],
  };
}

function createCommandLintResult(issues: LintResult["issues"]): LintResult {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL because `packages/cli/src/commands/lint.ts` does not exist.

- [ ] **Step 3: Implement lint command**

Create `packages/cli/src/commands/lint.ts` with:

```ts
import type { Command } from "commander";
import { lintSpec, type LintResult } from "../core/lint";
import { formatTable, toPrettyJson } from "../core/format";

type LintOptions = {
  json?: boolean;
  strict?: boolean;
};

type WriteOutput = (value: string) => void;
type RunLint = (inputPath: string) => Promise<LintResult>;
type SetExitCode = (exitCode: 0 | 1) => void;

export function registerLintCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runLint: RunLint = (inputPath) => lintSpec({ inputPath }),
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
): void {
  program
    .command("lint")
    .argument("<spec>", "Vega or Vega-Lite JSON input path")
    .description("Check a Vega or Vega-Lite spec for paper figure issues")
    .option("--json", "print JSON")
    .option("--strict", "exit with code 1 when warnings are present")
    .action(async (inputPath: string, options: LintOptions) => {
      const result = await runLint(inputPath);
      const exitCode = getLintExitCode(result, Boolean(options.strict));

      if (options.json) {
        writeOutput(toPrettyJson(result));
      } else {
        writeOutput(formatLintHuman(result));
      }

      if (exitCode !== 0) {
        setExitCode(exitCode);
      }
    });
}

export function getLintExitCode(result: LintResult, strict: boolean): 0 | 1 {
  if (result.errorCount > 0) {
    return 1;
  }

  if (strict && result.warningCount > 0) {
    return 1;
  }

  return 0;
}

function formatLintHuman(result: LintResult): string {
  if (result.issues.length === 0) {
    return "No lint issues found.\n";
  }

  const summary = `${formatCount(result.warningCount, "warning")}, ${formatCount(
    result.errorCount,
    "error",
  )}`;
  const table = formatTable({
    headers: ["severity", "rule", "path", "message"],
    rows: result.issues.map((issue) => [
      issue.severity,
      issue.ruleId,
      issue.path,
      issue.message,
    ]),
  });

  return `${summary}\n${table}\n`;
}

function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
```

- [ ] **Step 4: Register command in CLI entrypoint**

Modify `packages/cli/src/index.ts`:

```ts
import { registerLintCommand } from "./commands/lint";
```

Register after render:

```ts
registerRenderCommand(program);
registerLintCommand(program);
registerThemesCommand(program);
registerDoctorCommand(program);
```

- [ ] **Step 5: Run checks and smoke commands**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint examples/basic-line/chart.vl.json
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint examples/basic-line/chart.vl.json --json
```

Expected: tests/typecheck/build pass. The smoke commands complete and print either warnings or a clean result; JSON output parses.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/lint.ts packages/cli/src/index.ts packages/cli/test/lint.test.ts
git commit -m "feat: add lint cli command"
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

- [ ] **Step 2: Run lint acceptance commands**

Run:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint examples/basic-line/chart.vl.json
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint examples/basic-line/chart.vl.json --json
```

Expected:

- Human output is readable and ends with a newline.
- JSON output parses and contains `ok`, `errorCount`, `warningCount`, and `issues`.

- [ ] **Step 3: Run strict-mode smoke**

Create a temporary warning spec and run strict mode:

```bash
tmp_spec="$(mktemp /tmp/vega-paper-lint-warning-XXXXXX.vl.json)"
printf '%s\n' '{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","data":{"values":[{"x":1,"y":2}]},"mark":"bar","encoding":{"x":{"field":"x","type":"quantitative"},"y":{"field":"y","type":"quantitative"}}}' > "$tmp_spec"
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --strict
```

Expected: command exits `1` because warning-only lint fails in strict mode.

- [ ] **Step 4: Run invalid JSON smoke**

Create invalid JSON and run JSON mode:

```bash
tmp_bad="$(mktemp /tmp/vega-paper-lint-bad-XXXXXX.json)"
printf '{' > "$tmp_bad"
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_bad" --json
```

Expected: command exits `1`; output parses as JSON with a `spec-unreadable` issue.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes except pre-existing untracked `docs/initial-design.md` in the main checkout. If executing in an isolated worktree, expected status is clean.

- [ ] **Step 6: Commit verification fixes if needed**

If acceptance verification required code changes:

```bash
git add <changed-files>
git commit -m "fix: complete lint verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: this plan covers static spec lint, error/warning separation, human output, JSON output, strict mode, core/command separation, the MVP rule set, tests, and smoke commands.
- Deferred scope is explicit: no rendered SVG lint, PDF/PNG checks, CLI profiles, markdown reports, score system, auto-repair, or deep Vega mark analysis.
- Type consistency: `LintIssue`, `LintResult`, `LintRequest`, `LintRuleContext`, `runLintRules`, `lintSpec`, and `registerLintCommand` are introduced before later tasks use them.
- Testing discipline: each implementation task starts with failing tests and includes focused and broad verification.
