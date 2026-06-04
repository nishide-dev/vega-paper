# README Gallery (Phase 4d)

**Status:** Approved for implementation planning  
**Depends on:** Phase 4c curated palettes (v0.1.3), Phase 4.5 PNG output

## Problem

GitHub visitors see command snippets but **no rendered figures** in the root `README.md` or `examples/README.md`. After v0.1.3 palette refresh, visual proof of theme and chart quality matters for adoption.

Today:

- `examples/**/output.svg` and `examples/theme-samples/*.{svg,meta.json}` are **gitignored**
- Docs describe `bun run render:theme-samples` but images do not appear on GitHub

## Goals

1. Commit **PNG previews** under `docs/assets/gallery/` for README embedding.
2. **Theme gallery:** same spec × all 8 built-in themes (G1).
3. **Example gallery:** one PNG per approved example folder (G2).
4. Single script `bun run render:gallery` regenerates all committed PNGs.
5. Update root `README.md` and `examples/README.md` with image grids and links.

## Non-goals

- HTML / interactive gallery site
- Committing SVG or PDF gallery assets (PNG only for README)
- Replacing per-folder `output.svg` local workflow (stay gitignored)
- Composite single-image collages (maintain one PNG per theme/example)
- CI gallery diff gate in v1 (optional follow-up; PR checklist is enough initially)

## Asset layout

```text
docs/assets/gallery/
  themes/
    paper-clean.png
    acl-clean.png
    neurips-clean.png
    shadcn-light.png
    shadcn-dark.png
    nature-soft.png
    monochrome-print.png
    poster-dark.png
  examples/
    basic-line.png
    training-curve.png
    confusion-matrix.png
    faceted-training.png
    boxplot.png
    custom-theme.png
```

**Format:** PNG via `render --format png --scale 2`  
**Not gitignored** — these paths are the committed visual baseline for docs.

Existing gitignore entries for `examples/**/output.svg` and `examples/theme-samples/*` remain unchanged.

## Generation script

**File:** `scripts/render-gallery.ts`  
**npm script:** `"render:gallery": "bun scripts/render-gallery.ts"`

### CLI invocation

Use the same pattern as `scripts/render-theme-samples.ts`:

```text
bun run packages/cli/src/index.ts render <spec> --theme <name> --format png --scale 2 --out <path>
```

Exit non-zero if any render fails.

### Theme renders

| Output | Spec | Theme |
|--------|------|-------|
| `themes/<name>.png` | `examples/basic-line/chart.vl.json` | each built-in from `listThemes()` |

### Example renders

All examples use **`paper-clean`** unless noted. Render committed `chart.vl.json` (or path below).

| Output | Spec | Notes |
|--------|------|-------|
| `examples/basic-line.png` | `examples/basic-line/chart.vl.json` | hand-written spec |
| `examples/training-curve.png` | `examples/training-curve/chart.vl.json` | infer line + color |
| `examples/confusion-matrix.png` | `examples/confusion-matrix/chart.vl.json` | heatmap |
| `examples/faceted-training.png` | `examples/faceted-training/chart.vl.json` | facet |
| `examples/boxplot.png` | `examples/boxplot/chart.vl.json` | boxplot |
| `examples/custom-theme.png` | `examples/custom-theme/chart.vl.json` | `--theme examples/custom-theme/theme.json` |

Do not add a separate `theme-samples/` PNG set — the eight theme PNGs cover theme comparison.

### Idempotency

Script overwrites PNGs in place. Run from repository root only.

## README updates

### Root `README.md`

Add section **「Figure previews」** (or **「Themes」**) after Quick start:

- 2×4 or wrapped grid of theme PNGs from `docs/assets/gallery/themes/`
- Caption per image: theme name + short use (paper / web / poster / print)
- Link to [`docs/palettes.md`](./palettes.md) for palette sources

Keep section concise; avoid duplicating full theme catalog prose.

### `examples/README.md`

Add section **「Gallery」** after the folder table:

- Grid of six example PNGs from `docs/assets/gallery/examples/`
- Each image links to the corresponding `examples/<folder>/` README
- Note: theme comparison lives in root README / `docs/palettes.md`

### `examples/theme-samples/README.md`

Update intro: committed previews live under `docs/assets/gallery/themes/`; local SVG generation via `render:theme-samples` remains optional for developers.

### `docs/palettes.md`

Add sentence linking to root README theme grid or `docs/assets/gallery/themes/`.

## Dark themes on GitHub

GitHub README background is light. Dark-theme PNGs (`shadcn-dark`, `poster-dark`) render with their theme background in the PNG — no extra border required unless previews look clipped in review.

## Validation

Before merge:

1. `bun run render:gallery` succeeds on a clean checkout with `doctor` passing.
2. All 14 PNG files exist and are committed.
3. Root and `examples/README.md` images load on GitHub (relative paths from repo root).
4. `bun run check && bun test` unchanged (no new test required for v1; optional smoke test that gallery paths exist).

## Maintenance

When **palettes** or **example specs** change:

1. Run `bun run render:gallery`
2. Commit updated PNGs in the same PR

PR checklist item: “If themes or example specs changed, run `render:gallery` and commit PNGs.”

## Roadmap

- **Phase 4d:** this spec
- Optional **4d-2:** CI `git diff --exit-code docs/assets/gallery/` after `render:gallery` on palette/theme changes

## Versioning

No semver bump required solely for gallery PNGs; may ship in **v0.1.4** doc release or bundled with next feature release.
