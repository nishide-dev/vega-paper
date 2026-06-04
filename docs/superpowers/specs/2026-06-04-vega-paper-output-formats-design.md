# Output Formats Design (Phase 4.5)

Date: 2026-06-04

## Context

Phase 4b shipped custom themes. Phase 5 (MCP) will wrap the CLI (`render_chart`, etc.). Today **`render` and `infer` support SVG only**; Release tarballs ship **`vl2svg` / `vg2svg` shims only**.

`initial-design.md` §10 describes SVG / PDF / PNG roles; §14.4 says **SVG is the canonical artifact**, PNG/PDF are derivatives. Roadmap currently defers “PDF / PNG as first-class outputs” — this phase clarifies: **first-class CLI support, SVG remains canonical**.

**User decision:** Approach **A** — Phase 4.5 before MCP, narrow scope.

**Roadmap:** Insert between 4b and 5; update [`docs/roadmap.md`](../../roadmap.md).

## Goals

1. **`render --format svg|png|pdf`** with matching `--out` extension inference.
2. **`infer --out`** accepts `.svg`, `.png`, `.pdf` (same render path after lint).
3. **`--scale <number>`** for raster output (PNG; PDF if Vega CLI supports scale on `vl2pdf` — verify at implementation).
4. **Vega CLI binaries** resolved and checked: `vl2svg`, `vl2png`, `vl2pdf`, `vg2svg`, `vg2png`, `vg2pdf`.
5. **Release tarball + `doctor`** include all six shims (same pattern as today).
6. **Figure meta** records `format` and optional `scale` on render/infer outputs.
7. **Docs / Skill** — SVG default for papers; when to use PNG/PDF.

## Non-Goals (Phase 4.5)

- Changing canonical artifact policy (SVG + `.vl.json` + `.meta.json`; PNG/PDF are exports)
- `--format vg|vl` (compiled spec export)
- `--ppi` on PNG (Vega-Lite newer flag — defer unless trivial during impl)
- Dual output in one command (e.g. emit SVG + PNG together)
- Post-processing (ImageMagick, LaTeX `\\includegraphics` helpers) — Phase 6
- MCP server implementation — Phase 5 follows this phase

## Approaches considered

| Approach | Summary | Trade-off |
|----------|---------|-----------|
| **A. Vega CLI binaries (chosen)** | Call `vl2png` / `vl2pdf` like `vl2svg` | Matches install model; depends on vega-lite/vega-cli bin layout |
| B. SVG then convert | Always render SVG, convert with third-party tool | Extra deps; worse font fidelity for PDF |
| C. vl-convert (Rust) | Single binary, `--scale` | New release artifact matrix; out of Bun/npm stack |

**Recommendation:** **A** — already assumed in `initial-design.md` and tarball design.

## Format model

```ts
type RenderFormat = "svg" | "png" | "pdf";
```

| format | Vega-Lite binary | Vega binary | Notes |
|--------|------------------|-------------|-------|
| `svg` | `vl2svg` | `vg2svg` | Default, vector, git-friendly |
| `png` | `vl2png` | `vg2png` | Raster; supports `--scale` |
| `pdf` | `vl2pdf` | `vg2pdf` | LaTeX submission; font/env quirks |

### Binary resolution

Extend `VegaCliBinaryName` and `resolveVegaCliBinary` — same candidate order as today (install home → workspace `.bin` → package store → PATH).

`getRenderBinary(specType, format)` returns the correct name.

### CLI invocation

**Baseline (SVG today):** positional args `[inputPath, outputPath]`.

**Implementation step:** Run `vl2png --help` / `vl2pdf --help` from staged `node_modules` and lock the argv contract in tests (likely same two-position args as `vl2svg`; PNG may add `-s` / `--scale`).

**`--scale`:**

- Allowed when `format === "png"` (required validation).
- Optional for `pdf` if binary supports it; otherwise reject with clear error.
- Default `1`; must be finite number `> 0` (cap max e.g. `32` to avoid accidental huge raster).

## CLI surface

### `render`

```bash
vega-paper render chart.vl.json --format pdf --out figures/chart.pdf
vega-paper render chart.vl.json --out figures/chart.png --scale 2
```

- Infer format from extension when `--format` omitted: `.svg`, `.png`, `.pdf`.
- Reject extension/format mismatches.
- Update help text; remove “MVP supports only svg” errors.

### `infer`

- Relax `assertSvgOutputPath` → `assertRenderOutputPath` allowing `.svg` | `.png` | `.pdf`.
- Pass `format` + `scale` into render runner (same as explicit `render`).
- Lint still runs on `.vl.json` only (unchanged).

### `doctor`

- Six required checks: `vl2svg`, `vl2png`, `vl2pdf`, `vg2svg`, `vg2png`, `vg2pdf`.
- Messages unchanged pattern (“Install via install.sh…”).

## Figure meta

Add optional fields to `RenderFigureMeta` and `InferFigureMeta` (when render output exists):

```json
{
  "format": "png",
  "scale": 2
}
```

- Omit `format` when it would be redundant? **Include always** on render outputs for traceability.
- Omit `scale` when `1` or when format is `svg`/`pdf` without scale.

## Distribution

### `scripts/build-release-tarball.sh`

```bash
write_tool_shim "vl2svg"
write_tool_shim "vl2png"
write_tool_shim "vl2pdf"
write_tool_shim "vg2svg"
write_tool_shim "vg2png"
write_tool_shim "vg2pdf"
```

### `scripts/install.sh`

Production shims for all six (same as tarball `bin/`).

### CI

- Extend `install:tarball-smoke` to render **one** PNG or PDF sample (or dedicated tiny spec) in addition to SVG.
- Existing integration test may stay SVG-first; add unit tests for format normalization.

## Package layout

```text
packages/cli/src/
  core/render.ts              # RenderFormat union
  backends/external-vega-cli.ts # format → binary, scale args
  commands/render.ts          # normalizeRenderOptions, --scale
  commands/infer.ts           # output path validation
  core/figure-meta.ts         # format + scale fields
  core/doctor.ts              # six binaries

packages/cli/test/
  render-formats.test.ts      # new
  external-vega-cli.test.ts   # extend
  figure-meta.test.ts         # extend
  infer-command.test.ts       # .png/.pdf --out cases
```

## Documentation

| File | Change |
|------|--------|
| `docs/roadmap.md` | Phase 4.5 Planned → Done when shipped; remove PNG/PDF from deferred |
| `README.md` | Output formats table |
| `skills/vega-paper/SKILL.md` | Default SVG; PDF for LaTeX; PNG for README/slides; `--scale` |
| `skills/vega-paper/references/paper-style-guide.md` | Link format guidance if needed |
| `docs/releases/v0.1.2.md` | When released (not in this PR unless user tags) |

## Testing strategy

| Level | Cases |
|-------|--------|
| Unit | `normalizeRenderOptions`: infer format from `.png`/`.pdf`; reject mismatch; scale validation |
| Unit | `getRenderBinary` mapping for vl/vg × svg/png/pdf |
| Unit | figure meta includes format/scale |
| Integration | Render `examples/basic-line` to PNG/PDF when binaries exist (skip if missing, like SVG test) |
| CI | tarball smoke renders non-SVG once |

## Error handling

| Case | Message direction |
|------|-------------------|
| Missing `vl2pdf` | Same as `vl2svg` missing-binary pattern |
| `--scale` with `svg` | `VegaPaperError`: scale only for png (and pdf if supported) |
| Invalid scale | Non-finite or `<= 0` |
| Wrong extension | `--format pdf` with `.png` out path |

## MCP alignment (Phase 5)

MCP `render_chart` schema should accept:

```json
{ "format": "svg" | "png" | "pdf", "scale": number }
```

Default `format: "svg"`. No MCP code in 4.5 — only CLI stability.

## Success criteria

- [ ] `vega-paper render spec.vl.json --format pdf --out fig.pdf` works with installed Release tarball.
- [ ] `infer … --out fig.png --scale 2` works end-to-end.
- [ ] `doctor` reports six binaries.
- [ ] SVG remains documented default; figure meta records format.
- [ ] All tests and `bun run check` pass.

## Open questions (defaults for v1)

1. **PDF `--scale`** — enable if `vl2pdf` supports `-s`; else png-only scale in v1.
2. **Max scale** — default cap `32` (configurable constant).
3. **Release version** — ship as `v0.1.2` after merge (separate from this spec).

Defaults: **probe PDF scale at implementation**; **max scale 32**; **version bump at release time**.
