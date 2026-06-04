# Infer JSON Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept `.json` array-of-objects input in `vega-paper infer`, default to `data.url`, and add `--inline-data` for CSV/JSON `data.values` embedding.

**Architecture:** Add `parseJsonArray()` and `loadTabularInput()` in `core/infer.ts` so CSV and JSON share one encoding path over `header` + `rows`. Extension detection uses `extname(inputPath).toLowerCase()`. `InferRequest.inlineData` switches `data.url` vs `data.values`. Command layer only registers `--inline-data` and updates help text.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-03-vega-paper-infer-json-input-design.md](../specs/2026-06-03-vega-paper-infer-json-input-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | `parseJsonArray`, `loadTabularInput`, `inlineData` on `InferRequest`, refactor `inferVegaLiteSpec`, `Field` errors, unsupported extension |
| `packages/cli/src/commands/infer.ts` | `--inline-data`, argument description, pass `inlineData` in `normalizeInferOptions` |
| `packages/cli/test/infer.test.ts` | `parseJsonArray` tests, JSON/inline/CSV-inline tests, update field-not-found expectations |
| `packages/cli/test/infer-command.test.ts` | `--inline-data` passthrough tests |

---

## Task 1: `parseJsonArray` parser

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add a new `describe("parseJsonArray", () => { ... })` block in `packages/cli/test/infer.test.ts` **before** `describe("inferVegaLiteSpec", ...)`:

```ts
import { parseCsv, parseJsonArray, inferVegaLiteSpec, type InferRequest } from "../src/core/infer";

describe("parseJsonArray", () => {
  test("collects union keys in first-seen order", () => {
    expect(
      parseJsonArray(
        '[{"b":2,"a":1},{"c":3,"a":9}]',
      ),
    ).toEqual({
      header: ["b", "a", "c"],
      rows: [
        ["2", "1", ""],
        ["", "9", "3"],
      ],
      values: [{ b: 2, a: 1 }, { a: 9, c: 3 }],
    });
  });

  test("normalizes null and missing keys to empty strings", () => {
    expect(parseJsonArray('[{"x":1},{"x":null,"y":"ok"}]')).toEqual({
      header: ["x", "y"],
      rows: [
        ["1", ""],
        ["", "ok"],
      ],
      values: [{ x: 1 }, { x: null, y: "ok" }],
    });
  });

  test("rejects empty arrays", () => {
    expect(() => parseJsonArray("[]")).toThrow(
      "JSON input must be a non-empty array of objects.",
    );
  });

  test("rejects non-array top level", () => {
    expect(() => parseJsonArray('{"mark":"bar"}')).toThrow(
      "JSON input must be a non-empty array of objects.",
    );
  });

  test("rejects non-object elements", () => {
    expect(() => parseJsonArray('[{"x":1},42]')).toThrow(
      "JSON input must contain only objects.",
    );
  });

  test("rejects nested cell values", () => {
    expect(() => parseJsonArray('[{"x":{"nested":true}}]')).toThrow(
      'JSON field "x" contains a nested value.',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: failures for `parseJsonArray` not exported / not defined.

- [ ] **Step 3: Implement `parseJsonArray`**

In `packages/cli/src/core/infer.ts`, add after `ParsedCsv`:

```ts
export type ParsedJsonArray = {
  header: string[];
  rows: string[][];
  values: JsonObject[];
};
```

Add imports if needed: `extname` from `node:path` (used in Task 2; can add now).

Implement and export:

```ts
export function parseJsonArray(contents: string): ParsedJsonArray {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new VegaPaperError("Invalid JSON in input file.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new VegaPaperError(
      "JSON input must be a non-empty array of objects.",
    );
  }

  const header: string[] = [];
  const seenKeys = new Set<string>();

  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new VegaPaperError("JSON input must contain only objects.");
    }

    for (const key of Object.keys(item as JsonObject)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        header.push(key);
      }
    }
  }

  const values = parsed as JsonObject[];
  const rows = values.map((item) =>
    header.map((key) => normalizeJsonCell(item[key], key)),
  );

  return { header, rows, values };
}

function normalizeJsonCell(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    throw new VegaPaperError(`JSON field "${key}" contains a nested value.`);
  }

  return String(value);
}
```

- [ ] **Step 4: Run parser tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all `parseJsonArray` tests PASS; other tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add parseJsonArray for infer JSON input"
```

---

## Task 2: JSON file loading and `inferVegaLiteSpec` with `data.url`

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add inside `describe("inferVegaLiteSpec", ...)`:

```ts
test("builds a line spec with a relative JSON url", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.json");
  const specOutputPath = join(workspace, "nested", "chart.vl.json");

  await Bun.write(
    inputPath,
    '[{"epoch":1,"f1":0.61},{"epoch":2,"f1":0.68}]',
  );

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "epoch",
    yField: "f1",
    specOutputPath,
  });

  expect(result.spec).toMatchObject({
    data: { url: "../data.json" },
    encoding: {
      x: { field: "epoch", type: "quantitative" },
      y: { field: "f1", type: "quantitative" },
    },
  });
});

test("rejects unsupported input extensions", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.tsv");

  await Bun.write(inputPath, "epoch\tf1\n1\t0.5\n");

  await expect(
    inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath: join(workspace, "chart.vl.json"),
    }),
  ).rejects.toThrow(
    'Unsupported input format ".tsv". Expected a .csv or .json file.',
  );
});

test("rejects invalid JSON files", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "broken.json");

  await Bun.write(inputPath, "[not json");

  await expect(
    inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath: join(workspace, "chart.vl.json"),
    }),
  ).rejects.toThrow(`Invalid JSON in input file: ${inputPath}`);
});
```

- [ ] **Step 2: Run tests to verify new failures**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: new JSON / extension tests FAIL.

- [ ] **Step 3: Add `loadTabularInput` and refactor `inferVegaLiteSpec`**

At top of `packages/cli/src/core/infer.ts`, extend path import:

```ts
import { dirname, extname, relative } from "node:path";
```

Add internal type:

```ts
type TabularInput = {
  header: string[];
  rows: string[][];
  jsonValues?: JsonObject[] | undefined;
};
```

Add helpers:

```ts
type InputFormat = "csv" | "json";

function getInputFormat(inputPath: string): InputFormat {
  const extension = extname(inputPath).toLowerCase();

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".json") {
    return "json";
  }

  throw new VegaPaperError(
    `Unsupported input format "${extension}". Expected a .csv or .json file.`,
  );
}

async function loadTabularInput(inputPath: string): Promise<TabularInput> {
  const format = getInputFormat(inputPath);

  if (format === "csv") {
    const csv = await readCsv(inputPath);
    return { header: csv.header, rows: csv.rows };
  }

  const json = await readJsonArray(inputPath);
  return {
    header: json.header,
    rows: json.rows,
    jsonValues: json.values,
  };
}

async function readJsonArray(inputPath: string): Promise<ParsedJsonArray> {
  const file = Bun.file(inputPath);

  if (!(await file.exists())) {
    throw new VegaPaperError(`JSON file not found or unreadable: ${inputPath}`);
  }

  try {
    const parsed = parseJsonArray(await file.text());
    return parsed;
  } catch (error) {
    if (error instanceof VegaPaperError) {
      if (error.message === "Invalid JSON in input file.") {
        throw new VegaPaperError(`Invalid JSON in input file: ${inputPath}`);
      }

      if (
        error.message === "JSON input must be a non-empty array of objects." ||
        error.message === "JSON input must contain only objects."
      ) {
        throw new VegaPaperError(
          `${error.message.replace(/\.$/, "")}: ${inputPath}`,
        );
      }

      throw error;
    }

    throw new VegaPaperError(`JSON file not found or unreadable: ${inputPath}`);
  }
}
```

Replace the body start of `inferVegaLiteSpec` — swap `readCsv` for tabular load and use `tabular.header` / `tabular.rows`:

```ts
export async function inferVegaLiteSpec(
  request: InferRequest,
): Promise<InferResult> {
  const chart = parseChartType(request.chart);
  const tabular = await loadTabularInput(request.inputPath);
  const xIndex = findFieldIndex(tabular.header, request.xField);
  const yIndex = findFieldIndex(tabular.header, request.yField);
  const colorIndex =
    request.colorField === undefined
      ? undefined
      : findFieldIndex(tabular.header, request.colorField);

  const encoding: {
    x: { field: string; type: VegaLiteFieldType };
    y: { field: string; type: VegaLiteFieldType };
    color?: { field: string; type: VegaLiteFieldType };
  } = {
    x: {
      field: request.xField,
      type: request.xType ?? inferFieldType(tabular.rows, xIndex),
    },
    y: {
      field: request.yField,
      type: request.yType ?? inferFieldType(tabular.rows, yIndex),
    },
  };

  if (request.colorField !== undefined && colorIndex !== undefined) {
    encoding.color = {
      field: request.colorField,
      type: request.colorType ?? "nominal",
    };
  }

  const spec: JsonObject = {
    $schema: VEGA_LITE_SCHEMA,
    data: {
      url: toRelativeDataUrl(request.specOutputPath, request.inputPath),
    },
    mark: MARK_BY_CHART[chart],
    width: request.width ?? DEFAULT_WIDTH,
    height: request.height ?? DEFAULT_HEIGHT,
    encoding,
  };

  // ... title unchanged
}
```

Update `findFieldIndex` message:

```ts
throw new VegaPaperError(`Field "${field}" was not found.`);
```

Update `infer.test.ts` test `"rejects missing x, y, and color fields"` expectations from `CSV field` to `Field`.

- [ ] **Step 4: Run infer tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: load JSON array input in infer with data.url"
```

---

## Task 3: `--inline-data` / `data.values`

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing inline tests**

Add to `describe("inferVegaLiteSpec", ...)`:

```ts
test("embeds JSON objects in data.values when inlineData is true", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.json");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(
    inputPath,
    '[{"epoch":1,"f1":0.61},{"epoch":2,"f1":0.68}]',
  );

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "epoch",
    yField: "f1",
    specOutputPath,
    inlineData: true,
  });

  expect(result.spec.data).toEqual({
    values: [{ epoch: 1, f1: 0.61 }, { epoch: 2, f1: 0.68 }],
  });
  expect(result.spec.data).not.toHaveProperty("url");
});

test("embeds CSV rows as all-string objects when inlineData is true", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "epoch,f1\n1,0.61\n2,0.68\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "epoch",
    yField: "f1",
    specOutputPath,
    inlineData: true,
  });

  expect(result.spec.data).toEqual({
    values: [
      { epoch: "1", f1: "0.61" },
      { epoch: "2", f1: "0.68" },
    ],
  });
  expect(result.spec.data).not.toHaveProperty("url");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: 2 new failures (`inlineData` ignored; still has `url`).

- [ ] **Step 3: Implement inline data branch**

Extend `InferRequest`:

```ts
export type InferRequest = {
  // ...existing fields...
  inlineData?: boolean | undefined;
};
```

Add builder:

```ts
function buildInlineValues(
  tabular: TabularInput,
): JsonObject[] {
  if (tabular.jsonValues !== undefined) {
    return tabular.jsonValues;
  }

  return tabular.rows.map((row) => {
    const record: JsonObject = {};

    for (let index = 0; index < tabular.header.length; index += 1) {
      const key = tabular.header[index];

      if (key === undefined) {
        continue;
      }

      record[key] = row[index] ?? "";
    }

    return record;
  });
}
```

In `inferVegaLiteSpec`, replace fixed `data: { url: ... }` with:

```ts
const data: JsonObject = request.inlineData
  ? { values: buildInlineValues(tabular) }
  : { url: toRelativeDataUrl(request.specOutputPath, request.inputPath) };

const spec: JsonObject = {
  $schema: VEGA_LITE_SCHEMA,
  data,
  mark: MARK_BY_CHART[chart],
  // ...
};
```

- [ ] **Step 4: Run infer tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add inline data.values support for infer CSV and JSON"
```

---

## Task 4: Command `--inline-data`

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command tests**

Add inside `describe("infer command", ...)`:

```ts
test("passes inlineData when --inline-data is provided", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.json",
      "--chart",
      "line",
      "--x",
      "epoch",
      "--y",
      "f1",
      "--inline-data",
      "--spec-out",
      specOutputPath,
    ],
    {
      ...calls,
      infer: async (request) => {
        calls.inferCalls.push(request);
        return createInferResult("../results.json");
      },
    },
  );

  expect(calls.inferCalls).toEqual([
    {
      inputPath: "results.json",
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath,
      inlineData: true,
    },
  ]);
});

test("omits inlineData when --inline-data is not provided", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.csv",
      "--chart",
      "line",
      "--x",
      "epoch",
      "--y",
      "f1",
      "--spec-out",
      specOutputPath,
    ],
    {
      ...calls,
      infer: async (request) => {
        calls.inferCalls.push(request);
        return createInferResult("../results.csv");
      },
    },
  );

  expect(calls.inferCalls[0]).not.toHaveProperty("inlineData");
});
```

- [ ] **Step 2: Run command tests to verify they fail**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

Expected: `inlineData` not passed / undefined on first test.

- [ ] **Step 3: Register option and wire normalizeInferOptions**

In `packages/cli/src/commands/infer.ts`:

Update argument and description:

```ts
.argument("<input>", "CSV or JSON input path")
.description("Generate a Vega-Lite spec from CSV or JSON and optionally render SVG")
```

Add option after `--color-type`:

```ts
.option("--inline-data", "embed parsed data in the generated spec as data.values")
```

Extend `InferCommandOptions`:

```ts
inlineData?: boolean;
```

In `normalizeInferOptions` return object, add:

```ts
inlineData: options.inlineData === true ? true : undefined,
```

Use `=== true` so Commander does not pass truthy strings accidentally.

- [ ] **Step 4: Run command and full CLI tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts test/infer.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: add --inline-data option to infer command"
```

---

## Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full workspace checks**

From repository root:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass with no errors.

- [ ] **Step 2: Optional smoke**

```bash
cd /Users/ryusei0623/projects/vega-paper
mkdir -p /tmp/vega-paper-json-smoke
printf '%s\n' '[{"epoch":1,"f1":0.5},{"epoch":2,"f1":0.7}]' > /tmp/vega-paper-json-smoke/data.json
vega-paper infer /tmp/vega-paper-json-smoke/data.json \
  --chart line --x epoch --y f1 \
  --spec-out /tmp/vega-paper-json-smoke/chart.vl.json
grep -q '"url": "data.json"' /tmp/vega-paper-json-smoke/chart.vl.json && echo "SMOKE_URL=ok"
vega-paper infer /tmp/vega-paper-json-smoke/data.json \
  --chart line --x epoch --y f1 --inline-data \
  --spec-out /tmp/vega-paper-json-smoke/chart-inline.vl.json
grep -q '"values"' /tmp/vega-paper-json-smoke/chart-inline.vl.json && echo "SMOKE_INLINE=ok"
```

Expected: `SMOKE_URL=ok` and `SMOKE_INLINE=ok`.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `.json` non-empty object array | Task 1, 2 |
| Union keys, first-seen order | Task 1 |
| Cell normalization / nested error | Task 1 |
| Default `data.url` for JSON | Task 2 |
| Unsupported extension error | Task 2 |
| `Field` not-found message | Task 2 |
| `--inline-data` JSON native values | Task 3 |
| `--inline-data` CSV string values | Task 3 |
| Command option + help text | Task 4 |
| Tests listed in spec | Tasks 1–4 |

---

## Expected User Impact

`vega-paper infer results.json --chart line --x epoch --y f1 --spec-out out.vl.json` works like CSV. `--inline-data` produces portable specs for both formats without changing encoding, lint, or render behavior when omitted.
