# VegaPaper Infer Lint Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional lint gating to `vega-paper infer` so saved generated specs can be checked before rendering, with existing lint output and exit semantics.

**Architecture:** Extend `packages/cli/src/commands/infer.ts` to parse `--lint-profile` and `--strict`, run lint on the saved spec artifact, and stop before render when lint fails. Reuse the existing lint command’s exit-code and human-output behavior with the smallest possible shared command-layer extraction.

**Tech Stack:** Bun, TypeScript, Commander, existing `lintSpec()` core, Bun test.

---

## File Structure

- Modify: `packages/cli/src/commands/infer.ts`
  - Add infer command lint options, validation, optional lint execution, and render gating.
- Modify: `packages/cli/src/commands/lint.ts`
  - Export the human formatter if needed so `infer` can reuse the exact output shape.
- Modify: `packages/cli/test/infer-command.test.ts`
  - Add failing command tests for lint orchestration and validation.

This slice should stay command-layer only. Do not add a new pipeline module unless a truly unavoidable boundary problem appears during implementation.

## Task 1: Add Failing Infer Command Lint Tests

**Files:**
- Modify: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Add the lint harness types and failing tests**

Update `InferCommandHarness` and add these tests to `packages/cli/test/infer-command.test.ts`:

```ts
import type { LintResult } from "../src/core/lint";
```

```ts
  test("runs lint on the saved spec path before rendering", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
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
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        lint: async (inputPath, profileName) => {
          calls.lintCalls.push({ inputPath, profileName });
          return cleanLintResult();
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.lintCalls).toEqual([
      { inputPath: specOutputPath, profileName: "paper" },
    ]);
    expect(calls.renderCalls).toHaveLength(1);
  });

  test("stops before render when lint returns an error", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
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
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () =>
          createLintResult([
            {
              severity: "error",
              ruleId: "size-out-of-range",
              path: "$.width",
              message: "Width is too large.",
            },
          ]),
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.renderCalls).toEqual([]);
  });

  test("treats warnings as blocking only in strict mode", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const warningResult = createLintResult([
      {
        severity: "warning",
        ruleId: "axis-title-missing",
        path: "$.encoding.x",
        message: "Axis title is missing.",
      },
    ]);

    const strictCalls = createSpies();
    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--strict",
        "--out",
        outputPath,
      ],
      {
        ...strictCalls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () => warningResult,
        render: async (request) => {
          strictCalls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(strictCalls.renderCalls).toEqual([]);

    const nonStrictCalls = createSpies();
    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...nonStrictCalls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () => warningResult,
        render: async (request) => {
          nonStrictCalls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(nonStrictCalls.renderCalls).toHaveLength(1);
  });

  test("rejects --strict without --lint-profile", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--strict",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(
      new VegaPaperError('The "--strict" option requires "--lint-profile <name>".'),
    );
  });

  test("prints the same lint summary output when issues are present", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");

    const output = await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        infer: async () => createInferResult("../results.csv"),
        lint: async () =>
          createLintResult([
            {
              severity: "warning",
              ruleId: "axis-title-missing",
              path: "$.encoding.x",
              message: "Axis title is missing.",
            },
          ]),
      },
    );

    expect(output.stdout).toContain("1 warning, 0 errors");
    expect(output.stdout).toContain("axis-title-missing");
  });
```

Extend the harness and spies:

```ts
  lint?: (
    inputPath: string,
    profileName: string | undefined,
  ) => Promise<LintResult>;
```

```ts
  lintCalls?: Array<{ inputPath: string; profileName: string | undefined }>;
```

```ts
function createSpies(): {
  inferCalls: Array<Record<string, unknown>>;
  lintCalls: Array<{ inputPath: string; profileName: string | undefined }>;
  renderCalls: Array<Record<string, unknown>>;
} {
  return {
    inferCalls: [],
    lintCalls: [],
    renderCalls: [],
  };
}
```

Add local helpers:

```ts
function cleanLintResult(): LintResult {
  return createLintResult([]);
}
```

- [ ] **Step 2: Run the focused infer command tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer-command.test.ts
```

Expected: FAIL because `registerInferCommand()` does not accept lint injection, does not parse `--lint-profile`, and does not stop before render on lint failure.

- [ ] **Step 3: Commit the red test state only if your workflow requires it**

Do not commit failing tests unless your local workflow explicitly wants a red-test checkpoint commit. In the normal flow, continue directly to implementation.

## Task 2: Implement Infer Lint Orchestration

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Modify: `packages/cli/src/commands/lint.ts`

- [ ] **Step 1: Export the lint human formatter for command reuse**

Update `packages/cli/src/commands/lint.ts`:

```ts
export function formatHumanLintResult(result: LintResult): string {
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
```

Leave `getLintExitCode()` exported as-is.

- [ ] **Step 2: Add lint options and injected lint runner to infer**

Update imports in `packages/cli/src/commands/infer.ts`:

```ts
import { lintSpec, type LintResult } from "../core/lint";
import { getLintProfile } from "../core/lint-profiles";
import { formatHumanLintResult, getLintExitCode } from "./lint";
```

Extend `InferCommandOptions`:

```ts
  lintProfile?: string;
  strict?: boolean;
```

Add a lint runner type:

```ts
type RunLint = (
  inputPath: string,
  profileName: string | undefined,
) => Promise<LintResult>;
```

Extend the command registration signature:

```ts
export function registerInferCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runInfer: RunInfer = inferVegaLiteSpec,
  runRender: RunRender = renderChart,
  writeSpec: WriteSpec = writeSpecFile,
  runLint: RunLint = (inputPath, profileName) =>
    lintSpec({ inputPath, profileName }),
): void {
```

Add CLI options:

```ts
    .option("--lint-profile <name>", "lint profile: paper, web, or acl")
    .option("--strict", "exit with code 1 when warnings are present")
```

- [ ] **Step 3: Add infer option validation for strict mode**

In `normalizeInferOptions()` or a nearby validation helper, add:

```ts
  if (options.strict && options.lintProfile === undefined) {
    throw new VegaPaperError(
      'The "--strict" option requires "--lint-profile <name>".',
    );
  }
```

Keep this command-layer validation near the existing `theme`/`out` validation so the option contract stays readable in one place.

- [ ] **Step 4: Validate the lint profile before execution**

In the `.action(...)` body, before running lint:

```ts
      if (options.lintProfile !== undefined) {
        getLintProfile(options.lintProfile);
      }
```

This preserves the existing unknown-profile CLI behavior.

- [ ] **Step 5: Run lint after spec write and before render**

Insert this block after the `Wrote ...` output and before the render branch:

```ts
      if (options.lintProfile !== undefined) {
        const lintResult = await runLint(
          request.specOutputPath,
          options.lintProfile,
        );
        const lintExitCode = getLintExitCode(lintResult, Boolean(options.strict));

        if (lintResult.issues.length === 0) {
          writeOutput("No lint issues found.\n");
        } else {
          writeOutput(formatHumanLintResult(lintResult));
        }

        if (lintExitCode !== 0) {
          return;
        }
      }
```

Important: lint failure stops the command before render, but does not throw. This keeps the saved spec on disk and mirrors lint-command reporting behavior.

- [ ] **Step 6: Introduce an infer command exit-code hook so lint failure can fail the process**

Add a setter type:

```ts
type SetExitCode = (exitCode: 0 | 1) => void;
```

Extend the command registration signature:

```ts
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
```

Then update the lint block:

```ts
        if (lintExitCode !== 0) {
          setExitCode(lintExitCode);
          return;
        }
```

This keeps `infer` aligned with the `lint` command’s non-throwing failure path.

- [ ] **Step 7: Run the focused infer command tests to verify green**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/infer-command.test.ts
```

Expected: PASS, including the new lint orchestration tests.

- [ ] **Step 8: Commit the lint integration implementation**

```bash
git add packages/cli/src/commands/infer.ts packages/cli/src/commands/lint.ts packages/cli/test/infer-command.test.ts
git commit -m "feat: add infer lint gating"
```

## Task 3: Full Verification

**Files:**
- No new file changes expected

- [ ] **Step 1: Run the full test suite**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
```

Expected: PASS with 0 failures.

- [ ] **Step 2: Run typecheck**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run build**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: exit code 0.

- [ ] **Step 4: Run an infer smoke test with lint pass**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run packages/cli/src/index.ts infer \
  examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --lint-profile web \
  --out /private/tmp/vega-paper-infer-lint-pass.svg
```

Expected:

- spec file is written next to the SVG as `/private/tmp/vega-paper-infer-lint-pass.vl.json`
- lint output is printed
- render completes

- [ ] **Step 5: Run an infer smoke test with lint failure blocking render**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run packages/cli/src/index.ts infer \
  examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --lint-profile paper \
  --strict \
  --out /private/tmp/vega-paper-infer-lint-fail.svg
```

Expected:

- generated spec file is still written
- lint output is printed
- render is skipped
- command exits non-zero if warnings or errors are present under the chosen thresholds

- [ ] **Step 6: Run the strict-without-profile validation smoke test**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run packages/cli/src/index.ts infer \
  examples/training-curve/data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --strict \
  --spec-out /private/tmp/vega-paper-infer-lint-strict-only.vl.json
```

Expected:

- command prints `vega-paper: The "--strict" option requires "--lint-profile <name>".`
- command exits non-zero

- [ ] **Step 7: Commit any final verification-driven cleanup**

If the verification steps required tiny follow-up fixes, commit them before finishing:

```bash
git add packages/cli/src/commands/infer.ts packages/cli/src/commands/lint.ts packages/cli/test/infer-command.test.ts
git commit -m "fix: polish infer lint integration"
```

If no cleanup was needed, do not create an extra commit.

## Self-Review

Spec coverage check:

- `--lint-profile` support: Task 2
- `--strict` support: Task 2
- saved-spec lint target: Task 1 + Task 2
- lint output reuse: Task 2
- render blocked on lint failure: Task 2
- generated spec preserved on failure: Task 2 + Task 3 smoke checks
- regression safety: Task 1 + Task 3

Placeholder scan:

- No `TODO`, `TBD`, or vague “handle appropriately” steps remain.

Type consistency:

- `lintProfile`, `strict`, `RunLint`, `SetExitCode`, `getLintExitCode`, and `formatHumanLintResult` are used consistently across tasks.
