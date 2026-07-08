# ML-Aware Linting (Phase E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--domain ml` opt-in to `vega-paper lint` that enables four ML-paper figure rules (`ml-panel-label-missing`, `ml-crowded-labels`, `ml-too-many-series`, `ml-log-scale-candidate`), including CSV data loading that resolves `data.url` relative to the spec file.

**Architecture:** ML rules join the existing pure-function `LintRule` pipeline in `packages/cli/src/core/lint-rules.ts` and only run when `LintRuleContext.domain === "ml"`. A new `core/lint-data.ts` loads root `data.url` CSV rows (reusing `parseCsv` from `core/infer.ts`) into `LintRuleContext.externalDataRows`; data-dependent rules silently skip when rows are unavailable. Thresholds live on `LintProfile` like every existing threshold.

**Tech Stack:** Bun 1.3.14 workspace, TypeScript, commander, `bun:test`, biome.

**Spec:** [docs/vega-paper-ml-conference-figures-spec.md](../../vega-paper-ml-conference-figures-spec.md) — sections 10.1, 10.2, 10.3, and 12 Phase E.

## Global Constraints

- Phases A–D land **before** this plan. The example fixtures they create (`examples/ablation-bar/`, `examples/benchmark-heatmap/`, `examples/run-distribution/`, `examples/pareto-frontier/`, `examples/scaling-law/`, `examples/calibration-curve/`, `examples/multipanel-paper-figure/`) are assumed to exist and are used as integration-test fixtures in Task 9. If a fixture path is missing at execution time, stop and report — do not invent fixtures.
- Default lint behavior MUST be unchanged when `--domain ml` is not passed: same rules, same output, same exit codes. Existing tests in `packages/cli/test/lint.test.ts` must keep passing without modification.
- All ML rules emit `severity: "warning"` only (spec §10.1: "Proposed warning rules").
- No new lint profile is added (spec §10.2: keep `paper`, `web`, `acl`, `print`; gate ML rules behind `--domain ml`).
- Data loading activates **only** with `--domain ml`. A missing, unreadable, or unparsable data file never produces a lint error — data-dependent rules are skipped (spec §10.3).
- Deferred out of scope (spec §10.3 / §12 Phase E): `ml-missing-uncertainty`, `ml-missing-baseline`, `ml-unordered-ablation`. Do not implement them; only document them as deferred.
- `--domain` is a `lint` command option only. Do not touch `packages/cli/src/commands/infer.ts` (its internal lint call keeps `domain` undefined).
- No new dependencies. Reuse `parseCsv` from `packages/cli/src/core/infer.ts` — do not write a second CSV parser.
- Run `bun test` and `bun run check` (biome) before every commit; commit messages use conventional prefixes (`feat:`, `test:`, `docs:`).
- Match repo code style: double quotes, semicolons, 2-space indent, trailing commas, `function` declarations for rules/helpers (see existing `lint-rules.ts`).

## Design Decisions Locked In (spec ambiguity resolutions)

1. **Option syntax:** spec §10.2 offers `--lint-domain ml` or `--domain ml`; we implement `--domain <name>` on `lint` exactly matching the spec's "Potential syntax" example: `vega-paper lint chart.vl.json --profile paper --domain ml`.
2. **`ml-panel-label-missing` heuristic:** fires per unlabeled panel when the **root-level** `hconcat`, `vconcat`, or `concat` array has ≥ 2 object panels and a panel's title text (via the existing `getTitleText`) does not match `/\([a-z]\)/i`. A missing title counts as unlabeled. Nested compositions are not scanned (multipanel figures put panels at the root).
3. **`ml-crowded-labels` detectability:** fires on a unit whose mark is `text` (string or `{type:"text"}`) with `encoding.text.field` set, when the row count of its resolved data (unit inline `data.values`, else root inline `data.values`, else loaded `data.url` rows) exceeds `profile.mlMaxTextLabels`. Threshold default 20 for `paper`.
4. **`ml-too-many-series`:** counts distinct values of `encoding.color.field` over resolved rows for line/bar/point/circle marks; warns when count > `profile.mlMaxSeries` (default 8 for `paper` and `acl`). Complements `legend-too-many-categories` (which is inline-only and has looser defaults).
5. **`ml-log-scale-candidate` "≥ 3 orders of magnitude":** defined as `max/min > 1000` over the finite, strictly positive numeric values of the quantitative x field (strings are coerced with `Number()` because CSV rows load as strings; non-positive and non-numeric values are ignored; needs ≥ 2 positive values). Skipped when `encoding.x.scale.type === "log"`. Deduplicated by field name per spec so layered `errorband`+`line` specs warn once.
6. **Data resolution scope:** only the **root** `spec.data.url`, only when it ends in `.csv` (case-insensitive) and is not an absolute `scheme://` URL. Relative paths resolve against `dirname(<spec file path>)`. Units with their own non-inline `data` definition never fall back to loaded rows. The spec's alternative `--data` option (§10.3 / Open Question 9) is not implemented.
7. **Profile threshold values:** `mlMaxSeries`: paper 8, web 12, acl 8, print 6 (print mirrors its stricter `maxColorCategories`). `mlMaxTextLabels`: paper 20, web 30, acl 15, print 20.

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/lint-profiles.ts` | Modify: add `mlMaxSeries`, `mlMaxTextLabels` to `LintProfile` |
| `packages/cli/src/core/lint.ts` | Modify: `LintDomain`, `parseLintDomain`, `LintRequest.domain`, data-load wiring |
| `packages/cli/src/core/lint-data.ts` | Create: `loadLintDataRows` |
| `packages/cli/src/core/lint-rules.ts` | Modify: context fields, `mlLintRules`, 4 rules + helpers |
| `packages/cli/src/commands/lint.ts` | Modify: `--domain <name>` option |
| `packages/cli/test/lint-profiles.test.ts` | Modify: new profile fields |
| `packages/cli/test/lint-ml.test.ts` | Create: all ML lint tests |
| `skills/vega-paper/references/paper-style-guide.md` | Modify: ML domain rule documentation |

---

### Task 1: ML thresholds on lint profiles

**Files:**
- Modify: `packages/cli/src/core/lint-profiles.ts`
- Test: `packages/cli/test/lint-profiles.test.ts`

**Interfaces:**
- Consumes: existing `LintProfile` type.
- Produces: `LintProfile` gains `mlMaxSeries: number` and `mlMaxTextLabels: number`. Values: paper `{8, 20}`, web `{12, 30}`, acl `{8, 15}`, print `{6, 20}`. Later tasks read `profile.mlMaxSeries` / `profile.mlMaxTextLabels`.

- [ ] **Step 1: Update the failing profile tests**

In `packages/cli/test/lint-profiles.test.ts`, the four `toEqual` blocks assert the complete profile objects. Add the two new fields to each expected object:

```ts
  test("returns the paper profile thresholds", () => {
    expect(getLintProfile("paper")).toEqual({
      name: "paper",
      titleMaxLength: 90,
      widthRange: { min: 180, max: 720 },
      heightRange: { min: 120, max: 540 },
      maxInlineRows: 500,
      maxColorCategories: 12,
      minFontSize: 8,
      grayscaleSafe: false,
      mlMaxSeries: 8,
      mlMaxTextLabels: 20,
    });
  });
```

Apply the same shape to the other three tests with these values:

```ts
      // web:   mlMaxSeries: 12, mlMaxTextLabels: 30,
      // acl:   mlMaxSeries: 8,  mlMaxTextLabels: 15,
      // print: mlMaxSeries: 6,  mlMaxTextLabels: 20,
```

i.e. append to the `web` expected object:

```ts
      grayscaleSafe: false,
      mlMaxSeries: 12,
      mlMaxTextLabels: 30,
```

to the `acl` expected object:

```ts
      grayscaleSafe: false,
      mlMaxSeries: 8,
      mlMaxTextLabels: 15,
```

to the `print` expected object:

```ts
      grayscaleSafe: true,
      mlMaxSeries: 6,
      mlMaxTextLabels: 20,
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-profiles.test.ts`
Expected: 4 FAIL (`returns the paper/web/acl/print profile thresholds`) — received objects lack `mlMaxSeries` / `mlMaxTextLabels`.

- [ ] **Step 3: Add the fields to `LintProfile` and all four profiles**

In `packages/cli/src/core/lint-profiles.ts`, extend the type:

```ts
export type LintProfile = {
  name: LintProfileName;
  titleMaxLength: number;
  widthRange: { min: number; max: number };
  heightRange: { min: number; max: number };
  maxInlineRows: number;
  maxColorCategories: number;
  minFontSize: number;
  grayscaleSafe: boolean;
  mlMaxSeries: number;
  mlMaxTextLabels: number;
};
```

And add to each entry of `LINT_PROFILES` (after `grayscaleSafe`):

```ts
  paper: {
    // ...existing fields unchanged
    grayscaleSafe: false,
    mlMaxSeries: 8,
    mlMaxTextLabels: 20,
  },
  web: {
    // ...existing fields unchanged
    grayscaleSafe: false,
    mlMaxSeries: 12,
    mlMaxTextLabels: 30,
  },
  acl: {
    // ...existing fields unchanged
    grayscaleSafe: false,
    mlMaxSeries: 8,
    mlMaxTextLabels: 15,
  },
  print: {
    // ...existing fields unchanged
    grayscaleSafe: true,
    mlMaxSeries: 6,
    mlMaxTextLabels: 20,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-profiles.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-profiles.ts packages/cli/test/lint-profiles.test.ts
git commit -m "feat: add ML lint thresholds to lint profiles"
```

---

### Task 2: `--domain ml` plumbing (CLI option, `LintDomain`, context fields)

**Files:**
- Modify: `packages/cli/src/core/lint.ts`
- Modify: `packages/cli/src/core/lint-rules.ts` (context type only)
- Modify: `packages/cli/src/commands/lint.ts`
- Test: `packages/cli/test/lint-ml.test.ts` (new file)

**Interfaces:**
- Consumes: existing `lintSpec`, `registerLintCommand`, `LintRuleContext`.
- Produces:
  - `core/lint.ts`: `export type LintDomain = "ml";`, `export function parseLintDomain(value: string): LintDomain` (throws `VegaPaperError` `Unknown lint domain "<value>". Expected one of: ml.`), `LintRequest` gains `domain?: LintDomain | undefined`.
  - `core/lint-rules.ts`: `LintRuleContext` gains `domain?: LintDomain | undefined` and `externalDataRows?: JsonObject[] | undefined` (always `undefined` until Task 5).
  - `commands/lint.ts`: `--domain <name>` option; `RunLint` becomes `(inputPath: string, profileName: string | undefined, domain: LintDomain | undefined) => Promise<LintResult>` (existing 2-param test runners in `lint.test.ts` remain assignable — do not edit that file).

- [ ] **Step 1: Create `packages/cli/test/lint-ml.test.ts` with helpers and the first failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerLintCommand } from "../src/commands/lint";
import type { LintDomain, LintResult } from "../src/core/lint";
import { lintSpec, parseLintDomain } from "../src/core/lint";
import type { JsonObject } from "../src/core/spec";

describe("parseLintDomain", () => {
  test("accepts ml", () => {
    expect(parseLintDomain("ml")).toBe("ml");
  });

  test("throws a CLI error for unknown domains", () => {
    expect(() => parseLintDomain("web")).toThrow(
      'Unknown lint domain "web". Expected one of: ml.',
    );
  });
});

describe("lint command --domain", () => {
  test("passes domain to the lint runner", async () => {
    let receivedDomain: LintDomain | undefined;

    const output = await runLintCommandWithRunner(
      ["lint", "chart.vl.json", "--profile", "paper", "--domain", "ml"],
      async (_inputPath, _profileName, domain) => {
        receivedDomain = domain;
        return cleanLintResult();
      },
    );

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
    expect(receivedDomain).toBe("ml");
  });

  test("passes undefined domain when --domain is omitted", async () => {
    let receivedDomain: LintDomain | undefined = "ml";

    await runLintCommandWithRunner(["lint", "chart.vl.json"], async (_input, _profile, domain) => {
      receivedDomain = domain;
      return cleanLintResult();
    });

    expect(receivedDomain).toBeUndefined();
  });

  test("propagates unknown domain errors", async () => {
    try {
      await runLintCommandWithRunner(["lint", "chart.vl.json", "--domain", "nlp"], async () =>
        cleanLintResult(),
      );
      throw new Error("Expected command to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Unknown lint domain "nlp". Expected one of: ml.');
    }
  });
});

describe("lintSpec with domain", () => {
  test("domain ml does not change results for a clean single-view spec", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec());

      const defaultResult = await lintSpec({ inputPath });
      const mlResult = await lintSpec({ inputPath, domain: "ml" });

      expect(defaultResult.issues).toEqual([]);
      expect(mlResult).toEqual(defaultResult);
    });
  });
});

// --- helpers -------------------------------------------------------------

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

async function withTemporaryWorkspace(callback: (workspacePath: string) => Promise<void>) {
  const workspacePath = await mkdtemp(join(tmpdir(), "vega-paper-lint-ml-test-"));

  try {
    await callback(workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), "utf8");
}

function cleanLintResult(): LintResult {
  return { ok: true, errorCount: 0, warningCount: 0, issues: [] };
}

async function runLintCommandWithRunner(
  args: string[],
  runLint: (
    inputPath: string,
    profileName: string | undefined,
    domain: LintDomain | undefined,
  ) => Promise<LintResult>,
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
    runLint,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}
```

Note: every import and helper above is used within this task's tests, so `bun run check` (biome `noUnusedImports`) passes at this commit. The `runMlRules`/`mlIssues` rule-test helpers are added in Task 3 (their first use), and the `mkdir` import in Task 5.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: FAIL — `Export named 'parseLintDomain' not found` from `../src/core/lint` (module-level failure), and the `--domain` option is unknown to commander.

- [ ] **Step 3: Implement domain in `core/lint.ts`**

In `packages/cli/src/core/lint.ts`, add after the `LintResult` type:

```ts
export type LintDomain = "ml";

const LINT_DOMAINS: LintDomain[] = ["ml"];

export function parseLintDomain(value: string): LintDomain {
  if ((LINT_DOMAINS as string[]).includes(value)) {
    return value as LintDomain;
  }

  throw new VegaPaperError(
    `Unknown lint domain "${value}". Expected one of: ${LINT_DOMAINS.join(", ")}.`,
  );
}
```

Change `LintRequest` to:

```ts
export type LintRequest = {
  inputPath: string;
  profileName?: string | undefined;
  domain?: LintDomain | undefined;
};
```

And change the final `return` of `lintSpec` to pass the domain through:

```ts
  return createLintResult(
    runLintRules({
      inputPath: request.inputPath,
      spec,
      specType,
      profile,
      domain: request.domain,
    }),
  );
```

- [ ] **Step 4: Extend `LintRuleContext` in `core/lint-rules.ts`**

Change the imports and context type at the top of `packages/cli/src/core/lint-rules.ts`:

```ts
import type { LintDomain, LintIssue } from "./lint";
import type { LintProfile } from "./lint-profiles";
import type { JsonObject, SpecType } from "./spec";

export type LintRuleContext = {
  inputPath: string;
  spec: JsonObject;
  specType: SpecType;
  profile: LintProfile;
  domain?: LintDomain | undefined;
  externalDataRows?: JsonObject[] | undefined;
};
```

(`runLintRules` itself is unchanged in this task.)

- [ ] **Step 5: Add `--domain` to `commands/lint.ts`**

Replace the full contents of `packages/cli/src/commands/lint.ts` with:

```ts
import type { Command } from "commander";
import { formatTable, toPrettyJson } from "../core/format";
import { type LintDomain, type LintResult, lintSpec, parseLintDomain } from "../core/lint";
import { getLintProfile } from "../core/lint-profiles";

type LintOptions = {
  json?: boolean;
  profile?: string;
  strict?: boolean;
  domain?: string;
};

type WriteOutput = (value: string) => void;
type RunLint = (
  inputPath: string,
  profileName: string | undefined,
  domain: LintDomain | undefined,
) => Promise<LintResult>;
type SetExitCode = (exitCode: 0 | 1) => void;

export function registerLintCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runLint: RunLint = (inputPath, profileName, domain) => lintSpec({ inputPath, profileName, domain }),
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
): void {
  program
    .command("lint")
    .argument("<spec>", "Vega or Vega-Lite JSON input path")
    .description("Check a Vega or Vega-Lite spec for paper figure issues")
    .option("--json", "print JSON")
    .option("--profile <name>", "lint profile: paper, web, acl, or print")
    .option("--domain <name>", "lint domain: ml (adds ML paper figure rules)")
    .option("--strict", "exit with code 1 when warnings are present")
    .action(async (inputPath: string, options: LintOptions) => {
      if (options.profile !== undefined) {
        getLintProfile(options.profile);
      }

      const domain = options.domain === undefined ? undefined : parseLintDomain(options.domain);
      const result = await runLint(inputPath, options.profile, domain);
      const exitCode = getLintExitCode(result, Boolean(options.strict));

      if (options.json) {
        writeOutput(toPrettyJson(result));
      } else if (result.issues.length === 0) {
        writeOutput("No lint issues found.\n");
      } else {
        writeOutput(formatHumanLintResult(result));
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

export function formatHumanLintResult(result: LintResult): string {
  const summary = `${formatCount(result.warningCount, "warning")}, ${formatCount(
    result.errorCount,
    "error",
  )}`;
  const table = formatTable({
    headers: ["severity", "rule", "path", "message"],
    rows: result.issues.map((issue) => [issue.severity, issue.ruleId, issue.path, issue.message]),
  });

  return `${summary}\n${table}\n`;
}

function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
```

- [ ] **Step 6: Run tests to verify they pass, including the untouched existing lint tests**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail (existing 2-param test runners in `lint.test.ts` are assignable to the widened 3-param `RunLint` type).

- [ ] **Step 7: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint.ts packages/cli/src/core/lint-rules.ts packages/cli/src/commands/lint.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: add --domain ml option plumbing to lint"
```

---

### Task 3: `ml-panel-label-missing` rule (spec-only)

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: `cleanVegaLiteSpec` helper and context fields (Task 2), existing `getTitleText`, `isPlainObject`.
- Produces: `export const mlLintRules: LintRule[]`; `runLintRules` runs `paperLintRules` plus `mlLintRules` when `context.domain === "ml"`; test helpers `runMlRules` / `mlIssues` in `lint-ml.test.ts` (reused by Tasks 4, 6, 7). Rule id `ml-panel-label-missing`, paths like `$.hconcat[0].title`.

- [ ] **Step 1: Append failing tests to `packages/cli/test/lint-ml.test.ts`**

First add the imports these rule tests need. Extend the existing import block:

```ts
import { getLintProfile, type LintProfileName } from "../src/core/lint-profiles";
import { runLintRules } from "../src/core/lint-rules";
```

Add the shared rule-test helpers directly after the `// --- helpers` comment (before `cleanVegaLiteSpec`):

```ts
function runMlRules(
  spec: JsonObject,
  options: {
    profileName?: LintProfileName;
    domain?: LintDomain;
    externalDataRows?: JsonObject[];
  } = {},
) {
  return runLintRules({
    inputPath: "chart.vl.json",
    spec,
    specType: "vega-lite",
    profile: getLintProfile(options.profileName ?? "paper"),
    domain: options.domain,
    externalDataRows: options.externalDataRows,
  });
}

function mlIssues(issues: ReturnType<typeof runMlRules>, ruleId: string) {
  return issues.filter((issue) => issue.ruleId === ruleId);
}
```

Then insert this `describe` block before the `// --- helpers` comment:

```ts
describe("ml-panel-label-missing", () => {
  test("warns for each unlabeled panel in a 2-panel hconcat", () => {
    const spec = multiPanelSpec("hconcat", ["Training", "Ablation"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([
      {
        severity: "warning",
        ruleId: "ml-panel-label-missing",
        path: "$.hconcat[0].title",
        message: 'Panel 1 in "hconcat" has no "(a)"-style label in its title.',
        suggestion: 'Prefix each panel title with "(a)", "(b)", ... so captions can reference panels.',
      },
      {
        severity: "warning",
        ruleId: "ml-panel-label-missing",
        path: "$.hconcat[1].title",
        message: 'Panel 2 in "hconcat" has no "(a)"-style label in its title.',
        suggestion: 'Prefix each panel title with "(a)", "(b)", ... so captions can reference panels.',
      },
    ]);
  });

  test("accepts panels with (a)-style labels", () => {
    const spec = multiPanelSpec("hconcat", ["(a) Training", "(b) Ablation"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([]);
  });

  test("warns only for the unlabeled panel", () => {
    const spec = multiPanelSpec("vconcat", ["(a) Training", "Ablation"]);

    expect(
      mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing").map(
        (issue) => issue.path,
      ),
    ).toEqual(["$.vconcat[1].title"]);
  });

  test("warns for panels without any title", () => {
    const spec = multiPanelSpec("concat", [undefined, undefined]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toHaveLength(2);
  });

  test("does not warn for a single panel", () => {
    const spec = multiPanelSpec("hconcat", ["Training"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([]);
  });

  test("does not run without domain ml", () => {
    const spec = multiPanelSpec("hconcat", ["Training", "Ablation"]);

    expect(mlIssues(runMlRules(spec), "ml-panel-label-missing")).toEqual([]);
  });
});
```

And add this builder to the helpers section (after `cleanVegaLiteSpec`):

```ts
function multiPanelSpec(
  key: "hconcat" | "vconcat" | "concat",
  titles: (string | undefined)[],
): JsonObject {
  const spec = cleanVegaLiteSpec({
    [key]: titles.map((title) => ({
      ...(title === undefined ? {} : { title }),
      mark: "line",
      encoding: {
        x: { field: "epoch", type: "quantitative", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      },
    })),
  });
  delete spec.mark;
  delete spec.encoding;
  return spec;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: the 4 triggering `ml-panel-label-missing` tests FAIL (received `[]`); the "accepts"/"single panel"/"without domain" tests pass vacuously.

- [ ] **Step 3: Implement the rule and the ML gating in `lint-rules.ts`**

In `packages/cli/src/core/lint-rules.ts`, replace `runLintRules` and add the ML rule list directly below `paperLintRules`:

```ts
export const mlLintRules: LintRule[] = [checkMlPanelLabels];

export function runLintRules(context: LintRuleContext): LintIssue[] {
  const rules = context.domain === "ml" ? [...paperLintRules, ...mlLintRules] : paperLintRules;
  return rules.flatMap((rule) => rule(context));
}
```

Add the rule (place it after `checkColorOnlySeriesDistinction`, before the `ExplicitColor` helpers):

```ts
const PANEL_LABEL_PATTERN = /\([a-z]\)/i;

function checkMlPanelLabels({ spec, specType }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const key of ["hconcat", "vconcat", "concat"] as const) {
    const panels = spec[key];

    if (!Array.isArray(panels)) {
      continue;
    }

    const objectPanelCount = panels.filter((panel) => isPlainObject(panel)).length;

    if (objectPanelCount < 2) {
      continue;
    }

    for (const [index, panel] of panels.entries()) {
      if (!isPlainObject(panel)) {
        continue;
      }

      const titleText = getTitleText(panel.title);

      if (titleText !== undefined && PANEL_LABEL_PATTERN.test(titleText)) {
        continue;
      }

      issues.push({
        severity: "warning",
        ruleId: "ml-panel-label-missing",
        path: `$.${key}[${index}].title`,
        message: `Panel ${index + 1} in "${key}" has no "(a)"-style label in its title.`,
        suggestion: 'Prefix each panel title with "(a)", "(b)", ... so captions can reference panels.',
      });
    }
  }

  return issues;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: add ml-panel-label-missing lint rule behind --domain ml"
```

---

### Task 4: `ml-crowded-labels` rule (spec-only)

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: `profile.mlMaxTextLabels` (Task 1), `collectVegaLiteUnitSpecs`, `getInlineDataValues`, `getLegendCategoryValues` internals.
- Produces: rule id `ml-crowded-labels` at `<unit>.encoding.text`; helpers `isTextMark(mark: unknown): boolean` and `getRuleDataValues(unitSpec: JsonObject, rootSpec: JsonObject, rootValues: unknown[] | undefined, externalDataRows: JsonObject[] | undefined): unknown[] | undefined` (reused by Tasks 6–7).

- [ ] **Step 1: Append failing tests to `packages/cli/test/lint-ml.test.ts`**

```ts
describe("ml-crowded-labels", () => {
  test("warns when a text mark labels more rows than the paper threshold", () => {
    const spec = textLabelSpec(21);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([
      {
        severity: "warning",
        ruleId: "ml-crowded-labels",
        path: "$.layer[1].encoding.text",
        message: "Text mark labels 21 rows; more than 20 labels crowd a paper figure.",
        suggestion: "Label only top-k points, aggregate the data, or drop the text layer.",
      },
    ]);
  });

  test("does not warn at the threshold boundary", () => {
    expect(mlIssues(runMlRules(textLabelSpec(20), { domain: "ml" }), "ml-crowded-labels")).toEqual(
      [],
    );
  });

  test("uses profile-specific text label thresholds", () => {
    const spec = textLabelSpec(16);

    expect(
      mlIssues(runMlRules(spec, { domain: "ml", profileName: "acl" }), "ml-crowded-labels"),
    ).toHaveLength(1);
    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([]);
  });

  test("ignores text channels on non-text marks", () => {
    const spec = textLabelSpec(21);
    const layer = spec.layer as JsonObject[];
    (layer[1] as JsonObject).mark = "point";

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([]);
  });

  test("does not run without domain ml", () => {
    expect(mlIssues(runMlRules(textLabelSpec(21)), "ml-crowded-labels")).toEqual([]);
  });
});
```

Helper (append to helpers section):

```ts
function textLabelSpec(rowCount: number): JsonObject {
  const spec = cleanVegaLiteSpec({
    data: {
      values: Array.from({ length: rowCount }, (_, index) => ({
        latency: index + 1,
        score: index / 100,
        model: `model-${index}`,
      })),
    },
    layer: [
      {
        mark: "point",
        encoding: {
          x: { field: "latency", type: "quantitative", title: "Latency" },
          y: { field: "score", type: "quantitative", title: "Score" },
        },
      },
      {
        mark: { type: "text", dy: -8 },
        encoding: {
          x: { field: "latency", type: "quantitative", title: "Latency" },
          y: { field: "score", type: "quantitative", title: "Score" },
          text: { field: "model", type: "nominal" },
        },
      },
    ],
  });
  delete spec.mark;
  delete spec.encoding;
  return spec;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: FAIL on "warns when a text mark labels more rows..." and "uses profile-specific text label thresholds" (received `[]`).

- [ ] **Step 3: Implement the rule**

In `packages/cli/src/core/lint-rules.ts`:

Register it:

```ts
export const mlLintRules: LintRule[] = [checkMlPanelLabels, checkMlCrowdedLabels];
```

Add after `checkMlPanelLabels`:

```ts
function checkMlCrowdedLabels({
  spec,
  specType,
  profile,
  externalDataRows,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (!isTextMark(unit.spec.mark)) {
      continue;
    }

    const encoding = getObject(unit.spec, "encoding");
    const text = encoding ? getObject(encoding, "text") : undefined;

    if (!text || typeof text.field !== "string") {
      continue;
    }

    const values = getRuleDataValues(unit.spec, spec, rootValues, externalDataRows);

    if (!values || values.length <= profile.mlMaxTextLabels) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "ml-crowded-labels",
      path: joinJsonPath(unit.path, "encoding.text"),
      message: `Text mark labels ${values.length} rows; more than ${profile.mlMaxTextLabels} labels crowd a ${profile.name} figure.`,
      suggestion: "Label only top-k points, aggregate the data, or drop the text layer.",
    });
  }

  return issues;
}
```

Add the two shared helpers next to `isLineMark`:

```ts
function isTextMark(mark: unknown): boolean {
  if (mark === "text") {
    return true;
  }

  return isPlainObject(mark) && mark.type === "text";
}

function getRuleDataValues(
  unitSpec: JsonObject,
  rootSpec: JsonObject,
  rootValues: unknown[] | undefined,
  externalDataRows: JsonObject[] | undefined,
): unknown[] | undefined {
  const unitValues = getInlineDataValues(unitSpec);

  if (unitValues) {
    return unitValues;
  }

  if (unitSpec !== rootSpec && hasDataDefinition(unitSpec)) {
    return undefined;
  }

  return rootValues ?? externalDataRows;
}
```

(`getRuleDataValues` mirrors `getLegendCategoryValues` but additionally falls back to CSV rows loaded from the root `data.url` — including when the unit **is** the root spec carrying that `data.url`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: add ml-crowded-labels lint rule"
```

---

### Task 5: Lint data loading (`data.url` CSV resolution)

**Files:**
- Create: `packages/cli/src/core/lint-data.ts`
- Modify: `packages/cli/src/core/lint.ts`
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: `parseCsv(contents: string): ParsedCsv` exported by `packages/cli/src/core/infer.ts` (returns `{ header: string[]; rows: string[][] }`; throws `VegaPaperError` on empty/invalid CSV).
- Produces: `export async function loadLintDataRows(spec: JsonObject, specPath: string): Promise<JsonObject[] | undefined>` — rows as `Record<field, string>` objects; `undefined` on any failure. `lintSpec` populates `externalDataRows` only when `request.domain === "ml"`.

- [ ] **Step 1: Append failing tests to `packages/cli/test/lint-ml.test.ts`**

Add `loadLintDataRows` to the imports, and add `mkdir` to the existing `node:fs/promises` import (first used by the subdirectory test below):

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { loadLintDataRows } from "../src/core/lint-data";
```

Append the describe block:

```ts
describe("loadLintDataRows", () => {
  test("loads CSV rows relative to the spec file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await writeFile(
        join(workspacePath, "data.csv"),
        "model,score\nbaseline,71.2\nours,74.8\n",
        "utf8",
      );

      const rows = await loadLintDataRows({ data: { url: "data.csv" } }, specPath);

      expect(rows).toEqual([
        { model: "baseline", score: "71.2" },
        { model: "ours", score: "74.8" },
      ]);
    });
  });

  test("resolves subdirectory urls relative to the spec file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await mkdir(join(workspacePath, "data"), { recursive: true });
      await writeFile(join(workspacePath, "data", "rows.csv"), "model,score\nours,74.8\n", "utf8");

      const rows = await loadLintDataRows({ data: { url: "data/rows.csv" } }, specPath);

      expect(rows).toEqual([{ model: "ours", score: "74.8" }]);
    });
  });

  test("returns undefined for a missing CSV file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");

      expect(await loadLintDataRows({ data: { url: "missing.csv" } }, specPath)).toBeUndefined();
    });
  });

  test("returns undefined for an unparsable CSV file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await writeFile(join(workspacePath, "data.csv"), "", "utf8");

      expect(await loadLintDataRows({ data: { url: "data.csv" } }, specPath)).toBeUndefined();
    });
  });

  test("ignores non-csv, remote, and inline data definitions", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");

      expect(await loadLintDataRows({ data: { url: "data.json" } }, specPath)).toBeUndefined();
      expect(
        await loadLintDataRows({ data: { url: "https://example.com/data.csv" } }, specPath),
      ).toBeUndefined();
      expect(await loadLintDataRows({ data: { values: [] } }, specPath)).toBeUndefined();
      expect(await loadLintDataRows({}, specPath)).toBeUndefined();
    });
  });
});

describe("lintSpec data loading degrades gracefully", () => {
  test("missing data.url file produces no errors under domain ml", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec({ data: { url: "missing.csv" } }));

      const result = await lintSpec({ inputPath, domain: "ml" });

      expect(result.errorCount).toBe(0);
      expect(result.issues.map((issue) => issue.ruleId)).not.toContain("spec-unreadable");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: FAIL — cannot resolve module `../src/core/lint-data`.

- [ ] **Step 3: Create `packages/cli/src/core/lint-data.ts`**

```ts
import { dirname, isAbsolute, resolve } from "node:path";
import { parseCsv } from "./infer";
import type { JsonObject } from "./spec";

export async function loadLintDataRows(
  spec: JsonObject,
  specPath: string,
): Promise<JsonObject[] | undefined> {
  const url = getRootCsvDataUrl(spec);

  if (url === undefined) {
    return undefined;
  }

  const dataPath = isAbsolute(url) ? url : resolve(dirname(specPath), url);
  const file = Bun.file(dataPath);

  try {
    if (!(await file.exists())) {
      return undefined;
    }

    const csv = parseCsv(await file.text());

    return csv.rows.map((row) =>
      Object.fromEntries(csv.header.map((field, index) => [field, row[index] ?? ""])),
    );
  } catch {
    return undefined;
  }
}

function getRootCsvDataUrl(spec: JsonObject): string | undefined {
  const data = spec.data;

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined;
  }

  const url = (data as JsonObject).url;

  if (typeof url !== "string" || !url.toLowerCase().endsWith(".csv")) {
    return undefined;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return undefined;
  }

  return url;
}
```

- [ ] **Step 4: Wire it into `lintSpec`**

In `packages/cli/src/core/lint.ts`, add the import:

```ts
import { loadLintDataRows } from "./lint-data";
```

Replace the final `return` of `lintSpec` with:

```ts
  const externalDataRows =
    request.domain === "ml" ? await loadLintDataRows(spec, request.inputPath) : undefined;

  return createLintResult(
    runLintRules({
      inputPath: request.inputPath,
      spec,
      specType,
      profile,
      domain: request.domain,
      externalDataRows,
    }),
  );
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 6: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-data.ts packages/cli/src/core/lint.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: load data.url CSV rows for lint --domain ml"
```

---

### Task 6: `ml-too-many-series` rule (data-dependent)

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: `profile.mlMaxSeries` (Task 1), `getRuleDataValues` (Task 4), `externalDataRows` (Task 5), existing `countDistinctFieldValues`, `isLineMark`, `isBarMark`.
- Produces: rule id `ml-too-many-series` at `<unit>.encoding.color`; helper `isPointMark(mark: unknown): boolean`.

- [ ] **Step 1: Append failing tests to `packages/cli/test/lint-ml.test.ts`**

```ts
describe("ml-too-many-series", () => {
  test("warns when external rows have more series than the paper threshold", () => {
    const spec = cleanVegaLiteSpec({ data: { url: "data.csv" } });

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: seriesRows(9) }),
        "ml-too-many-series",
      ),
    ).toEqual([
      {
        severity: "warning",
        ruleId: "ml-too-many-series",
        path: "$.encoding.color",
        message: 'Color field "model" has 9 series; more than 8 is hard to read in a paper figure.',
        suggestion: "Filter to key methods, facet the chart, or group minor series.",
      },
    ]);
  });

  test("does not warn at the threshold boundary", () => {
    const spec = cleanVegaLiteSpec({ data: { url: "data.csv" } });

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: seriesRows(8) }),
        "ml-too-many-series",
      ),
    ).toEqual([]);
  });

  test("uses profile-specific series thresholds", () => {
    const spec = cleanVegaLiteSpec({ data: { url: "data.csv" } });
    const rows = seriesRows(9);

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", profileName: "web", externalDataRows: rows }),
        "ml-too-many-series",
      ),
    ).toEqual([]);
    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", profileName: "print", externalDataRows: rows }),
        "ml-too-many-series",
      ),
    ).toHaveLength(1);
  });

  test("counts inline data rows too", () => {
    const spec = cleanVegaLiteSpec({ data: { values: seriesRows(9) } });

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-too-many-series")).toHaveLength(1);
  });

  test("ignores marks that are not line, bar, or point", () => {
    const spec = cleanVegaLiteSpec({ data: { url: "data.csv" }, mark: "rect" });

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: seriesRows(9) }),
        "ml-too-many-series",
      ),
    ).toEqual([]);
  });

  test("does not run without domain ml", () => {
    const spec = cleanVegaLiteSpec({ data: { values: seriesRows(9) } });

    expect(mlIssues(runMlRules(spec), "ml-too-many-series")).toEqual([]);
  });
});
```

Helper (append to helpers section):

```ts
function seriesRows(seriesCount: number): JsonObject[] {
  return Array.from({ length: seriesCount }, (_, index) => ({
    epoch: "1",
    accuracy: `${0.5 + index / 100}`,
    model: `model-${index}`,
  }));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: FAIL on the warning-producing `ml-too-many-series` tests (received `[]`).

- [ ] **Step 3: Implement the rule**

In `packages/cli/src/core/lint-rules.ts`:

Register it:

```ts
export const mlLintRules: LintRule[] = [
  checkMlPanelLabels,
  checkMlCrowdedLabels,
  checkMlTooManySeries,
];
```

Add after `checkMlCrowdedLabels`:

```ts
function checkMlTooManySeries({
  spec,
  specType,
  profile,
  externalDataRows,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (!isLineMark(unit.spec.mark) && !isBarMark(unit.spec.mark) && !isPointMark(unit.spec.mark)) {
      continue;
    }

    const encoding = getObject(unit.spec, "encoding");
    const color = encoding ? getObject(encoding, "color") : undefined;
    const field = typeof color?.field === "string" ? color.field : undefined;

    if (!field) {
      continue;
    }

    const values = getRuleDataValues(unit.spec, spec, rootValues, externalDataRows);

    if (!values) {
      continue;
    }

    const count = countDistinctFieldValues(values, field);

    if (count <= profile.mlMaxSeries) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "ml-too-many-series",
      path: joinJsonPath(unit.path, "encoding.color"),
      message: `Color field "${field}" has ${count} series; more than ${profile.mlMaxSeries} is hard to read in a ${profile.name} figure.`,
      suggestion: "Filter to key methods, facet the chart, or group minor series.",
    });
  }

  return issues;
}
```

Add the mark helper next to `isTextMark`:

```ts
function isPointMark(mark: unknown): boolean {
  if (mark === "point" || mark === "circle") {
    return true;
  }

  return isPlainObject(mark) && (mark.type === "point" || mark.type === "circle");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: add ml-too-many-series lint rule"
```

---

### Task 7: `ml-log-scale-candidate` rule (data-dependent)

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: `getRuleDataValues` (Task 4), `externalDataRows` (Task 5).
- Produces: rule id `ml-log-scale-candidate` at `<unit>.encoding.x.scale`; helper `collectPositiveNumbers(values: unknown[], field: string): number[]`; constant `LOG_SCALE_SPAN_RATIO = 1000`.

- [ ] **Step 1: Append failing tests to `packages/cli/test/lint-ml.test.ts`**

```ts
describe("ml-log-scale-candidate", () => {
  test("warns when x spans more than three orders of magnitude", () => {
    const spec = scalingSpec();

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: flopsRows(["1", "500", "1001"]) }),
        "ml-log-scale-candidate",
      ),
    ).toEqual([
      {
        severity: "warning",
        ruleId: "ml-log-scale-candidate",
        path: "$.encoding.x.scale",
        message: 'X field "flops" spans more than 3 orders of magnitude (max/min > 1000).',
        suggestion: 'Set encoding.x.scale.type to "log" for scaling or Pareto figures.',
      },
    ]);
  });

  test("does not warn at the ratio boundary", () => {
    expect(
      mlIssues(
        runMlRules(scalingSpec(), { domain: "ml", externalDataRows: flopsRows(["1", "1000"]) }),
        "ml-log-scale-candidate",
      ),
    ).toEqual([]);
  });

  test("parses scientific-notation CSV strings", () => {
    expect(
      mlIssues(
        runMlRules(scalingSpec(), {
          domain: "ml",
          externalDataRows: flopsRows(["1.2e20", "5.4e23"]),
        }),
        "ml-log-scale-candidate",
      ),
    ).toHaveLength(1);
  });

  test("ignores non-positive and non-numeric values", () => {
    expect(
      mlIssues(
        runMlRules(scalingSpec(), {
          domain: "ml",
          externalDataRows: flopsRows(["-5", "0", "n/a", "1", "1001"]),
        }),
        "ml-log-scale-candidate",
      ),
    ).toHaveLength(1);
    expect(
      mlIssues(
        runMlRules(scalingSpec(), { domain: "ml", externalDataRows: flopsRows(["-5", "0"]) }),
        "ml-log-scale-candidate",
      ),
    ).toEqual([]);
  });

  test("does not warn when a log scale is already set", () => {
    const spec = scalingSpec({ scale: { type: "log" } });

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: flopsRows(["1", "1001"]) }),
        "ml-log-scale-candidate",
      ),
    ).toEqual([]);
  });

  test("warns once per field across layers", () => {
    const layerUnit = {
      mark: "line",
      encoding: {
        x: { field: "flops", type: "quantitative", title: "FLOPs" },
        y: { field: "loss", type: "quantitative", title: "Loss" },
      },
    };
    const spec = cleanVegaLiteSpec({
      data: { url: "data.csv" },
      layer: [layerUnit, structuredClone(layerUnit)],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      mlIssues(
        runMlRules(spec, { domain: "ml", externalDataRows: flopsRows(["1", "1001"]) }),
        "ml-log-scale-candidate",
      ),
    ).toHaveLength(1);
  });

  test("does not run without domain ml", () => {
    const spec = scalingSpec({
      data: { values: [{ flops: 1, loss: 2.8 }, { flops: 1001, loss: 2.1 }] },
    });

    expect(mlIssues(runMlRules(spec), "ml-log-scale-candidate")).toEqual([]);
  });
});
```

Helpers (append to helpers section):

```ts
function scalingSpec(overrides: JsonObject = {}): JsonObject {
  const { scale, ...rest } = overrides as { scale?: JsonObject } & JsonObject;

  return cleanVegaLiteSpec({
    data: { url: "data.csv" },
    encoding: {
      x: {
        field: "flops",
        type: "quantitative",
        title: "FLOPs",
        ...(scale === undefined ? {} : { scale }),
      },
      y: { field: "loss", type: "quantitative", title: "Loss" },
    },
    ...rest,
  });
}

function flopsRows(flopsValues: string[]): JsonObject[] {
  return flopsValues.map((flops, index) => ({ flops, loss: `${3 - index / 10}` }));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: FAIL on the warning-producing `ml-log-scale-candidate` tests (received `[]`).

- [ ] **Step 3: Implement the rule**

In `packages/cli/src/core/lint-rules.ts`:

Register it (final ML rule list):

```ts
export const mlLintRules: LintRule[] = [
  checkMlPanelLabels,
  checkMlCrowdedLabels,
  checkMlTooManySeries,
  checkMlLogScaleCandidate,
];
```

Add after `checkMlTooManySeries`:

```ts
const LOG_SCALE_SPAN_RATIO = 1000;

function checkMlLogScaleCandidate({
  spec,
  specType,
  externalDataRows,
}: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);
  const reportedFields = new Set<string>();

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    const encoding = getObject(unit.spec, "encoding");
    const x = encoding ? getObject(encoding, "x") : undefined;

    if (!x || typeof x.field !== "string" || x.type !== "quantitative") {
      continue;
    }

    if (reportedFields.has(x.field)) {
      continue;
    }

    const scale = getObject(x, "scale");

    if (scale?.type === "log") {
      continue;
    }

    const values = getRuleDataValues(unit.spec, spec, rootValues, externalDataRows);

    if (!values) {
      continue;
    }

    const numbers = collectPositiveNumbers(values, x.field);

    if (numbers.length < 2) {
      continue;
    }

    if (Math.max(...numbers) / Math.min(...numbers) <= LOG_SCALE_SPAN_RATIO) {
      continue;
    }

    reportedFields.add(x.field);
    issues.push({
      severity: "warning",
      ruleId: "ml-log-scale-candidate",
      path: joinJsonPath(unit.path, "encoding.x.scale"),
      message: `X field "${x.field}" spans more than 3 orders of magnitude (max/min > 1000).`,
      suggestion: 'Set encoding.x.scale.type to "log" for scaling or Pareto figures.',
    });
  }

  return issues;
}
```

Add the numeric helper next to `countDistinctFieldValues`:

```ts
function collectPositiveNumbers(values: unknown[], field: string): number[] {
  const numbers: number[] = [];

  for (const row of values) {
    if (!isPlainObject(row)) {
      continue;
    }

    const raw = row[field];
    const value =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;

    if (Number.isFinite(value) && value > 0) {
      numbers.push(value);
    }
  }

  return numbers;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/cli/test/lint-ml.test.ts packages/cli/test/lint.test.ts`
Expected: all pass, 0 fail.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add packages/cli/src/core/lint-rules.ts packages/cli/test/lint-ml.test.ts
git commit -m "feat: add ml-log-scale-candidate lint rule"
```

---

### Task 8: Document ML domain rules in the paper style guide

**Files:**
- Modify: `skills/vega-paper/references/paper-style-guide.md`

**Interfaces:**
- Consumes: final rule ids, thresholds, and behavior from Tasks 1–7.
- Produces: a "## ML domain rules (`--domain ml`)" section that later phases and the skill can reference.

- [ ] **Step 1: Add the ML rules section**

In `skills/vega-paper/references/paper-style-guide.md`, insert the following section immediately after the "Errors (always blocking)" table (before `## Common mistakes`). Note: Phase A may have edited surrounding text — anchor on the errors table, not on line numbers.

````markdown
## ML domain rules (`--domain ml`)

For ML conference figures, add `--domain ml` to opt in to ML-paper rules on top of the selected profile:

```bash
vega-paper lint chart.vl.json --profile paper --domain ml
```

Without `--domain ml`, none of these rules run and lint output is unchanged. All ML rules are **warnings**; combine with `--strict` to gate CI.

When `--domain ml` is active and the spec's root `data.url` points to a local `.csv` file, lint resolves that path **relative to the spec file** and loads the rows so data-dependent rules can count series and value ranges (specs generated by `infer` reference data this way). If the CSV is missing, remote (`https://...`), non-CSV, or unreadable, data-dependent rules are silently skipped — lint never errors because of missing data.

ML thresholds per profile:

| Profile | Max series (`mlMaxSeries`) | Max text labels (`mlMaxTextLabels`) |
|---------|----------------------------|-------------------------------------|
| `paper` | 8 | 20 |
| `web` | 12 | 30 |
| `acl` | 8 | 15 |
| `print` | 6 | 20 |

| ruleId | Needs data rows | Meaning | Typical fix |
|--------|-----------------|---------|-------------|
| `ml-panel-label-missing` | no | Top-level `hconcat`/`vconcat`/`concat` with 2+ panels where a panel title lacks an `(a)`-style label | Prefix panel titles with `(a)`, `(b)`, `(c)` so the LaTeX caption can reference panels |
| `ml-crowded-labels` | inline or loaded | A `text` mark labels more rows than the profile's max text labels | Label only top-k points, aggregate the data, or drop the text layer |
| `ml-too-many-series` | inline or loaded | `color` field has more distinct series than the profile's max series on a line/bar/point mark | Filter to key methods, facet the chart, or group minor series |
| `ml-log-scale-candidate` | inline or loaded | Quantitative x without a log scale spans more than 3 orders of magnitude (max/min > 1000 over positive values) | Set `encoding.x.scale.type` to `"log"` — typical for scaling-law and Pareto figures |

Deferred ML rules (specified but not yet implemented; see the ML conference figures spec §10.3): `ml-missing-uncertainty`, `ml-missing-baseline`, `ml-unordered-ablation`.
````

- [ ] **Step 2: Verify the doc renders and thresholds match the code**

Run: `grep -n "mlMaxSeries\|mlMaxTextLabels" packages/cli/src/core/lint-profiles.ts skills/vega-paper/references/paper-style-guide.md`
Expected: profile values in the doc table match `lint-profiles.ts` (paper 8/20, web 12/30, acl 8/15, print 6/20).

- [ ] **Step 3: Check and commit**

```bash
bun run check
git add skills/vega-paper/references/paper-style-guide.md
git commit -m "docs: document ML domain lint rules and thresholds"
```

---

### Task 9: End-to-end integration tests and final verification

**Files:**
- Test: `packages/cli/test/lint-ml.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8; example fixtures from Phases A–D (`examples/scaling-law/chart.vl.json`, `examples/multipanel-paper-figure/chart.vl.json`).
- Produces: end-to-end coverage of the `--domain ml` → data loading → rules pipeline via real files.

- [ ] **Step 1: Append failing integration tests to `packages/cli/test/lint-ml.test.ts`**

Add `REPO_ROOT` near the top of the helpers section:

```ts
const REPO_ROOT = join(import.meta.dir, "../../..");
```

Append the describe block:

```ts
describe("lintSpec --domain ml end to end", () => {
  test("loads relative data.url CSV and reports ml-too-many-series", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      const header = "epoch,accuracy,model\n";
      const rows = Array.from(
        { length: 9 },
        (_, index) => `1,0.${50 + index},model-${index}`,
      ).join("\n");
      await writeFile(join(workspacePath, "data.csv"), `${header}${rows}\n`, "utf8");
      await writeJson(inputPath, cleanVegaLiteSpec({ data: { url: "data.csv" } }));

      const mlResult = await lintSpec({ inputPath, domain: "ml" });
      const defaultResult = await lintSpec({ inputPath });

      expect(mlResult.issues.map((issue) => issue.ruleId)).toContain("ml-too-many-series");
      expect(defaultResult.issues.map((issue) => issue.ruleId)).not.toContain(
        "ml-too-many-series",
      );
    });
  });

  test("example fixtures lint without errors under domain ml", async () => {
    for (const examplePath of [
      "examples/scaling-law/chart.vl.json",
      "examples/multipanel-paper-figure/chart.vl.json",
    ]) {
      const result = await lintSpec({
        inputPath: join(REPO_ROOT, examplePath),
        domain: "ml",
      });

      expect(result.errorCount).toBe(0);
    }
  });

  test("labeled title objects in the multipanel example satisfy ml-panel-label-missing", async () => {
    // Phase D panels use title objects: { text: "(a) ...", anchor: "start", fontWeight: "bold" }.
    const result = await lintSpec({
      inputPath: join(REPO_ROOT, "examples/multipanel-paper-figure/chart.vl.json"),
      domain: "ml",
    });

    expect(result.issues.map((issue) => issue.ruleId)).not.toContain("ml-panel-label-missing");
  });

  test("the scaling-law example's existing log x scale satisfies ml-log-scale-candidate", async () => {
    const result = await lintSpec({
      inputPath: join(REPO_ROOT, "examples/scaling-law/chart.vl.json"),
      domain: "ml",
    });

    expect(result.issues.map((issue) => issue.ruleId)).not.toContain("ml-log-scale-candidate");
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `bun test packages/cli/test/lint-ml.test.ts`
Expected: all pass, 0 fail. (These tests pass immediately because Tasks 3–7 already landed — they are an integration regression net, not new behavior. If a fixture test fails with `spec-unreadable`, a Phase C–D fixture is missing: stop and report per Global Constraints.)

- [ ] **Step 3: Run the full verification suite**

```bash
bun test
bun run typecheck
bun run check
```

Expected: `bun test` all pass, 0 fail (including untouched `lint.test.ts`, `infer-command.test.ts`, `examples.test.ts`); `typecheck` and `check` exit 0 with no diagnostics.

- [ ] **Step 4: Manual CLI smoke check**

Run from the repo root (same invocation the root `package.json` scripts use):

```bash
bun run packages/cli/src/index.ts lint examples/scaling-law/chart.vl.json --profile paper --domain ml
bun run packages/cli/src/index.ts lint examples/scaling-law/chart.vl.json --profile paper
```

Expected: first command prints either `No lint issues found.` or a warnings table that may include `ml-*` rules (the scaling-law spec itself should trigger none: its x scale is already `log` and it has only 2 series); second command prints the same result **minus** any `ml-*` rows; both exit 0 (no errors, no `--strict`).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/test/lint-ml.test.ts
git commit -m "test: add end-to-end and example-fixture coverage for lint --domain ml"
```

---

## Self-Review (performed while writing this plan)

1. **Spec coverage:** §12 Phase E step 1 (`--domain ml`) → Task 2; step 2 spec-only rules → Tasks 3–4; step 3 data loading → Task 5; step 4 data-dependent rules → Tasks 6–7; step 5 docs → Task 8. §10.2 (no new profile, opt-in gating, exact CLI syntax) → Tasks 1–2. §10.3 graceful degradation → Task 5 + Global Constraints. §13 "Lint domain options parse correctly" → Task 2 tests. Deferred rules explicitly out of scope.
2. **Placeholder scan:** every step contains complete code or exact commands; the only conditional instructions are fixture-existence guards, which resolve to "stop and report".
3. **Type consistency:** `LintDomain` defined in `core/lint.ts` (Task 2) and imported by `commands/lint.ts` (Task 2), `lint-rules.ts` (Task 2), tests (Task 2). `getRuleDataValues(unitSpec, rootSpec, rootValues, externalDataRows)` defined in Task 4, called with identical signature in Tasks 6–7. `mlMaxSeries`/`mlMaxTextLabels` names identical across Task 1 code, Task 1 tests, Task 4/6 rules, and Task 8 docs. `parseCsv` reuse matches its actual export in `packages/cli/src/core/infer.ts` (`parseCsv(contents: string): ParsedCsv`).
