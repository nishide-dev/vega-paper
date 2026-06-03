# Infer Type Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--x-type`, `--y-type`, and `--color-type` options to `vega-paper infer` so users can override the automatically inferred Vega-Lite field type when the result is wrong.

**Architecture:** Export `VegaLiteFieldType` from the core and extend `InferRequest` with three optional override fields; the spec builder uses `request.xType ?? inferFieldType(...)` so inference is skipped when an override is provided. Validation of the type string is confined to the command layer, keeping the core type-agnostic.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | Export `VegaLiteFieldType`; add `xType`/`yType`/`colorType` to `InferRequest`; update encoding builder |
| `packages/cli/src/commands/infer.ts` | Add three Commander options; add `parseFieldType()`; update `normalizeInferOptions()` |
| `packages/cli/test/infer.test.ts` | Add three core override tests |
| `packages/cli/test/infer-command.test.ts` | Add four command passthrough/validation tests |

---

## Task 1: Core type support

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write three failing core tests**

Add to `packages/cli/test/infer.test.ts` inside the existing `describe("inferVegaLiteSpec", ...)` block, after the last existing test:

```ts
test("xType temporal overrides nominal inference for date strings", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "date,value\n2024-01-01,10\n2024-01-02,15\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "date",
    yField: "value",
    specOutputPath,
    xType: "temporal",
  });

  expect(result.spec).toMatchObject({
    encoding: {
      x: { field: "date", type: "temporal" },
      y: { field: "value", type: "quantitative" },
    },
  });
});

test("xType ordinal overrides quantitative inference for numeric field", async () => {
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
    xType: "ordinal",
  });

  expect(result.spec).toMatchObject({
    encoding: {
      x: { field: "epoch", type: "ordinal" },
    },
  });
});

test("colorType ordinal overrides the default nominal color type", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "x,y,rating\n1,2,3\n4,5,5\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "scatter",
    xField: "x",
    yField: "y",
    colorField: "rating",
    specOutputPath,
    colorType: "ordinal",
  });

  expect(result.spec).toMatchObject({
    encoding: {
      color: { field: "rating", type: "ordinal" },
    },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: 3 new failures. The TypeScript error (`xType` not in `InferRequest`) is silently ignored at bun's transpile step; the tests fail because the override has no effect yet.

- [ ] **Step 3: Export VegaLiteFieldType and extend InferRequest**

In `packages/cli/src/core/infer.ts`, add the new exported type **before** the existing `type InferFieldType` line:

```ts
export type VegaLiteFieldType = "quantitative" | "nominal" | "ordinal" | "temporal";
```

Extend `InferRequest` with three optional fields:

```ts
export type InferRequest = {
  inputPath: string;
  chart: InferChartType;
  xField: string;
  yField: string;
  colorField?: string | undefined;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  specOutputPath: string;
  xType?: VegaLiteFieldType | undefined;
  yType?: VegaLiteFieldType | undefined;
  colorType?: VegaLiteFieldType | undefined;
};
```

- [ ] **Step 4: Update the encoding builder in inferVegaLiteSpec()**

Replace the `encoding` object declaration (lines 52–65 in the current file) with:

```ts
const encoding: {
  x: { field: string; type: VegaLiteFieldType };
  y: { field: string; type: VegaLiteFieldType };
  color?: { field: string; type: VegaLiteFieldType };
} = {
  x: {
    field: request.xField,
    type: request.xType ?? inferFieldType(csv.rows, xIndex),
  },
  y: {
    field: request.yField,
    type: request.yType ?? inferFieldType(csv.rows, yIndex),
  },
};
```

Replace the color assignment block (lines 67–72) with:

```ts
if (request.colorField !== undefined && colorIndex !== undefined) {
  encoding.color = {
    field: request.colorField,
    type: request.colorType ?? "nominal",
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add VegaLiteFieldType and xType/yType/colorType to InferRequest"
```

---

## Task 2: Command option parsing and validation

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write four failing command tests**

Add to `packages/cli/test/infer-command.test.ts` inside the existing `describe("infer command", ...)` block, after the last existing test:

```ts
test("passes --x-type through to InferRequest", async () => {
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.csv",
      "--chart",
      "line",
      "--x",
      "date",
      "--x-type",
      "temporal",
      "--y",
      "value",
      "--spec-out",
      "out.vl.json",
    ],
    {
      ...calls,
      infer: async (request) => {
        calls.inferCalls.push(request);
        return createInferResult("../results.csv");
      },
    },
  );

  expect(calls.inferCalls).toEqual([
    expect.objectContaining({ xType: "temporal" }),
  ]);
});

test("passes --color-type through to InferRequest", async () => {
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.csv",
      "--chart",
      "scatter",
      "--x",
      "x",
      "--y",
      "y",
      "--color",
      "rating",
      "--color-type",
      "ordinal",
      "--spec-out",
      "out.vl.json",
    ],
    {
      ...calls,
      infer: async (request) => {
        calls.inferCalls.push(request);
        return createInferResult("../results.csv");
      },
    },
  );

  expect(calls.inferCalls).toEqual([
    expect.objectContaining({ colorType: "ordinal" }),
  ]);
});

test("rejects --x-type with an invalid type value", async () => {
  await expect(
    runInferCommand([
      "infer",
      "results.csv",
      "--chart",
      "line",
      "--x",
      "epoch",
      "--x-type",
      "invalid",
      "--y",
      "f1",
      "--spec-out",
      "out.vl.json",
    ]),
  ).rejects.toThrow(
    new VegaPaperError(
      'Invalid value "invalid" for --x-type. Expected one of: quantitative, nominal, ordinal, temporal.',
    ),
  );
});

test("rejects --color-type without --color", async () => {
  await expect(
    runInferCommand([
      "infer",
      "results.csv",
      "--chart",
      "scatter",
      "--x",
      "x",
      "--y",
      "y",
      "--color-type",
      "ordinal",
      "--spec-out",
      "out.vl.json",
    ]),
  ).rejects.toThrow(
    new VegaPaperError('The "--color-type" option requires "--color <field>".'),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

Expected: 4 new failures (`--x-type` unrecognized option, wrong InferRequest shape).

- [ ] **Step 3: Update InferCommandOptions**

In `packages/cli/src/commands/infer.ts`, extend `InferCommandOptions`:

```ts
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
  lintProfile?: string;
  strict?: boolean;
  xType?: string;
  yType?: string;
  colorType?: string;
};
```

- [ ] **Step 4: Register the three new Commander options**

In the `.action(...)` chain of `registerInferCommand`, add after the existing `.option("--spec-out <path>", ...)` line:

```ts
.option("--x-type <type>", "override inferred type for x encoding")
.option("--y-type <type>", "override inferred type for y encoding")
.option("--color-type <type>", "override color encoding type")
```

- [ ] **Step 5: Add parseFieldType() and update normalizeInferOptions()**

Add the import for `VegaLiteFieldType` to the existing import from `"../core/infer"`:

```ts
import {
  inferVegaLiteSpec,
  type InferChartType,
  type InferRequest,
  type InferResult,
  type VegaLiteFieldType,
} from "../core/infer";
```

Add the `parseFieldType` helper function (place it after `parsePositiveDimension`):

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

In `normalizeInferOptions()`, add after the `extname` check and before the `return` statement:

```ts
const xType = parseFieldType(options.xType, "--x-type");
const yType = parseFieldType(options.yType, "--y-type");
const colorType = parseFieldType(options.colorType, "--color-type");

if (colorType !== undefined && options.color === undefined) {
  throw new VegaPaperError('The "--color-type" option requires "--color <field>".');
}
```

Update the `return` statement to include the new fields:

```ts
return {
  inputPath,
  chart: parseInferChartType(options.chart),
  xField: requireOption(options.x, "--x <field>"),
  yField: requireOption(options.y, "--y <field>"),
  colorField: options.color,
  title: options.title,
  width: parsePositiveDimension(options.width, "--width <number>"),
  height: parsePositiveDimension(options.height, "--height <number>"),
  specOutputPath,
  xType,
  yType,
  colorType,
};
```

- [ ] **Step 6: Run command tests to verify they pass**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 7: Run full suite, typecheck, and build**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test && bun run typecheck && bun run build
```

Expected: all tests pass, no TypeScript errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: add --x-type, --y-type, --color-type options to infer command"
```
