# VegaPaper Infer Lint Integration Design

## Context

`vega-paper infer` can now generate a Vega-Lite spec from CSV and optionally render SVG through the existing render workflow. The next useful slice is to let `infer` optionally enforce paper-quality checks before rendering, without changing its default lightweight behavior.

The goal of this slice is not to redesign linting. Instead, it connects the existing lint system to the `infer` command so an agent or user can run:

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --lint-profile paper \
  --strict \
  --theme paper-clean \
  --out figures/f1.svg
```

and get a deterministic pipeline:

```text
infer -> write spec -> lint saved spec -> render only if lint passes
```

## Goals

- Add optional lint execution to `vega-paper infer`.
- Keep lint disabled by default so existing `infer` behavior remains unchanged.
- Support `--lint-profile <name>` on `infer`.
- Support `--strict` on `infer` when linting is enabled.
- Lint the saved generated spec artifact, not an in-memory object.
- Reuse existing lint result formatting and exit semantics.
- Prevent rendering when lint fails.
- Preserve the generated spec file even when lint fails.

## Non-Goals

- No changes to lint rule logic or threshold definitions.
- No automatic linting when `--lint-profile` is omitted.
- No new JSON output mode for `infer` in this slice.
- No new pipeline core module.
- No changes to `render`, `lint`, or theme behavior outside the `infer` command integration.

## CLI Behavior

New options on `vega-paper infer`:

```text
--lint-profile <name>  lint profile: paper, web, or acl
--strict               fail on warnings when linting is enabled
```

Behavior rules:

- Lint runs only when `--lint-profile` is provided.
- The lint target is the saved generated Vega-Lite spec path:
  - `--spec-out <path>` if specified
  - otherwise the sibling `.vl.json` path derived from `--out`
- If lint finds no issues, `infer` continues normally.
- If lint finds issues:
  - human-readable output matches `vega-paper lint`
  - render is skipped
  - exit behavior follows existing lint semantics
- Exit behavior:
  - any lint `error` causes failure
  - `warning` causes failure only when `--strict` is present
- `--strict` without `--lint-profile` is invalid and should raise:
  - `The "--strict" option requires "--lint-profile <name>".`
- Unknown lint profiles should surface the same `VegaPaperError` behavior as the `lint` command.

Examples:

```bash
# Spec generation only, no lint
vega-paper infer results.csv --chart line --x epoch --y f1 --spec-out figures/f1.vl.json

# Lint generated spec, then render only if clean enough
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --lint-profile paper \
  --out figures/f1.svg

# Treat warnings as blocking
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --lint-profile acl \
  --strict \
  --out figures/f1.svg
```

## Architecture

This slice extends the existing command-layer orchestration instead of introducing a new pipeline abstraction.

### Command Layer

Update `packages/cli/src/commands/infer.ts`:

- parse `lintProfile` and `strict`
- save the generated spec as today
- if `lintProfile` is set:
  - validate the profile through the existing lint profile path
  - run `lintSpec({ inputPath: specOutputPath, profileName: lintProfile })`
  - print lint output using the same human-readable formatting rules as `lint`
  - determine pass/fail using the same exit code logic as `lint`
- only call `renderChart()` if lint passes or lint is not requested

The command remains the orchestration boundary for:

```text
infer core -> write spec -> lint optional -> render optional
```

### Reuse From Existing Lint Command

Reuse existing lint command semantics where practical:

- profile validation
- lint exit code logic
- human-readable lint output

If small extraction is needed to share formatter logic between `commands/lint.ts` and `commands/infer.ts`, keep it narrow and local to command concerns.

### Core Modules

No new infer core module is introduced for this slice.

- `packages/cli/src/core/infer.ts` remains unchanged unless small type or helper adjustments become necessary.
- `packages/cli/src/core/lint.ts` remains the source of lint execution.

## Data Flow

With lint enabled:

```text
vega-paper infer ... --lint-profile paper --out figures/f1.svg
  -> parse infer options
  -> resolve spec output path
  -> inferVegaLiteSpec(...)
  -> write figures/f1.vl.json
  -> lintSpec({ inputPath: "figures/f1.vl.json", profileName: "paper" })
  -> if lint passes, renderChart(...)
  -> if lint fails, stop before render
```

Without lint enabled, `infer` behavior stays as it is today.

## Error Handling

Use `VegaPaperError` for new user-facing validation failures.

New or newly relevant cases:

- `--strict` without `--lint-profile`
- unknown `--lint-profile`
- lint failures block rendering but do not delete the generated spec

Behavior on lint failure:

- the generated spec file remains on disk
- render is not attempted
- the user sees the same human-readable issue output shape as `vega-paper lint`

This is intentional: the saved spec is the artifact the user or agent should fix next.

## Testing

Add focused command tests in `packages/cli/test/infer-command.test.ts` for:

- `--lint-profile` causes lint runner invocation on the saved spec path
- lint pass allows render to proceed
- lint error prevents render
- lint warning with `--strict` prevents render
- lint warning without `--strict` still allows render
- lint profile value is passed through correctly
- `--strict` without `--lint-profile` throws `VegaPaperError`
- unknown lint profile throws `VegaPaperError`
- existing `infer` behavior without lint remains unchanged

Verification before completion:

- `bun test`
- `bun run typecheck`
- `bun run build`

## Implementation Notes

This slice is intentionally small and command-focused.

It strengthens the common workflow:

```text
CSV -> generated spec -> quality gate -> rendered figure
```

without widening the public surface area of `infer` beyond two targeted options.
