# Paper style guide for `vega-paper`

Lint profiles, figure size limits, and style rules for publication-ready specs. See [SKILL.md](../SKILL.md) for the infer → lint → render workflow and CLI commands.

Thresholds match `packages/cli/src/core/lint-profiles.ts` and `lint-rules.ts`.

## Lint profiles

Pass `--lint-profile <name>` on `infer` and `lint`. Default: **`paper`**.

| Profile | Title max (chars) | Width range | Height range | Max inline rows | Max color categories | Min font size | Grayscale checks |
|---------|-------------------|-------------|--------------|-----------------|----------------------|---------------|------------------|
| `paper` | 90 | 180–720 | 120–540 | 500 | 12 | 8 | no |
| `web` | 120 | 240–1200 | 160–800 | 1000 | 20 | 10 | no |
| `acl` | 70 | 240–480 | 160–360 | 300 | 8 | 9 | no |
| `print` | 70 | 180–480 | 120–360 | 300 | 6 | 9 | **yes** |

All style rules below emit **warnings** unless noted. Errors (`spec-unreadable`, `spec-unknown-type`) block lint before style checks run.

## Choosing a profile

| Situation | `--lint-profile` |
|-----------|------------------|
| General academic paper (default) | `paper` |
| ACL / EMNLP-style two-column, tight figure column | `acl` |
| Slides, blog, or large in-app figure | `web` |
| Grayscale / B&W print, arXiv, review PDF | `print` |

Match profile to the **venue layout**, not the render theme. Themes (`--theme`) control colors and fonts at SVG export; lint profiles control size and readability checks on the spec.

Pair **`acl`** lint with **`acl-clean`** theme when targeting a narrow NLP column. Pair **`print`** lint with **`monochrome-print`** theme for B&W output. See [Theme catalog](theme-catalog.md).

## Recommended figure sizes

Set explicit **`width`** and **`height`** on every paper figure (`size-missing` warns otherwise).

On **`infer`**, use `--width` and `--height` (pixels). On hand-written specs, set top-level `"width"` / `"height"` in the JSON.

Starting points inside each profile range:

| Profile | Typical starting size (W × H) | Notes |
|---------|------------------------------|-------|
| `paper` | 360 × 220 | Matches `paper-clean` default view; adjust for legend or facets |
| `acl` | 320 × 200 | Matches `acl-clean` default view; stay within narrow width cap |
| `print` | 360 × 220 | Same canvas as `paper-clean`; stricter color/category limits |
| `web` | 480 × 300 | Larger canvas for screens; still set explicit dimensions |

If `size-out-of-range` fires, shrink or grow within the profile table above rather than switching profiles without reason.

## Multi-panel figures

Composite figures — Figure 2(a), 2(b), 2(c) — built with Vega-Lite `hconcat`
/ `vconcat`. Reference example:
[examples/multipanel-paper-figure/](../../../examples/multipanel-paper-figure/).

### Facet vs concat vs separate files

| Approach | Use when |
|----------|----------|
| `facet` (or `infer --facet`) | Same chart repeated over one field's values; shared scales/legend |
| `hconcat` / `vconcat` | Different chart types or datasets in one figure with one caption |
| Separate files + LaTeX `subfigure` | Panels floated, sized, or reused independently in LaTeX |

### Panel label conventions

- Label every panel `(a)`, `(b)`, `(c)` — lowercase, parenthesized, in reading
  order (left→right for `hconcat`, top→bottom for `vconcat`).
- Put the label in the panel `title`, left-anchored and bold:

  ```json
  "title": { "text": "(a) Training", "anchor": "start", "fontWeight": "bold" }
  ```

- Keep the panel title to a 1–3 word cue after the label; the full description
  belongs in the LaTeX caption (`\caption{... (a) Training curve. (b) ...}`).
- Compose existing specs with panel labels via the CLI:

  ```bash
  vega-paper template multipanel \
    --panel path/to/first.vl.json:a:Training \
    --panel path/to/second.vl.json:b:Ablation \
    --layout hconcat \
    --spec-out figure.vl.json
  ```

### Sizing for single- vs double-column layouts

Total rendered width ≈ sum of per-panel `width` + roughly 40–60px per panel
for axes, legends, and concat spacing. Set explicit `width`/`height` on
**every panel view**: lint's `size-out-of-range` only reads top-level
dimensions (which concat specs do not have), and `size-missing` will warn on
the missing top-level size regardless — treat that warning as a reminder to
size each panel, not as something to fix at the top level.

| Layout target | Lint profile | Total width budget | Panels (`hconcat`) | Per-panel `width` | Per-panel `height` |
|---------------|--------------|-------------------|--------------------|-------------------|--------------------|
| Single column (~360pt, e.g. one ACL/two-column column) | `acl` (240–480 width range) | ≤ 360 | 1–2 | 120–160 | 140–200 |
| Double column / full page width (~700pt) | `paper` (180–720 width range) | ≤ 700 | 2–3 | 180–220 | 150–200 |

Lint the composed spec with the profile matching the layout target:
`vega-paper lint figure.vl.json --lint-profile acl` for single-column,
`--lint-profile paper` (the default) for double-column figures.

- More than 3 panels in one row is rarely readable at paper scale — switch to
  `vconcat`, a 2×2 grid (`vconcat` of `hconcat` rows), or separate files.
- For `vconcat`, budget total height instead: keep it under ~540 for `paper`
  profile pages (matches the profile height cap).
- Themes apply once at render (`--theme` merges into top-level `config`) and
  style all panels uniformly — never bake per-panel fonts/colors into views.

## `--strict` vs default

| Mode | Behavior |
|------|----------|
| **Default** (no `--strict`) | Warnings print; command still succeeds. Read output and fix issues before final render. |
| **`--strict`** | Any warning fails the command (CI-like gate). Use when the user wants zero warnings. |

On **`infer`**, strict lint failure **before** `--out` render exits without writing `.meta.json`. Fix warnings or drop `--strict` for exploratory runs.

Command examples: [SKILL.md](../SKILL.md) Steps 3–4.

## Lint rules

Prefer fixing **`infer` flags** (`--title`, `--width`, `--height`, `--aggregate`, `--facet`, fewer color series) before editing generated JSON. For hand-written specs, edit the spec at the reported path.

| ruleId | Meaning | Typical fix |
|--------|---------|-------------|
| `title-too-long` | Title exceeds profile character limit | Shorten `--title`; move detail to paper caption |
| `axis-title-missing` | Vega-Lite x/y channel lacks explicit title | Add axis titles in spec, or ensure infer sets readable titles |
| `size-missing` | `width` and/or `height` absent | Add `--width` / `--height` on infer, or set in spec |
| `size-out-of-range` | Width or height outside profile range | Adjust dimensions to fit profile; use acl range for narrow columns |
| `inline-data-large` | Inline `data.values` exceeds row cap | Use external data file; aggregate with `--aggregate` on infer |
| `legend-too-many-categories` | Too many distinct color categories | Drop `--color`, group series, facet, or filter data |
| `font-size-small` | Config font size below profile minimum | Raise `config.axis.*FontSize` / `legend.*FontSize`, or use a paper theme |
| `bar-y-axis-zero-missing` | Bar chart with quantitative y lacks `scale.zero: true` | Set `encoding.y.scale.zero` to `true` unless zero is misleading |
| `grayscale-unsafe-color` | Explicit palette color is not grayscale-safe (**`print` profile only**) | Use gray hex values, `monochrome-print`, or non-color encodings |
| `color-only-series` | Multi-series line/bar differs only by `color` (**`print` profile only**) | Add `strokeDash` or `shape`, reduce series, or facet |

Errors (always blocking):

| ruleId | Meaning | Typical fix |
|--------|---------|-------------|
| `spec-unreadable` | Input file missing or invalid JSON | Fix path; ensure valid JSON object |
| `spec-unknown-type` | Not recognizable Vega or Vega-Lite | Add `$schema` or valid mark/encoding structure |

## Common mistakes

| Mistake | Why it fails / looks wrong | Fix |
|---------|---------------------------|-----|
| `web` profile for a print paper | Allows sizes and titles too large for the column | Use `paper` or `acl` |
| Ignoring warnings because command succeeded | Figure may be unreadable or rejected by venue | Fix warnings; add `--strict` only when gating CI |
| `--width` / `--height` outside venue | `size-out-of-range` or poor fit in LaTeX | Re-read profile ranges; start from recommended sizes |
| Fixing lint by changing `--theme` only | Themes do not change spec size or titles | Adjust infer flags or spec; see [Theme catalog](theme-catalog.md) |
| Many color series in one chart | `legend-too-many-categories` | Facet, filter, or collapse categories |

## LaTeX and captions

Rendered output formats are **SVG**, **PNG**, and **PDF** (`--format` on `render`/`infer`). Use SVG as the canonical editable vector artifact where possible, PDF for LaTeX venues that prefer or require PDF figures, and PNG for README, slides, and raster previews. Treat the spec + rendered vector output + `*.meta.json` as the reproducible figure bundle.

### Embedding SVG

- Prefer **vector SVG** for LaTeX: scalable in `\includegraphics[width=\linewidth]{...}` when your toolchain accepts SVG (e.g. XeLaTeX/LuaLaTeX with `svg` package, or `\includesvg` from `svg` / `inkscape` conversion).
- **pdfLaTeX** venues usually require PDF figures: render them directly with `--format pdf` (e.g. `--out figures/f1.pdf`) — no external SVG conversion step is needed.
- Keep figure **width** aligned with the column: use lint profile ranges and [recommended sizes](#recommended-figure-sizes); set `--width` on `infer` or spec `width` to match `\linewidth` or the venue’s max figure width in pixels.

### Title vs caption

- **`title-too-long`** exists because paper captions belong in **LaTeX** (`\caption{...}`), not in the chart title.
- Keep the in-figure title short (methods name or panel label). Put experimental detail, dataset name, and statistics in the LaTeX caption.
- For ACL-style narrow figures, prefer **`acl`** lint profile and shorter titles (70 characters).

### Files to commit with the paper

| Artifact | Role |
|----------|------|
| `*.vl.json` / `*.vg.json` | Source spec; regenerate or edit figure |
| `*.svg` or `*.pdf` | Rendered vector figure for the paper (PDF for pdfLaTeX venues) |
| Source data or data-generation script | Reproduce the spec from raw results |
| `*.meta.json` | Provenance (`command`, versions, infer snapshot when applicable) |

PNG (`--format png`) is for README, slides, and raster previews — keep a vector format as the paper artifact.
