# VegaPaper Render MVP Design

Date: 2026-06-01

## Context

VegaPaper is an AI-friendly CLI, theme toolkit, and Skill for creating publication-ready academic figures with Vega and Vega-Lite. The broader project includes rendering, chart inference, linting, themes, an AI Skill, and a future MCP wrapper.

The first implementation slice will prove the core value quickly: a user can pass a Vega-Lite JSON spec to `vega-paper`, apply a named paper-ready theme, and generate an SVG artifact reproducibly from the command line.

The repository is currently at the initial design stage. `docs/initial-design.md` contains the broad product direction. No implementation files exist yet.

## Goals

- Create a Bun-first TypeScript workspace.
- Add a minimal CLI package and a themes package.
- Implement `vega-paper render` for SVG output.
- Support a successful path from `.vl.json` input to themed `.svg` output.
- Keep rendering behind a backend boundary so future Node, Bun-native, or MCP integrations do not require rewriting the CLI.
- Provide clear errors for missing files, unknown themes, missing output paths, missing Vega CLI binaries, and render failures.
- Add focused tests for pure logic and one example-driven render path once dependencies are available.

## Non-Goals

- No MCP server in this slice.
- No GUI or interactive editor.
- No full natural-language chart generation.
- No PDF or PNG output yet.
- No full `infer` implementation yet.
- No complete paper-quality `lint` implementation yet.
- No production-ready Skill packaging yet.

## User-Facing CLI

The initial success case is:

```bash
vega-paper render chart.vl.json --theme paper-clean --format svg --out figures/chart.svg
```

Initial options:

- `--theme <name>` applies a theme from `packages/themes`.
- `--format <format>` accepts `svg` for this slice.
- `--out <path>` writes the rendered SVG.
- `--config <path>` may be reserved in the command shape, but custom config merging can be deferred unless it is cheap to include.

If the user omits `--format`, the CLI can infer `svg` from an `.svg` output path. If both are missing or ambiguous, it should fail with a direct message.

## Architecture

The initial workspace should contain:

```text
packages/
  cli/
    src/
      index.ts
      commands/
        render.ts
      core/
        render.ts
        spec.ts
        theme.ts
        diagnostics.ts
      backends/
        external-vega-cli.ts
      test/
  themes/
    src/
      index.ts
      paper-clean.ts
      acl-clean.ts
      shadcn-light.ts
      monochrome-print.ts
examples/
  basic-line/
    chart.vl.json
```

`packages/cli` owns argument parsing and command behavior. `packages/themes` owns theme metadata and Vega/Vega-Lite config objects. The CLI should consume themes through package exports, not by reading source files directly.

## Components

### Theme Package

Themes are TypeScript exports, not JSON files. This keeps metadata and config together and allows tests to validate shape.

```ts
export interface VegaPaperTheme {
  name: string;
  displayName: string;
  description: string;
  target: "paper" | "slide" | "web" | "poster";
  mode: "light" | "dark" | "print";
  config: Record<string, unknown>;
}
```

Initial themes:

- `paper-clean`
- `acl-clean`
- `shadcn-light`
- `monochrome-print`

### Spec Core

`core/spec.ts` should load JSON, detect whether it is Vega-Lite or Vega, and apply theme config.

Detection can be conservative:

- Vega-Lite if `$schema` contains `vega-lite`, or if the spec has common Vega-Lite fields such as `mark` and `encoding`.
- Vega if `$schema` contains `/vega/`, or if the spec has low-level Vega fields such as `marks` and `scales`.
- Unknown specs should fail with a useful diagnostic rather than guessing.

Theme application should prefer explicit user spec config over theme defaults when there is a conflict. That means the merged output should keep `spec.config` values as the strongest local override.

### Render Core

`core/render.ts` should accept a structured render request:

```ts
type RenderRequest = {
  inputPath: string;
  outputPath: string;
  format: "svg";
  themeName?: string;
};
```

It should load and theme the spec, choose a backend command, and return a result object that includes output path and any warnings.

### External Vega CLI Backend

`backends/external-vega-cli.ts` should invoke official Vega tooling through local binaries, such as `vl2svg` for Vega-Lite and `vg2svg` for Vega. The first implementation can write a temporary themed spec and pass that to the external command.

The backend must treat the external command as replaceable. Later implementations may use direct JavaScript APIs or a Node subprocess specialized for rendering.

## Data Flow

```text
CLI args
  -> render command validation
  -> load JSON spec
  -> detect Vega-Lite or Vega
  -> resolve theme by name
  -> merge theme config into spec
  -> write temporary themed spec
  -> run vl2svg or vg2svg
  -> write final SVG
  -> report output path
```

SVG is the canonical output for this slice. Generated Vega specs, themed specs, PDF, and PNG are future additions.

## Error Handling

The CLI should exit non-zero and print direct diagnostics for:

- Missing input file.
- Invalid JSON.
- Unknown or unsupported spec type.
- Unknown theme.
- Unsupported format.
- Missing or ambiguous output path.
- Missing `vl2svg` or `vg2svg` binary.
- External render command failure.
- Output directory write failure.

Messages should be written for both humans and AI agents: state what failed, the relevant file or option, and the likely next action.

## Testing

Use `bun test`.

Initial unit tests:

- Theme lookup returns known themes and rejects unknown names.
- Spec detection distinguishes Vega-Lite, Vega, and unknown JSON.
- Theme merge preserves explicit spec config overrides.
- Render option validation rejects unsupported formats and missing output paths.

Initial integration test:

- Render `examples/basic-line/chart.vl.json` with `paper-clean` to SVG when Vega CLI dependencies are installed.

If external Vega binaries are unavailable in a test environment, the integration test should skip with a clear reason rather than fail the whole suite.

## Implementation Order

1. Install or enable Bun locally.
2. Create the Bun workspace and package structure.
3. Add `packages/themes` with the initial theme registry and tests.
4. Add `packages/cli` with command parsing and `render`.
5. Add spec detection and theme merge logic.
6. Add the external Vega CLI backend.
7. Add a minimal example Vega-Lite chart.
8. Run unit tests.
9. Run the example render path and verify an SVG is produced.

## Open Decisions

- CLI parser choice can be decided during implementation. A lightweight parser is acceptable for this first slice, but a small library is fine if it reduces boilerplate.
- Custom `--config` merging can be deferred if it slows the first render path.
- Direct Vega spec rendering can be implemented structurally now, but the first verified success path should remain Vega-Lite to SVG.

## Acceptance Criteria

- `bun test` passes.
- `vega-paper render examples/basic-line/chart.vl.json --theme paper-clean --format svg --out examples/basic-line/output.svg` produces an SVG.
- Unknown theme names fail with a clear message.
- Missing Vega CLI binaries fail with an actionable message.
- The implementation keeps themes, spec handling, and backend execution in separate modules.
