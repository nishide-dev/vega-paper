# Infer Area Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--chart area` to `vega-paper infer` with `mark: { type: "area", line: true }` and the same encoding model as line charts.

**Architecture:** Extend `InferChartType` and `MARK_BY_CHART` in core infer; update chart validation in command layer. No encoding or data-loading changes.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-area-chart-design.md](../specs/2026-06-04-vega-paper-infer-area-chart-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | Add `area` to types, `MARK_BY_CHART`, `parseChartType` |
| `packages/cli/src/commands/infer.ts` | Update `--chart` help and `parseInferChartType` |
| `packages/cli/test/infer.test.ts` | Add area mark test; update unsupported-chart expectation |
| `packages/cli/test/infer-command.test.ts` | Add `--chart area` passthrough test |

---

## Task 1: Core area chart support

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing core tests**

Add inside `describe("inferVegaLiteSpec", ...)`:

```ts
test("maps area chart to an area mark with line overlay", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");

  await Bun.write(inputPath, "epoch,loss\n1,0.9\n2,0.7\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "area",
    xField: "epoch",
    yField: "loss",
    specOutputPath: join(workspace, "chart.vl.json"),
  });

  expect(result.spec).toMatchObject({
    mark: { type: "area", line: true },
    encoding: {
      x: { field: "epoch", type: "quantitative" },
      y: { field: "loss", type: "quantitative" },
    },
  });
});
```

Update the existing `"rejects unsupported chart types"` test expected message to:

```ts
).rejects.toThrow(
  'Unsupported chart type "area". Expected one of: line, bar, scatter, area.',
);
```

Change the invalid chart from `"area"` to `"heatmap"` (since area becomes valid):

```ts
const invalidChart = "heatmap" as unknown as InferRequest["chart"];
```

And expected message:

```ts
'Unsupported chart type "heatmap". Expected one of: line, bar, scatter, area.',
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: area mark test fails; unsupported-chart test fails until implementation.

- [ ] **Step 3: Implement core changes**

In `packages/cli/src/core/infer.ts`:

```ts
export type InferChartType = "line" | "bar" | "scatter" | "area";

type InferMark = "line" | "bar" | "point" | { type: "area"; line: true };

const MARK_BY_CHART: Record<InferChartType, InferMark> = {
  line: "line",
  bar: "bar",
  scatter: "point",
  area: { type: "area", line: true },
};
```

Update `parseChartType`:

```ts
function parseChartType(chart: string): InferChartType {
  if (chart === "line" || chart === "bar" || chart === "scatter" || chart === "area") {
    return chart;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${chart}". Expected one of: line, bar, scatter, area.`,
  );
}
```

- [ ] **Step 4: Run core tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: add area chart type to infer core"
```

---

## Task 2: Command layer

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command test**

```ts
test("passes area chart type through to InferRequest", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");
  const calls = createSpies();

  await runInferCommand(
    [
      "infer",
      "results.csv",
      "--chart",
      "area",
      "--x",
      "epoch",
      "--y",
      "loss",
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
      chart: "area",
      xField: "epoch",
      yField: "loss",
      specOutputPath,
    },
  ]);
});
```

- [ ] **Step 2: Run command test to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

- [ ] **Step 3: Update command validation and help**

In `packages/cli/src/commands/infer.ts`:

```ts
.option("--chart <type>", "chart type: line, bar, scatter, or area")
```

```ts
function parseInferChartType(chart: string | undefined): InferChartType {
  const value = requireOption(chart, "--chart <type>");

  if (value === "line" || value === "bar" || value === "scatter" || value === "area") {
    return value;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${value}". Expected one of: line, bar, scatter, area.`,
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts test/infer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: accept --chart area in infer command"
```

---

## Task 3: Final verification

- [ ] **Step 1: Run full workspace checks**

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 2: Smoke**

```bash
vega-paper infer examples/training-curve/data.csv \
  --chart area --x year --y value --spec-out /tmp/area-smoke.vl.json
grep -q '"type": "area"' /tmp/area-smoke.vl.json && grep -q '"line": true' /tmp/area-smoke.vl.json && echo SMOKE_AREA=ok
```

Expected: `SMOKE_AREA=ok`.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `--chart area` | Task 1–2 |
| `mark: { type: "area", line: true }` | Task 1 |
| Same encoding as line | Task 1 test |
| Updated error messages | Task 1–2 |
| Command help text | Task 2 |
