# Infer Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--chart heatmap` to `vega-paper infer` with `mark: "rect"` and ordinal x/y plus quantitative color encoding.

**Architecture:** Branch encoding construction when `chart === "heatmap"`; validate required `--color` and distinct x/y/color fields in the command layer. Reuse existing facet wrapping and flat-spec paths.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-heatmap-design.md](../specs/2026-06-04-vega-paper-infer-heatmap-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | Add `heatmap` chart; heatmap encoding branch; required color in core |
| `packages/cli/src/commands/infer.ts` | Help text; heatmap validations |
| `packages/cli/test/infer.test.ts` | Heatmap spec + error tests |
| `packages/cli/test/infer-command.test.ts` | Command validation tests |

---

## Task 1: Core heatmap support

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing core tests**

Add inside `describe("inferVegaLiteSpec", ...)`:

```ts
test("builds a heatmap spec with rect mark and ordinal x/y plus quantitative color", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "predicted,actual,count\na,a,10\na,b,2\nb,a,1\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "heatmap",
    xField: "predicted",
    yField: "actual",
    colorField: "count",
    specOutputPath,
  });

  expect(result.spec).toMatchObject({
    mark: "rect",
    encoding: {
      x: { field: "predicted", type: "ordinal" },
      y: { field: "actual", type: "ordinal" },
      color: { field: "count", type: "quantitative" },
    },
  });
});

test("rejects heatmap without a color field in the request", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");

  await Bun.write(inputPath, "x,y,v\na,b,1\n");

  await expect(
    inferVegaLiteSpec({
      inputPath,
      chart: "heatmap",
      xField: "x",
      yField: "y",
      specOutputPath: join(workspace, "chart.vl.json"),
    }),
  ).rejects.toThrow(
    'The "--color" option is required when --chart heatmap is used.',
  );
});
```

Update unsupported chart test invalid value from `"heatmap"` to `"boxplot"` and expected message:

```ts
const invalidChart = "boxplot" as unknown as InferRequest["chart"];
// ...
'Unsupported chart type "boxplot". Expected one of: line, bar, scatter, area, heatmap.',
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

- [ ] **Step 3: Implement core heatmap branch**

Extend types and mark map:

```ts
export type InferChartType = "line" | "bar" | "scatter" | "area" | "heatmap";

const MARK_BY_CHART: Record<InferChartType, InferMark> = {
  line: "line",
  bar: "bar",
  scatter: "point",
  area: { type: "area", line: true },
  heatmap: "rect",
};
```

Replace cartesian-only encoding block with:

```ts
let encoding: {
  x: { field: string; type: VegaLiteFieldType };
  y: { field: string; type: VegaLiteFieldType };
  color?: { field: string; type: VegaLiteFieldType };
};

if (chart === "heatmap") {
  if (request.colorField === undefined) {
    throw new VegaPaperError(
      'The "--color" option is required when --chart heatmap is used.',
    );
  }

  findFieldIndex(tabular.header, request.colorField);

  encoding = {
    x: {
      field: request.xField,
      type: request.xType ?? "ordinal",
    },
    y: {
      field: request.yField,
      type: request.yType ?? "ordinal",
    },
    color: {
      field: request.colorField,
      type: request.colorType ?? "quantitative",
    },
  };
} else {
  // existing cartesian encoding logic (x/y inference + optional color series)
}
```

Update `parseChartType()` to accept `heatmap` and list it in the error message.

- [ ] **Step 4: Run core tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add heatmap chart type to infer core"
```

---

## Task 2: Command validation

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command tests**

```ts
test("passes heatmap fields when --chart heatmap and --color are provided", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.csv",
      "--chart",
      "heatmap",
      "--x",
      "predicted",
      "--y",
      "actual",
      "--color",
      "count",
      "--spec-out",
      specOutputPath,
    ],
    {
      infer: async (request) => {
        calls.inferCalls.push(request);
        return createInferResult("../results.csv");
      },
      writeSpec: async () => {
        calls.writeSpecCalls += 1;
      },
    },
  );

  expect(calls.inferCalls).toEqual([
    {
      inputPath: "results.csv",
      chart: "heatmap",
      xField: "predicted",
      yField: "actual",
      colorField: "count",
      specOutputPath,
    },
  ]);
});

test("rejects heatmap without --color", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");

  await expect(
    runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "heatmap",
        "--x",
        "predicted",
        "--y",
        "actual",
        "--spec-out",
        specOutputPath,
      ],
    ),
  ).rejects.toThrow(
    'The "--color" option is required when --chart heatmap is used.',
  );
});

test("rejects heatmap when --x and --y are the same field", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");

  await expect(
    runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "heatmap",
        "--x",
        "field",
        "--y",
        "field",
        "--color",
        "count",
        "--spec-out",
        specOutputPath,
      ],
    ),
  ).rejects.toThrow("Heatmap requires distinct --x, --y, and --color fields.");
});

test("rejects heatmap when --facet matches --x", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");

  await expect(
    runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "heatmap",
        "--x",
        "field",
        "--y",
        "actual",
        "--color",
        "count",
        "--facet",
        "field",
        "--spec-out",
        specOutputPath,
      ],
    ),
  ).rejects.toThrow(
    'The "--facet" field must differ from --x, --y, and --color on heatmap charts.',
  );
});
```

- [ ] **Step 2: Run command tests to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

- [ ] **Step 3: Implement command validation**

Update help:

```ts
.option("--chart <type>", "chart type: line, bar, scatter, area, or heatmap")
```

In `parseInferChartType`, accept `heatmap`.

Add helper and call from `normalizeInferOptions()` after parsing chart:

```ts
function validateHeatmapOptions(
  chart: InferChartType,
  options: InferCommandOptions,
): void {
  if (chart !== "heatmap") {
    return;
  }

  if (options.color === undefined) {
    throw new VegaPaperError(
      'The "--color" option is required when --chart heatmap is used.',
    );
  }

  const x = requireOption(options.x, "--x <field>");
  const y = requireOption(options.y, "--y <field>");
  const color = options.color;

  if (x === y || x === color || y === color) {
    throw new VegaPaperError(
      "Heatmap requires distinct --x, --y, and --color fields.",
    );
  }

  if (options.facet !== undefined) {
    if (
      options.facet === x ||
      options.facet === y ||
      options.facet === color
    ) {
      throw new VegaPaperError(
        'The "--facet" field must differ from --x, --y, and --color on heatmap charts.',
      );
    }
  }
}
```

Call `validateHeatmapOptions(chart, options)` inside `normalizeInferOptions()` before building the return object.

- [ ] **Step 4: Run all infer tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts test/infer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: validate heatmap options in infer command"
```

---

## Task 3: Final verification

- [ ] **Step 1: Full workspace checks**

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 2: Smoke**

```bash
printf '%s\n' 'predicted,actual,count' 'a,a,10' 'a,b,2' 'b,a,1' > /tmp/heatmap-smoke.csv
vega-paper infer /tmp/heatmap-smoke.csv \
  --chart heatmap --x predicted --y actual --color count \
  --spec-out /tmp/heatmap-smoke.vl.json
grep -q '"mark": "rect"' /tmp/heatmap-smoke.vl.json && echo SMOKE_HEATMAP=ok
```

Expected: `SMOKE_HEATMAP=ok`.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `--chart heatmap` + `mark: rect` | Task 1 |
| Required `--color` as cell value | Task 1–2 |
| Default ordinal x/y, quantitative color | Task 1 |
| Distinct x/y/color | Task 2 |
| Heatmap facet field validation | Task 2 |
| Unsupported chart message | Task 1 |
