# VegaPaper Roadmap

**Last updated:** 2026-06-03

This document is the **living roadmap** for VegaPaper. It supersedes §13 in [`initial-design.md`](./initial-design.md) for phase ordering and current status.

- **Product vision and design rationale:** [`initial-design.md`](./initial-design.md) (founding document, mostly frozen)
- **Implementation specs and plans:** [`superpowers/specs/`](./superpowers/specs/) and [`superpowers/plans/`](./superpowers/plans/)

## Phase status

| Phase | Name | Status |
|-------|------|--------|
| 0 | Research & prototype | Done |
| 1 | CLI MVP | Done |
| 2 | AI Skill | Done |
| 3 | Theme expansion | Done |
| 4a | CLI distribution & install | **Next** |
| 4b | Custom themes | Planned |
| 5 | MCP wrapper | Planned |
| 6 | Research workflow integration | Planned |

---

## Phase 0: Research & prototype — Done

- Vega / Vega-Lite CLI behavior verified
- Bun subprocess rendering path confirmed
- SVG output path validated (PDF/PNG deferred)
- Theme config prototype in TypeScript

---

## Phase 1: CLI MVP — Done

Delivered commands and core workflow:

- `render`, `infer`, `lint`, `doctor`, `themes list` / `themes show`
- SVG output, Vega-Lite-first workflow
- Initial themes: `paper-clean`, `acl-clean`, `shadcn-light`, `monochrome-print`
- Examples under `examples/`
- Figure meta sidecars (`*.meta.json`) for `infer` and `render`

See: `docs/superpowers/specs/2026-06-01-vega-paper-render-mvp-design.md` and related infer/lint specs.

---

## Phase 2: AI Skill — Done

- `skills/vega-paper/SKILL.md`
- References: chart selection, theme catalog, paper style guide, Vega-Lite patterns
- Skill scripts: `validate-spec.ts`, `render-chart.ts` (CLI wrappers for agents)
- Cursor install instructions in SKILL.md

---

## Phase 3: Theme expansion — Done

Built-in themes (8 total, registry order):

`paper-clean` → `acl-clean` → `neurips-clean` → `shadcn-light` → `shadcn-dark` → `nature-soft` → `monochrome-print` → `poster-dark`

Also delivered:

- `print` lint profile and grayscale safety rules (`grayscale-unsafe-color`, `color-only-series`)
- `examples/theme-samples/` and `bun run render:theme-samples`

**Not in scope for Phase 3:** user-supplied custom theme files (see Phase 4b).

---

## Phase 4a: CLI distribution & install — Next

**Goal:** Use `vega-paper` outside a monorepo checkout. Primary UX: **`curl -fsSL …/install.sh | bash`** → `vega-paper` on PATH (with `vl2svg` / `vg2svg` shims under the hood).

Spec: [`superpowers/specs/2026-06-03-vega-paper-cli-distribution-design.md`](./superpowers/specs/2026-06-03-vega-paper-cli-distribution-design.md)

### Phase 4a-1 (this slice)

1. **Publishable packages** — `@vega-paper/themes` + `vega-paper` on npm; `dist/` builds; `bunx vega-paper` documented
2. **`install.sh`** — prefix at `~/.local/share/vega-paper`; shims in `~/.local/bin`
3. **Install-root resolution** — Vega CLI and version lookup work from any cwd
4. **`doctor` + docs** — README, SKILL.md updated for installed vs dev-repo usage

### Phase 4a-2 (deferred)

- GitHub Release **compiled binaries** (`bun build --compile`) for Bun-free targets

**Why before MCP:** MCP wraps the CLI; external clients need a stable install story first.

**Current dev-repo invocation (unchanged for contributors):**

```bash
bun run packages/cli/src/index.ts --help
```

---

## Phase 4b: Custom themes — Planned

**Goal:** Load user theme config (JSON) in addition to built-in TypeScript presets.

Likely direction (spec TBD):

- `--theme path/to/theme.json` or named preset + optional override file
- Merge user `config` onto spec (same semantics as built-in themes)
- Lint integration unchanged unless print/grayscale rules need theme-aware checks

**Depends on:** Phase 4a (easier to test and document on an installable CLI).

---

## Phase 5: MCP wrapper — Planned

Thin MCP server over the stable CLI (stdio first; Cursor / Claude Desktop).

Initial tools (from `initial-design.md` §9.2, narrowed for first slice):

- `render_chart`
- `validate_spec`
- `list_themes`

`infer_spec` and `compile_spec` may follow in a later MCP slice.

---

## Phase 6: Research workflow integration — Planned

Former “Phase 5” in `initial-design.md`:

- Python wrapper
- Notebook integration
- LaTeX helper
- GitHub Actions example
- Paper repository template

---

## Explicitly deferred

Items from `initial-design.md` that remain out of scope until a dedicated phase/spec:

- GUI / interactive chart editing
- Direct Overleaf integration
- Full NL → chart intent parser
- Parquet / Arrow input
- Animated charts
- PDF / PNG as first-class outputs (SVG remains canonical)

---

## How to propose changes

1. Update this file when a phase completes or priority shifts.
2. Add a dated design under `docs/superpowers/specs/` before implementation.
3. Do **not** rewrite `initial-design.md` §13; add a cross-link here instead.
