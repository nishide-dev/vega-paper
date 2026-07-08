# Multi-panel paper figure (hand-written spec)

A Figure-2(a)/(b)/(c)-style composite: three Vega-Lite views concatenated with
`hconcat`, each with its own small CSV and a bold, left-anchored panel label.
This is a hand-written spec — `infer` does not generate multi-panel layouts.

| Panel | Content | Data |
|-------|---------|------|
| (a) | Learning curve (line, two models) | `learning-curve.csv` |
| (b) | Ablation bars (kept in CSV order via `"sort": null`) | `ablation.csv` |
| (c) | Quality vs latency scatter (Pareto-style trade-off) | `pareto.csv` |

Panel labels are panel `title` objects:

```json
"title": { "text": "(a) Training", "anchor": "start", "fontWeight": "bold" }
```

Keep the label text short; put full experimental detail in the LaTeX caption.

## Render

The theme is applied once at render time and styles all panels uniformly
(theme config merges into the top-level `config`, which is global across
concatenated views):

```bash
vega-paper render examples/multipanel-paper-figure/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/multipanel-paper-figure/output.svg
```

Or from the repo root: `bun run render:multipanel`.

## Compose from existing specs with the template CLI

`chart-composed.vl.json` is generated (not hand-written) by the `multipanel`
template, which reads existing `.vl.json` files, rewrites their relative
`data.url` values, and wraps them in `hconcat`/`vconcat` with panel labels:

```bash
vega-paper template multipanel \
  --panel examples/training-curve/chart.vl.json:a:Training \
  --panel examples/ablation-bar/chart.vl.json:b:Ablation \
  --layout hconcat \
  --spec-out examples/multipanel-paper-figure/chart-composed.vl.json
```

Regenerate from the repo root with `bun run template:multipanel`. Add
`--theme <name> --out <path>.svg` to also render and write a `.meta.json`
sidecar. `--panel` values use `<spec-path>:<label>[:<title>]>`; the template
takes no `<data>` argument.

## Facet vs concat vs separate files

| Approach | Use when | Trade-off |
|----------|----------|-----------|
| `--facet` (`infer`) / `facet` spec | Same chart repeated over one field's values (same data, same encodings) | Shared scales and legend for free; panels cannot differ in chart type |
| `hconcat` / `vconcat` (this example) | Panels are **different chart types or datasets** but belong in one figure with one caption | One coherent artifact, one theme pass, panel labels inside the figure; scales are independent unless you add `resolve` |
| Separate files + LaTeX `subfigure` | Panels need independent placement, sizing, or reuse across papers | Maximum layout control in LaTeX; label styling drifts (LaTeX labels vs figure labels) and panels can render with inconsistent themes |

Rule of thumb: same view repeated → facet; different views, one figure →
concat; panels reused or independently floated → separate files.

Sizing guidance (single- vs double-column widths) lives in
[skills/vega-paper/references/paper-style-guide.md](../../skills/vega-paper/references/paper-style-guide.md)
under "Multi-panel figures".

Committed `.vl.json` files are reference outputs. `output.svg` and
`output.meta.json` are generated locally and not committed.
