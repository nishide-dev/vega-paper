# Curated Design Palettes (Phase 4c)

**Status:** Approved for implementation planning  
**Supersedes:** ad hoc `range.category` hex in built-in themes (v0.1.x)  
**Release:** v0.2.0 (visual breaking change for series colors)

## Problem

Built-in themes embed six categorical colors as inline hex values. Those colors mix Tailwind tokens, Matplotlib defaults, and hand-picked values without documented design provenance. Users want **professional, named palettes** (product/media data-viz systems and popular curated design palettes), not arbitrary implementation choices.

MCP and CLI presets do not improve color aesthetics. This phase addresses **palette curation only**.

## Goals

1. Introduce a **palette registry** in `@vega-paper/themes` with attribution metadata.
2. Wire every built-in theme (except `monochrome-print`) to a named palette.
3. Publish **`docs/palettes.md`** with swatches, sources, and theme mapping.
4. Regenerate **`examples/theme-samples/`** as the visual regression baseline.
5. Ship as **v0.2.0** with release notes calling out palette refresh.

## Non-goals

- Scraping Color Hunt, Coolors, or any palette site at runtime.
- User-supplied URL → dynamic palette generation.
- OKLCH auto-generation or ML color picking.
- Changes to `infer`, MCP, or lint rule logic (except verifying existing `print` profile still passes).
- Replacing axis/grid/typography in themes (only **series colors** and palette metadata in this slice).

## Palette registry

### Location

```text
packages/themes/src/palettes/
  types.ts              # VegaPaperPalette, PaletteSource
  registry.ts           # listPalettes(), getPalette(id)
  carbon-categorical.ts
  ft-line-web.ts
  catppuccin-latte.ts
  catppuccin-mocha.ts
```

### Type shape

```ts
export type PaletteSourceKind = "product-media" | "curated-design";

export type PaletteAttribution = {
  name: string;           // e.g. "IBM Carbon Design System"
  url: string;            // official documentation
  license?: string;       // e.g. "Apache-2.0", "MIT"
};

export type VegaPaperPalette = {
  id: string;
  displayName: string;
  sourceKind: PaletteSourceKind;
  attribution: PaletteAttribution;
  /** Exactly six hex colors for Vega-Lite config.range.category */
  colors: [string, string, string, string, string, string];
  /** How colors were chosen from the source (sequence index, accent names, etc.) */
  selectionNotes: string;
};
```

### Theme integration

Extend `VegaPaperTheme` (or parallel export) with:

| Field | Required | Description |
|-------|----------|-------------|
| `paletteId` | yes (except monochrome) | Registry id |
| `config.range.category` | yes | Copied from palette at theme definition time (stable Vega output) |

`getTheme()` / `themes show` should surface `paletteId`, attribution name, and attribution URL.

Optional later: `vega-paper palettes list` — **not required** for 4c if `themes show` is enough.

## Selected palettes (fixed)

Colors are copied manually from official sources. Order is the **Vega-Lite series application order** (color legend order).

### 1. `carbon-categorical` — product-media (paper)

| # | Hex | Carbon sequence |
|---|-----|-----------------|
| 1 | `#6929C4` | Purple 70 |
| 2 | `#1192E8` | Cyan 50 |
| 3 | `#005D5D` | Teal 70 |
| 4 | `#9F1853` | Magenta 70 |
| 5 | `#FA4D56` | Red 50 |
| 6 | `#198038` | Green 60 |

- **Attribution:** IBM Carbon Design System — [Categorical palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- **Notes:** First six colors of Carbon’s recommended categorical sequence (skips Red 90 to avoid two reds in six slots).

### 2. `ft-line-web` — product-media (paper / journalism)

| # | Hex | FT `lineWeb` index |
|---|-----|-------------------|
| 1 | `#0F5499` | 0 (Oxford blue) |
| 2 | `#EB5E8D` | 1 |
| 3 | `#70DCE6` | 2 |
| 4 | `#9DBF57` | 3 |
| 5 | `#208FCE` | 4 |
| 6 | `#7F062E` | 5 |

- **Attribution:** Financial Times — [g-chartcolour `lineWeb`](https://ft-interactive.github.io/g-chartcolour/) / [Origami colours](https://origami.ft.com/foundations/colours/)
- **Notes:** Standard multi-series line palette used in FT interactive charts.

### 3. `catppuccin-latte` — curated-design (web light)

| # | Hex | Latte accent |
|---|-----|--------------|
| 1 | `#1E66F5` | Blue |
| 2 | `#179299` | Teal |
| 3 | `#FE640B` | Peach |
| 4 | `#8839EF` | Mauve |
| 5 | `#40A02B` | Green |
| 6 | `#D20F39` | Red |

- **Attribution:** Catppuccin — [Palette (Latte)](https://github.com/catppuccin/catppuccin) / [catppucc.in](https://catppucc.in/)
- **License:** MIT
- **Notes:** Six Latte accents chosen for chart series contrast on white backgrounds (popular dev/design palette).

### 4. `catppuccin-mocha` — curated-design (web dark)

| # | Hex | Mocha accent |
|---|-----|--------------|
| 1 | `#89B4FA` | Blue |
| 2 | `#94E2D5` | Teal |
| 3 | `#FAB387` | Peach |
| 4 | `#CBA6F7` | Mauve |
| 5 | `#A6E3A1` | Green |
| 6 | `#F38BA8` | Red |

- **Attribution:** Catppuccin — [Palette (Mocha)](https://github.com/catppuccin/catppuccin) / [catppucc.in/mocha](https://catppucc.in/mocha)
- **License:** MIT
- **Notes:** Matching accent roles to Latte for dark UI / poster backgrounds.

### Unchanged

- **`monochrome-print`** — keeps existing grayscale `range.category` (print-specific, not part of curated color pack).

## Theme → palette mapping

| Theme | `paletteId` | Rationale |
|-------|-------------|-----------|
| `paper-clean` | `carbon-categorical` | Default paper / A1 training curves |
| `acl-clean` | `carbon-categorical` | Same series colors; compact layout stays in theme config |
| `neurips-clean` | `ft-line-web` | ML paper alternative with journalism-grade line colors |
| `nature-soft` | `ft-line-web` | Softer axes/fonts; FT series colors fit journal-style figures |
| `shadcn-light` | `catppuccin-latte` | Modern light web/slides (replaces ad hoc Tailwind hex) |
| `shadcn-dark` | `catppuccin-mocha` | Popular dark UI palette |
| `poster-dark` | `catppuccin-mocha` | High-contrast dark poster; same series as shadcn-dark |
| `monochrome-print` | _(none)_ | Grayscale series unchanged |

Axis, grid, font, and `view` sizes remain per-theme files. Only `range.category` values change (plus new metadata).

## Validation

Before merge:

1. **Registry tests** — snapshot `palette.id` → six hex strings.
2. **`bun run render:theme-samples`** — commit updated SVGs under `examples/theme-samples/`.
3. **Paper checklists** (manual, recorded in PR):
   - Render `examples/training-curve/chart.vl.json` with `paper-clean` and `neurips-clean`; confirm six series are distinguishable.
   - Run `lint --lint-profile print` on a six-series line spec with `monochrome-print` (unchanged).
   - Optional: simulate deuteranopia on `carbon-categorical` and `ft-line-web` screenshots.
4. If a palette fails `print` lint when used with non-monochrome themes, document as expected (color series not grayscale-safe); do not block 4c.

## Documentation

- **`docs/palettes.md`** — table of four palettes with color swatches (inline SVG or linked theme-samples), attribution links, theme mapping, A vs B usage blurb.
- **`skills/vega-paper/references/theme-catalog.md`** — add “Palette source” column or footnote per theme.
- **`docs/releases/v0.2.0.md`** — “Built-in series colors now use curated palettes (Carbon, FT, Catppuccin).”

## Roadmap

- **Phase 4c:** this spec (before MCP).
- **Phase 5 MCP:** deferred; does not affect figure aesthetics.
- Optional **Phase 4d:** `--preset paper|web` (theme + lint + default size) after 4c.

## Versioning

- **v0.2.0** — palette refresh; same theme **names**, different series colors.
- Users pinning reproducible colors should record `paletteId` in figure meta (future enhancement) or vendor `themes show` output.

## Implementation plan

Invoke **writing-plans** skill after user approves this spec file to produce `docs/superpowers/plans/2026-06-04-vega-paper-curated-palettes.md`.
