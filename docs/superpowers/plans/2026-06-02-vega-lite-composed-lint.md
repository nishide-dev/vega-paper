# Vega-Lite Composed Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `vega-paper lint` so Vega-Lite unit-level rules also inspect common composed specs such as `layer`, `facet`, `repeat`, and concatenation.

**Architecture:** Add a pure traversal helper in `packages/cli/src/core/lint-rules.ts` that collects Vega-Lite unit specs with their source JSON paths. Keep root/global rules unchanged, and update only selected unit-level rules to iterate over collected units while preserving stable issue paths.

**Tech Stack:** Bun, TypeScript, Bun test, existing VegaPaper CLI lint core.

---

## File Structure

- Modify `packages/cli/src/core/lint-rules.ts`
  - Add an internal `VegaLiteUnitSpec` type.
  - Add `collectVegaLiteUnitSpecs(rootSpec)` and small path/composition helpers.
  - Update `axis-title-missing`, `legend-too-many-categories`, and `bar-y-axis-zero-missing` to run on collected unit specs.
  - Leave root/global rules on the root spec only.
- Modify `packages/cli/test/lint.test.ts`
  - Add focused rule tests for composed Vega-Lite specs and malformed composition fields.

## Task 1: Add Vega-Lite Unit Traversal for Axis Titles

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing traversal tests for axis titles**

Append these tests inside the existing `describe("runLintRules", () => { ... })` block in `packages/cli/test/lint.test.ts`, before the Vega-spec skip test:

```ts
  test("warns for missing axis titles inside layered Vega-Lite specs", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: [
          { epoch: 1, accuracy: 0.62, loss: 0.41 },
          { epoch: 2, accuracy: 0.68, loss: 0.36 },
        ],
      },
      layer: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative" },
            y: { field: "accuracy", type: "quantitative" },
          },
        },
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "loss", type: "quantitative" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual([
      "$.layer[0].encoding.x",
      "$.layer[0].encoding.y",
      "$.layer[1].encoding.y",
    ]);
  });

  test("warns for missing axis titles inside facet and repeat specs", () => {
    const facetSpec = cleanVegaLiteSpec({
      facet: { field: "model", type: "nominal" },
      spec: {
        mark: "point",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
        },
      },
    });
    delete facetSpec.mark;
    delete facetSpec.encoding;

    const repeatSpec = cleanVegaLiteSpec({
      repeat: ["accuracy", "loss"],
      spec: {
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative", title: "Epoch" },
          y: { field: "accuracy", type: "quantitative" },
        },
      },
    });
    delete repeatSpec.mark;
    delete repeatSpec.encoding;

    expect(
      runRules(facetSpec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.spec.encoding.x"]);
    expect(
      runRules(repeatSpec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.spec.encoding.y"]);
  });

  test("warns for missing axis titles inside concat specs", () => {
    const spec = cleanVegaLiteSpec({
      concat: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
      hconcat: [
        {
          mark: "point",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative" },
          },
        },
      ],
      vconcat: [
        {
          mark: "bar",
          encoding: {
            x: { field: "epoch", type: "ordinal" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual([
      "$.concat[0].encoding.x",
      "$.hconcat[0].encoding.y",
      "$.vconcat[0].encoding.x",
    ]);
  });

  test("recurses through nested composed Vega-Lite specs", () => {
    const spec = cleanVegaLiteSpec({
      layer: [
        {
          facet: { field: "model", type: "nominal" },
          spec: {
            mark: "point",
            encoding: {
              x: { field: "epoch", type: "quantitative" },
              y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
            },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.layer[0].spec.encoding.x"]);
  });

  test("ignores malformed composition fields without throwing", () => {
    const spec = cleanVegaLiteSpec({
      layer: { not: "an array" },
      facet: { spec: "not an object" },
      repeat: { spec: null },
      concat: ["not an object"],
      hconcat: [null],
      vconcat: [{ mark: "point" }],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(runRules(spec)).toEqual([]);
  });
```

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL. The new tests should fail because current axis-title logic only checks top-level `$.encoding`.

- [ ] **Step 3: Add traversal helper and update axis-title rule**

Modify `packages/cli/src/core/lint-rules.ts`.

Add this type near `LintRule`:

```ts
type VegaLiteUnitSpec = {
  spec: JsonObject;
  path: string;
};
```

Replace `checkAxisTitles` with:

```ts
function checkAxisTitles({ spec, specType }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    const encoding = getObject(unit.spec, "encoding");

    for (const channelName of ["x", "y"] as const) {
      const channel = encoding ? getObject(encoding, channelName) : undefined;

      if (!channel || typeof channel.field !== "string") {
        continue;
      }

      if (hasExplicitTitle(channel)) {
        continue;
      }

      issues.push({
        severity: "warning",
        ruleId: "axis-title-missing",
        path: joinJsonPath(unit.path, `encoding.${channelName}`),
        message: `${channelName.toUpperCase()} axis is missing a title.`,
        suggestion: `Add encoding.${channelName}.title.`,
      });
    }
  }

  return issues;
}
```

Add these helpers near the existing helper functions:

```ts
function collectVegaLiteUnitSpecs(rootSpec: JsonObject): VegaLiteUnitSpec[] {
  const units: VegaLiteUnitSpec[] = [];
  const visit = (spec: JsonObject, path: string) => {
    if (isVegaLiteUnitSpec(spec)) {
      units.push({ spec, path });
    }

    visitArrayChildren(spec, "layer", path, visit);
    visitObjectChild(spec, "spec", path, visit);
    visitArrayChildren(spec, "concat", path, visit);
    visitArrayChildren(spec, "hconcat", path, visit);
    visitArrayChildren(spec, "vconcat", path, visit);
  };

  visit(rootSpec, "$");
  return units;
}

function visitArrayChildren(
  spec: JsonObject,
  key: string,
  parentPath: string,
  visit: (spec: JsonObject, path: string) => void,
): void {
  const value = spec[key];

  if (!Array.isArray(value)) {
    return;
  }

  for (const [index, child] of value.entries()) {
    if (isPlainObject(child)) {
      visit(child, `${parentPath}.${key}[${index}]`);
    }
  }
}

function visitObjectChild(
  spec: JsonObject,
  key: string,
  parentPath: string,
  visit: (spec: JsonObject, path: string) => void,
): void {
  const child = getObject(spec, key);

  if (child) {
    visit(child, joinJsonPath(parentPath, key));
  }
}

function isVegaLiteUnitSpec(spec: JsonObject): boolean {
  return isPlainObject(spec.encoding) || spec.mark !== undefined;
}

function joinJsonPath(parentPath: string, childPath: string): string {
  return parentPath === "$" ? `$.${childPath}` : `${parentPath}.${childPath}`;
}
```

Note: visiting `spec` generically is intentional for both faceted and repeated specs. It may also visit other valid composition objects that use a `spec` child; this is acceptable for this slice because traversal only lint-checks unit-looking child specs.

- [ ] **Step 4: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: all lint tests pass and typecheck passes.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint.test.ts
git commit -m "feat: traverse composed specs for axis lint"
```

## Task 2: Apply Composed Traversal to Legend Categories

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing tests for composed legend categories**

Append these tests inside `describe("runLintRules", () => { ... })`, near the existing legend category test:

```ts
  test("warns when layered color encoding has too many categories from root data", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `model-${index}`,
        })),
      },
      layer: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
            color: { field: "model", type: "nominal", title: "Model" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: "$.layer[0].encoding.color",
      message: 'Color field "model" has 13 categories.',
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  });

  test("prefers child inline data for composed legend category counts", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `root-${index}`,
        })),
      },
      layer: [
        {
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
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec).filter(
        (issue) => issue.ruleId === "legend-too-many-categories",
      ),
    ).toEqual([]);
  });
```

- [ ] **Step 2: Run focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL. The first new legend test should fail because current legend logic only checks top-level `encoding.color`.

- [ ] **Step 3: Update legend category rule to use collected unit specs**

Replace `checkLegendCategoryCount` in `packages/cli/src/core/lint-rules.ts` with:

```ts
function checkLegendCategoryCount({
  spec,
  specType,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    const encoding = getObject(unit.spec, "encoding");
    const color = encoding ? getObject(encoding, "color") : undefined;
    const field = typeof color?.field === "string" ? color.field : undefined;
    const values = getInlineDataValues(unit.spec) ?? rootValues;

    if (!field || !values) {
      continue;
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
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: joinJsonPath(unit.path, "encoding.color"),
      message: `Color field "${field}" has ${categories.size} categories.`,
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  }

  return issues;
}
```

- [ ] **Step 4: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: all lint tests pass and typecheck passes.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint.test.ts
git commit -m "feat: lint composed legend categories"
```

## Task 3: Apply Composed Traversal to Bar Y-Axis Zero

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing tests for composed bar zero checks**

Append these tests inside `describe("runLintRules", () => { ... })`, near the existing bar zero test:

```ts
  test("warns when layered bar chart quantitative y omits explicit zero", () => {
    const spec = cleanVegaLiteSpec({
      layer: [
        {
          mark: "bar",
          encoding: {
            x: { field: "epoch", type: "ordinal", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: "$.layer[0].encoding.y.scale",
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    });
  });

  test("does not infer parent bar marks for composed bar zero checks", () => {
    const spec = cleanVegaLiteSpec({
      mark: "bar",
      layer: [
        {
          encoding: {
            x: { field: "epoch", type: "ordinal", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
    });
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "bar-y-axis-zero-missing")
        .map((issue) => issue.path),
    ).toEqual([]);
  });
```

The second test documents the current slice's explicit non-goal: child mark inheritance is not inferred. The root has `mark: "bar"` but no root `encoding`, so it also does not warn.

- [ ] **Step 2: Run focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL. The layered bar warning should still point only at the root or be missing because current bar-zero logic does not iterate collected units.

- [ ] **Step 3: Update bar y-axis zero rule to use collected unit specs**

Replace `checkBarYAxisZero` in `packages/cli/src/core/lint-rules.ts` with:

```ts
function checkBarYAxisZero({
  spec,
  specType,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (!isBarMark(unit.spec.mark)) {
      continue;
    }

    const encoding = getObject(unit.spec, "encoding");
    const y = encoding ? getObject(encoding, "y") : undefined;

    if (!y || y.type !== "quantitative") {
      continue;
    }

    const scale = getObject(y, "scale");

    if (scale?.zero === true) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: joinJsonPath(unit.path, "encoding.y.scale"),
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    });
  }

  return issues;
}
```

- [ ] **Step 4: Run focused and broad checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint.test.ts
git commit -m "feat: lint composed bar zero rules"
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

- [ ] **Step 2: Run a composed lint smoke command**

Create a temporary layered spec and run `vega-paper lint`:

```bash
tmp_spec="/tmp/vega-paper-layered-lint-$$.vl.json"
printf '%s\n' '{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","data":{"values":[{"x":1,"y":2,"model":"a"},{"x":2,"y":3,"model":"b"}]},"layer":[{"mark":"bar","encoding":{"x":{"field":"x","type":"ordinal"},"y":{"field":"y","type":"quantitative"}}}]}' > "$tmp_spec"
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec"
```

Expected: output includes composed child paths:

```text
$.layer[0].encoding.x
$.layer[0].encoding.y
$.layer[0].encoding.y.scale
```

- [ ] **Step 3: Run JSON smoke and parse it**

```bash
json_output=$(PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --json)
printf '%s' "$json_output" | PATH="$HOME/.bun/bin:$PATH" bun -e 'const chunks=[]; for await (const chunk of Bun.stdin.stream()) chunks.push(chunk); const text=new TextDecoder().decode(Buffer.concat(chunks)); const parsed=JSON.parse(text); const paths=parsed.issues.map((issue)=>issue.path); if (!paths.includes("$.layer[0].encoding.y.scale")) process.exit(2); console.log("PARSED_COMPOSED_PATH=ok");'
```

Expected:

```text
PARSED_COMPOSED_PATH=ok
```

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: clean implementation worktree. In the main checkout, pre-existing untracked `docs/initial-design.md` may remain and must not be committed unless explicitly requested.

- [ ] **Step 5: Commit verification fixes if needed**

If acceptance verification required code changes:

```bash
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint.test.ts
git commit -m "fix: complete composed lint verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: the plan covers `layer`, faceted `spec` children, repeated `spec` children, `concat`, `hconcat`, `vconcat`, recursive traversal, stable paths, unit-rule scope, root data fallback, malformed composition tolerance, and Vega skip behavior.
- Deferred scope remains explicit: no rendered-output lint, no profiles, no markdown reports, no suppressions, no auto-fix, no broad Vega traversal, and no non-data inheritance inference.
- Type consistency: `VegaLiteUnitSpec`, `collectVegaLiteUnitSpecs`, `joinJsonPath`, and updated rule functions are introduced before later tasks use them.
