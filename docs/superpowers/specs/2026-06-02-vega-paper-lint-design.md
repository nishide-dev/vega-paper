# VegaPaper Lint Design

## Context

VegaPaper currently has a Bun-first CLI that can render themed Vega/Vega-Lite specs to SVG, inspect installed themes, and diagnose render readiness with `doctor`. The next CLI MVP slice is `vega-paper lint`: a static quality check for academic chart specs before rendering.

This first lint slice is Vega-Lite first. It reads a JSON spec, classifies clear failures as errors, reports paper-chart quality concerns as warnings, and produces both human-readable and machine-readable output.

## Goals

- Add `vega-paper lint <spec>` for static Vega/Vega-Lite spec checks.
- Keep lint independent from rendering so it is fast and stable.
- Distinguish blocking `error` issues from quality `warning` issues.
- Support `--json` output for AI agents and CI.
- Support `--strict` so warning-only results can fail CI when desired.
- Reuse existing JSON/spec helpers and CLI formatting patterns.

## Non-Goals

- No rendered SVG inspection in this slice.
- No PDF or PNG checks.
- No profile CLI option yet.
- No automatic spec repair.
- No score or grade system.
- No deep Vega mark analysis beyond generic spec readability/type checks.

## CLI Behavior

Initial commands:

```bash
vega-paper lint chart.vl.json
vega-paper lint chart.vl.json --json
vega-paper lint chart.vl.json --strict
```

The CLI uses an internal default `paper` profile, but does not expose `--profile` yet.

### Human Output

When issues exist:

```text
2 warnings, 0 errors
severity  rule                path          message
warning   axis-title-missing  $.encoding.x  X axis is missing a title.
warning   size-missing        $             Width or height is missing.
```

When no issues exist:

```text
No lint issues found.
```

Human output should end with a newline.

### JSON Output

`--json` prints JSON only, with no human text mixed in:

```json
{
  "ok": false,
  "errorCount": 0,
  "warningCount": 2,
  "issues": [
    {
      "severity": "warning",
      "ruleId": "axis-title-missing",
      "path": "$.encoding.x",
      "message": "X axis is missing a title.",
      "suggestion": "Add encoding.x.title."
    }
  ]
}
```

### Exit Codes

- Exit `1` if any `error` issue exists.
- Exit `1` if `--strict` is set and any `warning` issue exists.
- Exit `0` for warning-only results without `--strict`.
- Exit `0` when there are no issues.

## Architecture

Add a core lint engine and a thin CLI wrapper.

### Files

- Create `packages/cli/src/core/lint.ts`
  - Defines the lint result types and public `lintSpec()` function.
  - Loads the spec, detects type, handles read/type errors as lint issues.
  - Runs the configured static rules.
- Create `packages/cli/src/core/lint-rules.ts`
  - Defines the MVP rule list as small rule functions.
  - Keeps rule logic separate from file loading and CLI output.
- Create `packages/cli/src/commands/lint.ts`
  - Registers `vega-paper lint <spec>`.
  - Handles `--json`, `--strict`, output formatting, and exit code.
- Modify `packages/cli/src/index.ts`
  - Registers the lint command alongside render, themes, and doctor.
- Create `packages/cli/test/lint.test.ts`
  - Covers core lint behavior and command behavior.

### Type Shape

```ts
export type LintSeverity = "error" | "warning";

export type LintIssue = {
  severity: LintSeverity;
  ruleId: string;
  path: string;
  message: string;
  suggestion?: string;
};

export type LintResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
};

export type LintRequest = {
  inputPath: string;
};
```

`ok` is true when the core result has no `error` issues. The core result does not know about `--strict`; the command applies strict exit behavior without changing the core result shape.

### Data Flow

```text
lint command
  -> lintSpec({ inputPath })
  -> loadJsonSpec()
  -> detectSpecType()
  -> run static rules
  -> command formats result
  -> command sets exit code
```

## Rule Set

Rules are intentionally heuristic where needed. Heuristic quality checks should report warnings, not errors.

### Errors

#### `spec-unreadable`

The input file cannot be read as a JSON object.

- Severity: `error`
- Path: `$`
- Message should include the input path and a concise reason.

#### `spec-unknown-type`

The JSON object cannot be detected as Vega or Vega-Lite using existing `detectSpecType()`.

- Severity: `error`
- Path: `$`
- Suggestion: add a Vega/Vega-Lite `$schema` or recognizable chart fields.

### Warnings

#### `title-too-long`

Top-level `title` is too long for a paper figure.

- Applies to string titles.
- Threshold: more than 90 characters.
- Path: `$.title`

#### `axis-title-missing`

Vega-Lite `encoding.x` or `encoding.y` has a `field` but no explicit `title`.

- Applies to Vega-Lite only.
- Path: `$.encoding.x` or `$.encoding.y`
- Suggestion: add `encoding.<channel>.title`.

#### `size-missing`

Top-level `width` or `height` is missing.

- Path: `$`
- Message should name the missing dimension or dimensions.

#### `size-out-of-range`

Top-level numeric `width` or `height` is outside the initial paper range.

- Width warning: `< 180` or `> 720`
- Height warning: `< 120` or `> 540`
- Path: `$.width` or `$.height`

#### `inline-data-large`

Inline `data.values` has more than 500 rows.

- Applies when `data.values` is an array.
- Path: `$.data.values`
- Suggestion: use external data or pre-aggregate before rendering.

#### `legend-too-many-categories`

Vega-Lite has a color encoding field and inline data contains more than 12 unique values for that field.

- Applies to Vega-Lite only.
- Only runs when `encoding.color.field` and array `data.values` are present.
- Path: `$.encoding.color`

#### `font-size-small`

Configured font sizes are likely too small for paper figures.

- Check known config paths such as:
  - `$.config.axis.labelFontSize`
  - `$.config.axis.titleFontSize`
  - `$.config.legend.labelFontSize`
  - `$.config.legend.titleFontSize`
- Warn when numeric value is less than 8.

#### `bar-y-axis-zero-missing`

Vega-Lite bar chart with quantitative y encoding should explicitly keep y-axis zero behavior.

- Applies when `mark` is `bar` or `{ "type": "bar" }`.
- Applies when `encoding.y.type` is `quantitative`.
- Warn when `encoding.y.scale.zero` is missing or explicitly false.
- Path: `$.encoding.y.scale`

## Error Handling

Lint should return structured issues for invalid inputs rather than throwing user-facing `VegaPaperError` for expected lint failures.

- File read failures, invalid JSON, and non-object JSON become `spec-unreadable`.
- Unknown spec type becomes `spec-unknown-type`.
- Unexpected internal exceptions may still throw; command-level handling can follow existing CLI error behavior.
- Missing `<spec>` argument remains Commander behavior.

This keeps `--json` useful for automation even when input is invalid.

## Testing

### Core Tests

- Clean minimal Vega-Lite spec returns no issues.
- Invalid JSON returns `spec-unreadable` error.
- Unknown JSON object returns `spec-unknown-type` error.
- Missing x/y axis title returns `axis-title-missing`.
- Long title returns `title-too-long`.
- Missing width/height returns `size-missing`.
- Out-of-range width/height returns `size-out-of-range`.
- Large inline data returns `inline-data-large`.
- Too many color categories returns `legend-too-many-categories`.
- Small configured font size returns `font-size-small`.
- Bar chart y zero issue returns `bar-y-axis-zero-missing`.
- Vega specs are accepted but only generic rules apply in this slice.

### Command Tests

- Human output includes a summary and issue table.
- Human output says `No lint issues found.` when clean.
- `--json` output parses and contains no human text.
- Warning-only lint exits `0` without `--strict`.
- Warning-only lint exits `1` with `--strict`.
- Error issues exit `1`.
- Command tests should inject lint results and exit-code setters where needed to avoid global `process.exitCode` leaks.

### Smoke Commands

```bash
vega-paper lint examples/basic-line/chart.vl.json
vega-paper lint examples/basic-line/chart.vl.json --json
```

## Deferred Work

- Rendered SVG linting for actual visual output.
- `--profile acl|paper|web` thresholds.
- Markdown reports.
- Rule suppression comments or ignore files.
- Auto-fix or repair suggestions that modify specs.
- Deep Vega mark and scale analysis.
- Grayscale contrast simulation.
