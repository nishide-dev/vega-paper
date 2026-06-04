# VegaPaper palette catalog

Built-in themes use **named, attributed palettes** for series colors (`config.range.category`). Axis, grid, and typography stay per-theme; only categorical colors come from these packs.

Inspect a theme’s palette at runtime:

```bash
vega-paper themes show paper-clean
```

Visual comparison: [`examples/theme-samples/`](../examples/theme-samples/) (regenerate with `bun run render:theme-samples`).

## Palettes

### `carbon-categorical` (product-media)

| # | Hex | Carbon token |
|---|-----|--------------|
| 1 | `#6929C4` | Purple 70 |
| 2 | `#1192E8` | Cyan 50 |
| 3 | `#005D5D` | Teal 70 |
| 4 | `#9F1853` | Magenta 70 |
| 5 | `#FA4D56` | Red 50 |
| 6 | `#198038` | Green 60 |

- **Source:** [IBM Carbon — Categorical palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- **Use:** Default paper figures, training curves (A1), ACL two-column.

### `ft-line-web` (product-media)

| # | Hex | FT lineWeb index |
|---|-----|------------------|
| 1 | `#0F5499` | 0 |
| 2 | `#EB5E8D` | 1 |
| 3 | `#70DCE6` | 2 |
| 4 | `#9DBF57` | 3 |
| 5 | `#208FCE` | 4 |
| 6 | `#7F062E` | 5 |

- **Source:** [FT g-chartcolour lineWeb](https://ft-interactive.github.io/g-chartcolour/) / [Origami colours](https://origami.ft.com/foundations/colours/)
- **Use:** ML conference and journal-style paper themes.

### `catppuccin-latte` (curated-design)

| # | Hex | Latte accent |
|---|-----|--------------|
| 1 | `#1E66F5` | Blue |
| 2 | `#179299` | Teal |
| 3 | `#FE640B` | Peach |
| 4 | `#8839EF` | Mauve |
| 5 | `#40A02B` | Green |
| 6 | `#D20F39` | Red |

- **Source:** [Catppuccin palette](https://catppuccin.com/palette/) (MIT)
- **Use:** Light web UI, slides, README figures.

### `catppuccin-mocha` (curated-design)

| # | Hex | Mocha accent |
|---|-----|--------------|
| 1 | `#89B4FA` | Blue |
| 2 | `#94E2D5` | Teal |
| 3 | `#FAB387` | Peach |
| 4 | `#CBA6F7` | Mauve |
| 5 | `#A6E3A1` | Green |
| 6 | `#F38BA8` | Red |

- **Source:** [Catppuccin palette](https://catppuccin.com/palette/) (MIT)
- **Use:** Dark web UI, posters, demos.

## Theme mapping

| Theme | Palette |
|-------|---------|
| `paper-clean` | `carbon-categorical` |
| `acl-clean` | `carbon-categorical` |
| `neurips-clean` | `ft-line-web` |
| `nature-soft` | `ft-line-web` |
| `shadcn-light` | `catppuccin-latte` |
| `shadcn-dark` | `catppuccin-mocha` |
| `poster-dark` | `catppuccin-mocha` |
| `monochrome-print` | _(grayscale; no palette pack)_ |

## Paper vs web

- **Paper (A):** `paper-clean` / `acl-clean` → Carbon; `neurips-clean` / `nature-soft` → FT.
- **Web / slides (B):** `shadcn-light` → Catppuccin Latte; `shadcn-dark` / `poster-dark` → Catppuccin Mocha.

Non-monochrome palettes are not grayscale-safe. Use `monochrome-print` + `--lint-profile print` for B&W output.

## Versioning

Palette colors changed in **v0.1.3**. Theme names are unchanged; re-rendered SVGs will differ from v0.1.2. Pin colors by saving `themes show <name> --json` output or figure meta sidecars.
