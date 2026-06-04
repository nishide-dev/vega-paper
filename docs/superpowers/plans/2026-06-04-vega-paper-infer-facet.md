# Infer Facet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `--facet <field>` to `vega-paper infer`, wrapping generated unit specs in a top-level Vega-Lite facet composition.

**Architecture:** Build the existing inner unit spec first, then wrap it with `{ data, facet, spec }` when `facetField` is set. Command layer validates facet/color field collision.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-facet-design.md](../specs/2026-06-04-vega-paper-infer-facet-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | Add `facetField` to `InferRequest`; wrap inner spec when facet set |
| `packages/cli/src/commands/infer.ts` | Register `--facet`; validate facet/color collision |
| `packages/cli/test/infer.test.ts` | Facet structure, collision, missing field tests |
| `packages/cli/test/infer-command.test.ts` | Passthrough and validation tests |

---

## Task 1: Core facet wrapping

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing core tests**

Add inside `describe("inferVegaLiteSpec", ...)`:

```ts
test("wraps spec in top-level facet when facetField is set", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "epoch,f1,model\n1,0.61,a\n2,0.68,a\n1,0.64,b\n2,0.71,b\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "epoch",
    yField: "f1",
    facetField: "model",
    specOutputPath,
  });

  expect(result.spec).toEqual({
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    facet: { field: "model", type: "nominal" },
    spec: {
      mark: "line",
      width: 360,
      height: 240,
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "f1", type: "quantitative" },
      },
    },
  });
});

test("supports facet with a distinct color field", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");
  const specOutputPath = join(workspace, "chart.vl.json");

  await Bun.write(inputPath, "epoch,f1,split,series\n1,0.61,a,x\n2,0.68,a,x\n");

  const result = await inferVegaLiteSpec({
    inputPath,
    chart: "line",
    xField: "epoch",
    yField: "f1",
    facetField: "split",
    colorField: "series",
    specOutputPath,
  });

  expect(result.spec).toMatchObject({
    facet: { field: "split", type: "nominal" },
    spec: {
      encoding: {
        color: { field: "series", type: "nominal" },
      },
    },
  });
});

test("rejects missing facet fields", async () => {
  const workspace = await createWorkspace();
  const inputPath = join(workspace, "data.csv");

  await Bun.write(inputPath, "epoch,f1\n1,0.61\n");

  await expect(
    inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      facetField: "missing-facet",
      specOutputPath: join(workspace, "chart.vl.json"),
    }),
  ).rejects.toThrow('Field "missing-facet" was not found.');
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

- [ ] **Step 3: Implement core facet wrapping**

Extend `InferRequest`:

```ts
facetField?: string | undefined;
```

Refactor the spec builder in `inferVegaLiteSpec()`:

```ts
if (request.facetField !== undefined) {
  findFieldIndex(tabular.header, request.facetField);
}

const innerSpec: JsonObject = {
  mark: MARK_BY_CHART[chart],
  width: request.width ?? DEFAULT_WIDTH,
  height: request.height ?? DEFAULT_HEIGHT,
  encoding,
};

const spec: JsonObject = request.facetField === undefined
  ? {
      $schema: VEGA_LITE_SCHEMA,
      data,
      ...innerSpec,
    }
  : {
      $schema: VEGA_LITE_SCHEMA,
      data,
      facet: {
        field: request.facetField,
        type: "nominal",
      },
      spec: innerSpec,
    };

if (request.title !== undefined) {
  spec.title = request.title;
}
```

Move facet field index lookup with other field lookups if preferred; validation must happen before returning.

- [ ] **Step 4: Run core tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer.test.ts
```

Expected: all PASS; existing flat-spec tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "feat: wrap infer specs in top-level facet when requested"
```

---

## Task 2: Command `--facet`

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command tests**

```ts
test("passes facetField when --facet is provided", async () => {
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
      "--facet",
      "model",
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
      chart: "line",
      xField: "epoch",
      yField: "f1",
      facetField: "model",
      specOutputPath,
    },
  ]);
});

test("rejects --facet and --color on the same field", async () => {
  const workspace = await createWorkspace();
  const specOutputPath = join(workspace, "chart.vl.json");

  await expect(
    runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "f1",
        "--facet",
        "model",
        "--color",
        "model",
        "--spec-out",
        specOutputPath,
      ],
    ),
  ).rejects.toThrow(
    'The "--facet" and "--color" options must use different fields.',
  );
});
```

- [ ] **Step 2: Run command tests to verify failure**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts
```

- [ ] **Step 3: Register option and validation**

In `commands/infer.ts`:

```ts
.option("--facet <field>", "split chart into small multiples by field")
```

```ts
facetField?: string;
```

In `normalizeInferOptions()` before return:

```ts
if (
  options.facet !== undefined &&
  options.color !== undefined &&
  options.facet === options.color
) {
  throw new VegaPaperError(
    'The "--facet" and "--color" options must use different fields.',
  );
}
```

Return object:

```ts
facetField: options.facet,
```

- [ ] **Step 4: Run tests**

```bash
cd packages/cli && PATH="$HOME/.bun/bin:$PATH" bun test test/infer-command.test.ts test/infer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: add --facet option to infer command"
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
  --chart line --x epoch --y f1 --facet model \
  --spec-out /tmp/facet-smoke.vl.json
grep -q '"facet"' /tmp/facet-smoke.vl.json && grep -q '"spec"' /tmp/facet-smoke.vl.json && echo SMOKE_FACET=ok
```

Expected: `SMOKE_FACET=ok`.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Optional `--facet` | Task 2 |
| Top-level facet + inner spec | Task 1 |
| Facet type nominal | Task 1 |
| Outer data/title, inner mark/encoding/size | Task 1 |
| Facet/color collision error | Task 2 |
| Missing facet field error | Task 1 |
| Flat spec unchanged without facet | Task 1 regression |
