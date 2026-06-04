# VegaPaper Roadmap

**Last updated:** 2026-06-04 (Phase 4c spec)

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
| 4a | CLI distribution & install | **Done** (tag `v0.1.0` for public curl install) |
| 4b | Custom themes | **Done** |
| 4.5 | Output formats (PNG / PDF) | **Done** |
| 4c | Curated design palettes | **Done** |
| 5 | MCP wrapper | **Deferred** (after 4c; thin CLI wrapper, low impact on figure aesthetics) |
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

## Phase 4a: CLI distribution & install — Done

**Goal:** Use `vega-paper` outside a monorepo checkout. Primary UX: **`curl -fsSL …/install.sh | bash`** → downloads **GitHub Release** assets → `vega-paper` on PATH (with `vl2svg` / `vg2svg` bundled or shimmed).

**Distribution model:** GitHub Release binaries only — **no npm publish**.

Spec: [`superpowers/specs/2026-06-03-vega-paper-github-release-install-design.md`](./superpowers/specs/2026-06-03-vega-paper-github-release-install-design.md) (supersedes npm paths in the 4a-1 distribution spec)

### Phase 4a-1 — Done

1. **`dist/` builds** — compiled CLI bundle for release packaging
2. **`install.sh` skeleton** — prefix layout, shims, `--from-repo` for dev/CI
3. **Install-root resolution** — `VEGA_PAPER_HOME`, Vega CLI lookup from any cwd
4. **`doctor` + docs** — README, SKILL.md; CI `install:smoke` via `--from-repo`

### Phase 4a-2 — Done

1. **`build-release-tarball.sh`** — compile CLI + vendored Vega CLIs per target
2. **`install.sh` Release path** — GitHub download, `current` symlink, production shims
3. **`release.yml`** — matrix build on tags; attach tarballs to Release
4. **`install:tarball-smoke`** — CI validates tarball install + render
5. **`docs/releases/`** — versioned release notes used as GitHub Release body

Public install: tag `v0.1.0` (or later) + `curl | bash`.

**Why before MCP:** MCP wraps the CLI; external clients need a stable install story first.

**Current dev-repo invocation (unchanged for contributors):**

```bash
bun run packages/cli/src/index.ts --help
```

---

## Phase 4b: Custom themes — Done

**Goal:** Load user theme config (JSON) in addition to built-in TypeScript presets.

**Spec:** [`superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md`](./superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md)  
**Plan:** [`superpowers/plans/2026-06-04-vega-paper-custom-themes.md`](./superpowers/plans/2026-06-04-vega-paper-custom-themes.md)

Delivered:

- `resolveThemeRef` / `loadThemeFromFile` in `@vega-paper/themes`
- `--theme <name|path>` on `render` and `infer`
- `themes show` for custom JSON files
- `examples/custom-theme/` + README / Skill docs

---

## Phase 4.5: Output formats (PNG / PDF) — Done

**Goal:** Extend `render` and `infer` beyond SVG while keeping **SVG the canonical artifact**.

**Spec:** [`superpowers/specs/2026-06-04-vega-paper-output-formats-design.md`](./superpowers/specs/2026-06-04-vega-paper-output-formats-design.md)  
**Plan:** [`superpowers/plans/2026-06-04-vega-paper-output-formats.md`](./superpowers/plans/2026-06-04-vega-paper-output-formats.md)

Delivered:

- `--format svg|png|pdf` + `--scale` on `render` and `infer`
- Six Vega CLI shims in tarball / `doctor` / `--from-repo` install
- Figure meta `format` / `scale`; tarball smoke renders PNG

---

## Phase 4c: Curated design palettes — Done

**Goal:** Replace ad hoc built-in series colors with **attributed, professionally designed palettes** (product/media + popular curated design systems).

**Spec:** [`superpowers/specs/2026-06-04-vega-paper-curated-palettes-design.md`](./superpowers/specs/2026-06-04-vega-paper-curated-palettes-design.md)  
**Plan:** [`superpowers/plans/2026-06-04-vega-paper-curated-palettes.md`](./superpowers/plans/2026-06-04-vega-paper-curated-palettes.md)

Delivered:

- Palette registry: Carbon categorical, FT lineWeb, Catppuccin Latte/Mocha
- Built-in themes wired to `paletteId` + attribution
- `themes show` surfaces palette source
- [`docs/palettes.md`](./palettes.md) (regenerate `examples/theme-samples/` locally via `bun run render:theme-samples`; SVGs are gitignored)

Target release: **v0.1.3** (tag pending).

**Why before MCP:** MCP does not improve chart aesthetics; palette curation addresses the primary design concern.

---

## Phase 5: MCP wrapper — Deferred

Thin MCP server over the stable CLI (stdio first; Cursor / Claude Desktop). **Implement after Phase 4c** unless an external MCP-only client becomes the blocker.

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
- Dual-format single command (SVG + PNG in one invocation)
- `--format vg|vl` spec export

---

## How to propose changes

1. Update this file when a phase completes or priority shifts.
2. Add a dated design under `docs/superpowers/specs/` before implementation.
3. Do **not** rewrite `initial-design.md` §13; add a cross-link here instead.
