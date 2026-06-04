# Theme Samples

Committed theme PNGs for README live under [`docs/assets/gallery/themes/`](../../docs/assets/gallery/themes/). This folder is for **local SVG** comparison via `bun run render:theme-samples` (gitignored).

Render the same hand-written spec with **every built-in theme** to compare styling. Uses [basic-line/chart.vl.json](../basic-line/chart.vl.json) (line + color encoding).

SVG outputs in this folder are **not committed** (nor sibling `*.meta.json` sidecars). Generate them locally with the commands below or `bun run render:theme-samples` from the repo root.

## Render one theme

```bash
vega-paper render examples/basic-line/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/theme-samples/paper-clean.svg
```

Replace `--theme` and `--out` with any row from the table.

## All built-in themes

| `--theme` | Typical use |
|-----------|-------------|
| `paper-clean` | General academic paper (default) |
| `acl-clean` | ACL / EMNLP narrow two-column layout |
| `neurips-clean` | NeurIPS / ICML single-column ML paper |
| `shadcn-light` | Light web / dashboard |
| `shadcn-dark` | Dark web / demo |
| `nature-soft` | Biomedical / Nature-style journal |
| `monochrome-print` | Grayscale print (pair with `--lint-profile print`) |
| `poster-dark` | Dark poster or slide |

## Render all themes

From the repo root:

```bash
bun run render:theme-samples
```

Writes `examples/theme-samples/<theme-name>.svg` and sibling `<theme-name>.meta.json` for each built-in theme.

## Lint before print themes

For B&W output, lint with the print profile first:

```bash
vega-paper lint examples/basic-line/chart.vl.json --profile print
```

See [Theme catalog](../../skills/vega-paper/references/theme-catalog.md) for selection guidance.
