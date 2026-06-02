# VegaPaper Lint Profiles Design

## Context

`vega-paper lint` currently uses one implicit `paper` profile. Rule thresholds are embedded directly in rule functions, such as title length, figure size ranges, inline row count, color category count, and minimum font size.

This slice exposes profile selection through `vega-paper lint --profile <paper|web|acl>` and moves threshold values into a reusable core profile module. The goal is to let users choose the quality target without changing the lint result shape or adding rendered-output checks.

## Goals

- Add `--profile <paper|web|acl>` to `vega-paper lint`.
- Keep `paper` as the default when no profile is provided.
- Move numeric thresholds out of rule functions and into named profiles.
- Reuse the same profile resolution from CLI and core lint code.
- Preserve existing `LintResult` JSON shape.
- Keep non-threshold rules unchanged.

## Non-Goals

- No user-defined profile files.
- No profile auto-detection.
- No rendered SVG, PDF, or PNG linting.
- No Markdown reports.
- No rule suppression support.
- No automatic repair.
- No changes to `LintResult` fields in this slice.

## Profile Names

Supported profiles:

- `paper`
- `web`
- `acl`

`paper` remains the default.

## Thresholds

Initial threshold values:

| Profile | Title Max | Width Range | Height Range | Inline Rows | Color Categories | Min Font |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| `paper` | 90 | 180-720 | 120-540 | 500 | 12 | 8 |
| `acl` | 70 | 240-480 | 160-360 | 300 | 8 | 9 |
| `web` | 120 | 240-1200 | 160-800 | 1000 | 20 | 10 |

`acl` is stricter for two-column academic paper figures. `web` allows larger display sizes and more categories but still keeps fonts readable on screens.

## Rule Scope

Profile thresholds apply to:

- `title-too-long`
- `size-out-of-range`
- `inline-data-large`
- `legend-too-many-categories`
- `font-size-small`

Profile thresholds do not apply to:

- `axis-title-missing`
- `size-missing`
- `bar-y-axis-zero-missing`
- `spec-unreadable`
- `spec-unknown-type`

Those rules are about explicitness or input validity rather than threshold tuning.

## Architecture

Add `packages/cli/src/core/lint-profiles.ts`.

```ts
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
```

The module exposes:

- `DEFAULT_LINT_PROFILE_NAME`
- `LINT_PROFILES`
- `getLintProfile(profileName?: string): LintProfile`
- `listLintProfileNames(): LintProfileName[]`

`getLintProfile()` returns `paper` when no name is provided. Unknown names throw `VegaPaperError`.

### Data Flow

```text
lint command
  -> parse --profile
  -> lintSpec({ inputPath, profileName })
  -> getLintProfile(profileName)
  -> runLintRules({ inputPath, spec, specType, profile })
  -> rules use profile thresholds
  -> command formats result and sets exit code
```

### Type Changes

- `LintRequest` gains `profileName?: string`.
- `LintRuleContext` gains `profile: LintProfile`.
- `runLintRules()` expects a profile in its context.
- Tests that call `runLintRules()` directly pass `getLintProfile("paper")` by default.

`LintResult` does not gain a profile field in this slice. This preserves the current machine-readable output shape.

## CLI Behavior

Examples:

```bash
vega-paper lint chart.vl.json
vega-paper lint chart.vl.json --profile paper
vega-paper lint chart.vl.json --profile acl
vega-paper lint chart.vl.json --profile web --json
```

The `lint` command adds:

```text
--profile <name>  lint profile: paper, web, or acl
```

`--profile paper` should produce the same warnings as the current default behavior.

## Error Handling

Unknown profile names are CLI/core configuration errors, not spec lint issues.

For example:

```bash
vega-paper lint chart.vl.json --profile unknown
```

throws `VegaPaperError` with this message:

```text
Unknown lint profile "unknown". Expected one of: paper, web, acl.
```

This remains true even when `--json` is also present. The error is not represented as a `LintIssue` because the input spec was not linted.

## Testing

Add tests for:

- `getLintProfile()` returns `paper` by default.
- `getLintProfile("paper")`, `"web"`, and `"acl"` return the expected thresholds.
- `getLintProfile("unknown")` throws `VegaPaperError`.
- Existing rule tests continue to pass under the default `paper` profile.
- `paper` still warns for width `1000`.
- `web` does not warn for width `1000`.
- `acl` warns for 13 color categories.
- `web` does not warn for 13 color categories.
- `acl` warns for font size `8`.
- `paper` does not warn for font size `8`.
- `lintSpec({ profileName: "web" })` uses the web thresholds.
- `registerLintCommand()` passes `--profile acl` to the injected lint runner.
- `registerLintCommand()` propagates unknown profile errors.

Keep focused rule tests in `packages/cli/test/lint.test.ts`. Add a separate `packages/cli/test/lint-profiles.test.ts` if profile module tests become noisy inside the main lint test file.

## Expected User Impact

Users can keep the current default behavior or choose stricter/friendlier thresholds for specific contexts:

- `paper`: current behavior.
- `acl`: stricter academic paper guidance.
- `web`: more permissive layout and category limits for screen-first charts.
