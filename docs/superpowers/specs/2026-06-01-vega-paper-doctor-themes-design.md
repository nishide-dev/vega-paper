# VegaPaper Doctor and Themes CLI Design

Date: 2026-06-01

## Context

VegaPaper now has a working render MVP: a Bun-first CLI can render a themed Vega-Lite spec to SVG through official Vega tooling. The next usability slice should make the installed CLI easier to inspect and diagnose before adding larger features such as `lint` or `infer`.

This design adds a minimal, practical `themes` command group and a `doctor` command.

## Goals

- Add `vega-paper themes list`.
- Add `vega-paper themes show <name>`.
- Add `vega-paper doctor`.
- Support human-readable output by default.
- Support machine-readable `--json` output for AI agents and scripts.
- Reuse the existing theme registry and Vega CLI binary resolution knowledge.
- Keep the scope small: no theme preview gallery, no PDF/PNG rendering, no `lint`, and no `infer`.

## Non-Goals

- No `themes preview` command in this slice.
- No new theme definitions.
- No PDF or PNG readiness enforcement.
- No environment repair/install command.
- No CI integration or GitHub Actions template.

## User-Facing CLI

```bash
vega-paper themes list
vega-paper themes list --json
vega-paper themes show paper-clean
vega-paper themes show paper-clean --json
vega-paper doctor
vega-paper doctor --json
```

## Architecture

Add two command modules and two small core/helper modules:

```text
packages/cli/src/commands/
  themes.ts
  doctor.ts
packages/cli/src/core/
  doctor.ts
  format.ts
```

`commands/themes.ts` should register the `themes` command group and call `@vega-paper/themes` directly. `commands/doctor.ts` should call a core doctor function and handle display and exit behavior. `core/doctor.ts` should produce structured check results. `core/format.ts` should contain small formatting helpers shared by `themes` and `doctor`.

Register both command groups from `packages/cli/src/index.ts`.

## Themes Command

### `themes list`

Default output is a compact table:

```text
name              target  mode   description
paper-clean       paper   light  General publication-ready theme...
acl-clean         paper   light  Compact two-column NLP paper theme...
shadcn-light      web     light  Modern light chart theme...
monochrome-print  paper   print  Grayscale-safe print theme...
```

The command should use the current stable order from `listThemes()`.

### `themes list --json`

Return a JSON array of theme metadata and config. Pretty JSON is acceptable for readability.

### `themes show <name>`

Default output should include:

- `name`
- `displayName`
- `target`
- `mode`
- `description`
- pretty-printed `config`

Unknown themes should fail through `VegaPaperError` so the CLI prints:

```text
vega-paper: Unknown theme "missing-theme"
```

### `themes show <name> --json`

Return the complete theme object as pretty JSON.

## Doctor Command

`doctor` should report whether the current workspace can run the SVG render workflow.

### Check Result Shape

```ts
export type DoctorCheckStatus = "ok" | "warn" | "fail";

export type DoctorCheck = {
  name: string;
  status: DoctorCheckStatus;
  message: string;
  required: boolean;
  details?: Record<string, unknown>;
};
```

### Required Checks

- Bun version is available.
- Node version is available.
- `vega-paper` workspace binary is available from `node_modules/.bin/vega-paper` or equivalent executable path.
- `vl2svg` is resolvable through the same supported layouts used by the render backend.
- `vg2svg` is resolvable through the same supported layouts used by the render backend.

### Optional Checks

- PDF/PNG readiness should be reported as `warn` or informational text only.
- Canvas availability should not block SVG render readiness in this slice.

### Exit Behavior

- Exit `0` if all required checks are `ok`.
- Exit `1` if any required check is `fail`.
- Optional `warn` checks do not make the command fail.

### Human Output

Default output should be a compact status table:

```text
ok    bun             1.3.14
ok    node            v25.9.0
ok    vega-paper bin  node_modules/.bin/vega-paper
ok    vl2svg          node_modules/.bun/.../vega-lite/bin/vl2svg
ok    vg2svg          node_modules/.bun/.../vega-cli/bin/vg2svg
warn  pdf/png         not checked in this MVP
```

### JSON Output

`doctor --json` should print:

```json
{
  "checks": [
    {
      "name": "bun",
      "status": "ok",
      "message": "1.3.14",
      "required": true
    }
  ]
}
```

If required checks fail, the command should still print JSON and then exit `1`.

## Binary Resolution

The render backend already has to support Bun's package-store layout, not only `node_modules/.bin`. `doctor` should reuse or share that binary resolution behavior rather than duplicating divergent path rules.

If the current backend function is not exported in a reusable way, extract a focused helper such as:

```ts
resolveVegaCliBinary(binaryName: "vl2svg" | "vg2svg"): Promise<string | undefined>
```

The helper should not execute the binary; it should only resolve the path.

## Error Handling

- Theme lookup errors should be converted to `VegaPaperError`.
- Doctor required failures should be represented in check results, not thrown, unless the doctor implementation itself crashes unexpectedly.
- JSON mode should not mix human text into stdout.
- Unexpected internal errors should still be caught by the top-level CLI handler.

## Testing

Use `bun test`.

Focused tests:

- `themes list` output includes all four current themes.
- `themes list --json` produces parseable JSON with four themes.
- `themes show paper-clean --json` includes `config`.
- `themes show missing-theme` throws or surfaces `VegaPaperError`.
- Doctor core marks required failures as overall failure.
- Doctor core allows optional warnings without overall failure.
- Binary resolver handles the supported Bun package-store layouts.

CLI smoke tests can invoke the command registration with Commander or run the CLI entrypoint, but should avoid brittle absolute-path assumptions where possible.

## Acceptance Criteria

- `bun test` passes.
- `bun run typecheck` passes.
- `bun run build` passes.
- `vega-paper themes list` displays the four initial themes.
- `vega-paper themes show paper-clean --json` returns JSON containing theme config.
- `vega-paper doctor` exits `0` in the current render-capable workspace.
- `vega-paper doctor --json` returns parseable JSON.
- Unknown theme names produce a `vega-paper:`-prefixed error.
