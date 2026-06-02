# VegaPaper Lint Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `vega-paper lint --profile <paper|web|acl>` so lint thresholds can target paper, web, or ACL-style figures.

**Architecture:** Add a core `lint-profiles` module that owns profile names, thresholds, and profile resolution. Thread the resolved `LintProfile` through `lintSpec()` and `runLintRules()`, then add a thin CLI `--profile` option that passes the selected profile name to core linting without changing `LintResult`.

**Tech Stack:** Bun, TypeScript, Commander, Bun test, existing VegaPaper CLI lint core.

---

## File Structure

- Create `packages/cli/src/core/lint-profiles.ts`
  - Defines `LintProfileName`, `LintProfile`, profile constants, `getLintProfile()`, and `listLintProfileNames()`.
- Create `packages/cli/test/lint-profiles.test.ts`
  - Tests profile defaults, thresholds, list order, and unknown profile errors.
- Modify `packages/cli/src/core/lint-rules.ts`
  - Add `profile: LintProfile` to `LintRuleContext`.
  - Replace numeric threshold literals with profile values.
- Modify `packages/cli/src/core/lint.ts`
  - Add `profileName?: string` to `LintRequest`.
  - Resolve profile through `getLintProfile()`.
  - Pass profile to `runLintRules()`.
- Modify `packages/cli/src/commands/lint.ts`
  - Add `--profile <name>`.
  - Pass the option to `lintSpec({ inputPath, profileName })`.
- Modify `packages/cli/test/lint.test.ts`
  - Import `getLintProfile`.
  - Pass `paper` profile in `runRules()` helper.
  - Add profile-sensitive rule/core/command tests.

## Task 1: Add Lint Profile Module

**Files:**
- Create: `packages/cli/src/core/lint-profiles.ts`
- Create: `packages/cli/test/lint-profiles.test.ts`

- [ ] **Step 1: Write failing profile module tests**

Create `packages/cli/test/lint-profiles.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import {
  DEFAULT_LINT_PROFILE_NAME,
  getLintProfile,
  listLintProfileNames,
} from "../src/core/lint-profiles";

describe("lint profiles", () => {
  test("defaults to the paper profile", () => {
    expect(DEFAULT_LINT_PROFILE_NAME).toBe("paper");
    expect(getLintProfile()).toEqual(getLintProfile("paper"));
  });

  test("returns paper thresholds", () => {
    expect(getLintProfile("paper")).toEqual({
      name: "paper",
      titleMaxLength: 90,
      widthRange: { min: 180, max: 720 },
      heightRange: { min: 120, max: 540 },
      maxInlineRows: 500,
      maxColorCategories: 12,
      minFontSize: 8,
    });
  });

  test("returns ACL thresholds", () => {
    expect(getLintProfile("acl")).toEqual({
      name: "acl",
      titleMaxLength: 70,
      widthRange: { min: 240, max: 480 },
      heightRange: { min: 160, max: 360 },
      maxInlineRows: 300,
      maxColorCategories: 8,
      minFontSize: 9,
    });
  });

  test("returns web thresholds", () => {
    expect(getLintProfile("web")).toEqual({
      name: "web",
      titleMaxLength: 120,
      widthRange: { min: 240, max: 1200 },
      heightRange: { min: 160, max: 800 },
      maxInlineRows: 1000,
      maxColorCategories: 20,
      minFontSize: 10,
    });
  });

  test("lists profiles in CLI display order", () => {
    expect(listLintProfileNames()).toEqual(["paper", "web", "acl"]);
  });

  test("rejects unknown profiles", () => {
    expect(() => getLintProfile("unknown")).toThrow(VegaPaperError);
    expect(() => getLintProfile("unknown")).toThrow(
      'Unknown lint profile "unknown". Expected one of: paper, web, acl.',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint-profiles.test.ts
```

Expected: FAIL because `packages/cli/src/core/lint-profiles.ts` does not exist.

- [ ] **Step 3: Implement lint profiles**

Create `packages/cli/src/core/lint-profiles.ts`:

```ts
import { VegaPaperError } from "./errors";

export type LintProfileName = "paper" | "web" | "acl";

export type LintProfile = {
  name: LintProfileName;
  titleMaxLength: number;
  widthRange: { min: number; max: number };
  heightRange: { min: number; max: number };
  maxInlineRows: number;
  maxColorCategories: number;
  minFontSize: number;
};

export const DEFAULT_LINT_PROFILE_NAME: LintProfileName = "paper";

const LINT_PROFILE_ORDER: LintProfileName[] = ["paper", "web", "acl"];

export const LINT_PROFILES: Record<LintProfileName, LintProfile> = {
  paper: {
    name: "paper",
    titleMaxLength: 90,
    widthRange: { min: 180, max: 720 },
    heightRange: { min: 120, max: 540 },
    maxInlineRows: 500,
    maxColorCategories: 12,
    minFontSize: 8,
  },
  web: {
    name: "web",
    titleMaxLength: 120,
    widthRange: { min: 240, max: 1200 },
    heightRange: { min: 160, max: 800 },
    maxInlineRows: 1000,
    maxColorCategories: 20,
    minFontSize: 10,
  },
  acl: {
    name: "acl",
    titleMaxLength: 70,
    widthRange: { min: 240, max: 480 },
    heightRange: { min: 160, max: 360 },
    maxInlineRows: 300,
    maxColorCategories: 8,
    minFontSize: 9,
  },
};

export function getLintProfile(
  profileName: string | undefined = DEFAULT_LINT_PROFILE_NAME,
): LintProfile {
  if (isLintProfileName(profileName)) {
    return LINT_PROFILES[profileName];
  }

  throw new VegaPaperError(
    `Unknown lint profile "${profileName}". Expected one of: ${listLintProfileNames().join(
      ", ",
    )}.`,
  );
}

export function listLintProfileNames(): LintProfileName[] {
  return [...LINT_PROFILE_ORDER];
}

function isLintProfileName(value: string): value is LintProfileName {
  return Object.prototype.hasOwnProperty.call(LINT_PROFILES, value);
}
```

- [ ] **Step 4: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint-profiles.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: profile tests pass and typecheck passes.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/cli/src/core/lint-profiles.ts packages/cli/test/lint-profiles.test.ts
git commit -m "feat: add lint profiles"
```

## Task 2: Thread Profiles Through Lint Rules

**Files:**
- Modify: `packages/cli/src/core/lint-rules.ts`
- Modify: `packages/cli/src/core/lint.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing profile-sensitive rule tests**

Modify imports at the top of `packages/cli/test/lint.test.ts`:

```ts
import { getLintProfile, type LintProfileName } from "../src/core/lint-profiles";
```

Append these tests inside the existing `describe("runLintRules", () => { ... })` block, near the related current rule tests:

```ts
  test("uses profile size ranges", () => {
    const spec = cleanVegaLiteSpec({ width: 1000, height: 700 });

    expect(
      runRules(spec, "vega-lite", "paper")
        .filter((issue) => issue.ruleId === "size-out-of-range")
        .map((issue) => issue.path),
    ).toEqual(["$.width", "$.height"]);
    expect(
      runRules(spec, "vega-lite", "web").filter(
        (issue) => issue.ruleId === "size-out-of-range",
      ),
    ).toEqual([]);
  });

  test("uses profile title length thresholds", () => {
    const spec = cleanVegaLiteSpec({ title: "A".repeat(100) });

    expect(
      runRules(spec, "vega-lite", "paper").some(
        (issue) => issue.ruleId === "title-too-long",
      ),
    ).toBe(true);
    expect(
      runRules(spec, "vega-lite", "web").some(
        (issue) => issue.ruleId === "title-too-long",
      ),
    ).toBe(false);
  });

  test("uses profile inline data row thresholds", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 400 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
        })),
      },
    });

    expect(
      runRules(spec, "vega-lite", "acl").some(
        (issue) => issue.ruleId === "inline-data-large",
      ),
    ).toBe(true);
    expect(
      runRules(spec, "vega-lite", "paper").some(
        (issue) => issue.ruleId === "inline-data-large",
      ),
    ).toBe(false);
  });

  test("uses profile legend category thresholds", () => {
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

    expect(
      runRules(spec, "vega-lite", "acl").some(
        (issue) => issue.ruleId === "legend-too-many-categories",
      ),
    ).toBe(true);
    expect(
      runRules(spec, "vega-lite", "web").some(
        (issue) => issue.ruleId === "legend-too-many-categories",
      ),
    ).toBe(false);
  });

  test("uses profile minimum font size thresholds", () => {
    const spec = cleanVegaLiteSpec({
      config: {
        axis: { labelFontSize: 8 },
      },
    });

    expect(
      runRules(spec, "vega-lite", "acl").some(
        (issue) => issue.ruleId === "font-size-small",
      ),
    ).toBe(true);
    expect(
      runRules(spec, "vega-lite", "paper").some(
        (issue) => issue.ruleId === "font-size-small",
      ),
    ).toBe(false);
  });
```

Update the existing `runRules()` helper in `packages/cli/test/lint.test.ts`:

```ts
function runRules(
  spec: JsonObject,
  specType: SpecType = "vega-lite",
  profileName: LintProfileName = "paper",
) {
  return runLintRules({
    inputPath: "chart.vl.json",
    spec,
    specType,
    profile: getLintProfile(profileName),
  });
}
```

- [ ] **Step 2: Add failing lintSpec profile test**

Append this test inside the existing `describe("lintSpec", () => { ... })` block:

```ts
  test("uses requested profile thresholds", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec({ width: 1000, height: 700 }));

      const paperResult = await lintSpec({ inputPath, profileName: "paper" });
      const webResult = await lintSpec({ inputPath, profileName: "web" });

      expect(
        paperResult.issues
          .filter((issue) => issue.ruleId === "size-out-of-range")
          .map((issue) => issue.path),
      ).toEqual(["$.width", "$.height"]);
      expect(
        webResult.issues.filter(
          (issue) => issue.ruleId === "size-out-of-range",
        ),
      ).toEqual([]);
    });
  });
```

- [ ] **Step 3: Run focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL because `LintRuleContext` does not accept `profile`, rules still use hard-coded thresholds, and `LintRequest` does not accept `profileName`.

- [ ] **Step 4: Thread profile through core lint**

Modify `packages/cli/src/core/lint-rules.ts`.

Add import:

```ts
import type { LintProfile } from "./lint-profiles";
```

Add `profile` to `LintRuleContext`:

```ts
export type LintRuleContext = {
  inputPath: string;
  spec: JsonObject;
  specType: SpecType;
  profile: LintProfile;
};
```

Update rules:

```ts
function checkTitleLength({ spec, profile }: LintRuleContext): LintIssue[] {
  const titleText = getTitleText(spec.title);

  if (!titleText || titleText.length <= profile.titleMaxLength) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: `Title is longer than ${profile.titleMaxLength} characters.`,
      suggestion: "Shorten the title or move detail into the caption.",
    },
  ];
}
```

```ts
function checkSizeRange({ spec, profile }: LintRuleContext): LintIssue[] {
  const issues: LintIssue[] = [];
  const width = getNumber(spec, "width");
  const height = getNumber(spec, "height");

  if (
    width !== undefined &&
    (width < profile.widthRange.min || width > profile.widthRange.max)
  ) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.width",
      message: `Width ${width} is outside the ${profile.name} range ${profile.widthRange.min}-${profile.widthRange.max}.`,
      suggestion: "Choose a width that maps cleanly to the target output.",
    });
  }

  if (
    height !== undefined &&
    (height < profile.heightRange.min || height > profile.heightRange.max)
  ) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.height",
      message: `Height ${height} is outside the ${profile.name} range ${profile.heightRange.min}-${profile.heightRange.max}.`,
      suggestion: "Choose a height that keeps labels readable without wasting space.",
    });
  }

  return issues;
}
```

```ts
function checkInlineDataSize({ spec, profile }: LintRuleContext): LintIssue[] {
  const values = getInlineDataValues(spec);

  if (!values || values.length <= profile.maxInlineRows) {
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
```

In `checkLegendCategoryCount`, destructure `profile` and replace `12` with `profile.maxColorCategories`:

```ts
function checkLegendCategoryCount({
  spec,
  specType,
  profile,
}: LintRuleContext): LintIssue[] {
  // existing code...
    if (categories.size <= profile.maxColorCategories) {
      continue;
    }
  // existing code...
}
```

Update `checkFontSizes`:

```ts
function checkFontSizes({ spec, profile }: LintRuleContext): LintIssue[] {
  const checks = [
    "$.config.axis.labelFontSize",
    "$.config.axis.titleFontSize",
    "$.config.legend.labelFontSize",
    "$.config.legend.titleFontSize",
  ];

  return checks.flatMap((path) => {
    const value = getPathNumber(spec, path);

    if (value === undefined || value >= profile.minFontSize) {
      return [];
    }

    return [
      {
        severity: "warning",
        ruleId: "font-size-small",
        path,
        message: `Font size ${value} is smaller than ${profile.minFontSize}.`,
        suggestion: `Use font sizes of at least ${profile.minFontSize} for ${profile.name} figures.`,
      },
    ];
  });
}
```

Modify `packages/cli/src/core/lint.ts`.

Add import:

```ts
import { getLintProfile } from "./lint-profiles";
```

Update `LintRequest`:

```ts
export type LintRequest = {
  inputPath: string;
  profileName?: string | undefined;
};
```

Resolve the profile near the start of `lintSpec()` before loading or parsing the input spec. Unknown profiles are configuration errors, so they should throw before spec linting begins:

```ts
  const profile = getLintProfile(request.profileName);
```

Pass the resolved profile to the rule runner:

```ts
  return createLintResult(
    runLintRules({
      inputPath: request.inputPath,
      spec,
      specType,
      profile,
    }),
  );
```

- [ ] **Step 5: Update existing assertions changed by profile messages**

Update existing tests in `packages/cli/test/lint.test.ts` whose exact messages changed:

For `title-too-long`, expect:

```ts
message: "Title is longer than 90 characters.",
```

This remains the same under paper profile.

For `size-out-of-range`, existing test only maps rule IDs and does not need changes.

For `font-size-small`, existing test only maps paths and does not need changes.

For any newly failing exact message caused by size range suggestions, prefer asserting `ruleId` and `path` unless the message is the tested behavior.

- [ ] **Step 6: Run focused checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

Expected: lint tests pass and typecheck passes.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/cli/src/core/lint-rules.ts packages/cli/src/core/lint.ts packages/cli/test/lint.test.ts
git commit -m "feat: apply lint profile thresholds"
```

## Task 3: Add CLI Profile Option

**Files:**
- Modify: `packages/cli/src/commands/lint.ts`
- Modify: `packages/cli/test/lint.test.ts`

- [ ] **Step 1: Write failing command tests**

Append these tests inside `describe("lint command", () => { ... })` in `packages/cli/test/lint.test.ts`:

```ts
  test("passes profile option to lint runner", async () => {
    let receivedInputPath = "";
    let receivedProfileName: string | undefined;

    const output = await runLintCommandWithRunner(
      ["lint", "chart.vl.json", "--profile", "acl"],
      async (inputPath, profileName) => {
        receivedInputPath = inputPath;
        receivedProfileName = profileName;
        return cleanLintResult();
      },
    );

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
    expect(receivedInputPath).toBe("chart.vl.json");
    expect(receivedProfileName).toBe("acl");
  });

  test("propagates unknown profile errors", async () => {
    await expect(
      runLintCommandWithRunner(
        ["lint", "chart.vl.json", "--profile", "unknown"],
        async () => cleanLintResult(),
      ),
    ).rejects.toThrow(
      'Unknown lint profile "unknown". Expected one of: paper, web, acl.',
    );
  });
```

Append this helper near `runLintCommand()`:

```ts
async function runLintCommandWithRunner(
  args: string[],
  runLint: (inputPath: string, profileName: string | undefined) => Promise<LintResult>,
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

Keep existing `runLintCommand(args, result)` helper by rewriting it to call the new helper:

```ts
async function runLintCommand(
  args: string[],
  result: LintResult,
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  return runLintCommandWithRunner(args, async () => result);
}
```

- [ ] **Step 2: Run focused test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
```

Expected: FAIL because `registerLintCommand()` does not expose `--profile` and `RunLint` does not accept `profileName`.

- [ ] **Step 3: Implement CLI profile option**

Modify `packages/cli/src/commands/lint.ts`.

Add import:

```ts
import { getLintProfile } from "../core/lint-profiles";
```

Update `LintOptions`:

```ts
type LintOptions = {
  json?: boolean;
  strict?: boolean;
  profile?: string;
};
```

Update `RunLint`:

```ts
type RunLint = (
  inputPath: string,
  profileName: string | undefined,
) => Promise<LintResult>;
```

Update default `runLint`:

```ts
  runLint: RunLint = (inputPath, profileName) =>
    lintSpec({ inputPath, profileName }),
```

Add command option:

```ts
    .option("--profile <name>", "lint profile: paper, web, or acl")
```

Update action:

```ts
    .action(async (inputPath: string, options: LintOptions) => {
      if (options.profile !== undefined) {
        getLintProfile(options.profile);
      }

      const result = await runLint(inputPath, options.profile);
      const exitCode = getLintExitCode(result, Boolean(options.strict));
      // existing output and exit-code logic
    });
```

The explicit `getLintProfile()` call ensures injected command tests also reject unknown profiles before the runner executes. The default runner also resolves the same profile through `lintSpec()`.

- [ ] **Step 4: Run focused and broad checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/lint-profiles.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/cli/src/commands/lint.ts packages/cli/test/lint.test.ts
git commit -m "feat: add lint profile option"
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

- [ ] **Step 2: Run profile smoke commands**

Create a temporary profile-sensitive spec:

```bash
tmp_spec="/tmp/vega-paper-profile-lint-$$.vl.json"
printf '%s\n' '{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","title":"Profile smoke","width":1000,"height":700,"data":{"values":[{"x":1,"y":2},{"x":2,"y":3}]},"mark":"line","encoding":{"x":{"field":"x","type":"quantitative","title":"X"},"y":{"field":"y","type":"quantitative","title":"Y"}}}' > "$tmp_spec"
```

Run paper and web:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --profile paper
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --profile web
```

Expected:

- paper output includes `size-out-of-range`.
- web output does not include `size-out-of-range`.

- [ ] **Step 3: Run JSON smoke**

```bash
json_output=$(PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --profile web --json)
printf '%s' "$json_output" | PATH="$HOME/.bun/bin:$PATH" bun -e 'const chunks=[]; for await (const chunk of Bun.stdin.stream()) chunks.push(chunk); const text=new TextDecoder().decode(Buffer.concat(chunks)); const parsed=JSON.parse(text); if (!Array.isArray(parsed.issues)) process.exit(2); if (parsed.issues.some((issue)=>issue.ruleId === "size-out-of-range")) process.exit(3); console.log("PARSED_WEB_PROFILE=ok");'
```

Expected:

```text
PARSED_WEB_PROFILE=ok
```

- [ ] **Step 4: Run unknown profile smoke**

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper lint "$tmp_spec" --profile unknown
```

Expected: exits `1` and prints:

```text
vega-paper: Unknown lint profile "unknown". Expected one of: paper, web, acl.
```

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: clean implementation worktree. In the main checkout, pre-existing untracked `docs/initial-design.md` may remain and must not be committed unless explicitly requested.

- [ ] **Step 6: Commit verification fixes if needed**

If acceptance verification required code changes:

```bash
git add packages/cli/src/core/lint-profiles.ts packages/cli/src/core/lint-rules.ts packages/cli/src/core/lint.ts packages/cli/src/commands/lint.ts packages/cli/test/lint.test.ts packages/cli/test/lint-profiles.test.ts
git commit -m "fix: complete lint profile verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: this plan covers `paper`, `web`, and `acl`, default `paper`, threshold extraction, CLI `--profile`, core `profileName`, profile-sensitive rules, unknown profile error behavior, unchanged `LintResult`, and smoke tests.
- Deferred scope remains explicit: no custom profiles, no auto-detection, no rendered-output lint, no markdown reports, no suppressions, and no auto-fix.
- Type consistency: `LintProfileName`, `LintProfile`, `getLintProfile`, `LintRequest.profileName`, and `LintRuleContext.profile` are introduced before later tasks use them.
