# Paper style guide for `vega-paper`

Lint profiles, figure size limits, and style rules for publication-ready specs. See [SKILL.md](../SKILL.md) for the infer → lint → render workflow and CLI commands.

Thresholds match `packages/cli/src/core/lint-profiles.ts` and `lint-rules.ts`.

## Lint profiles

Pass `--lint-profile <name>` on `infer` and `lint`. Default: **`paper`**.

| Profile | Title max (chars) | Width range | Height range | Max inline rows | Max color categories | Min font size |
|---------|-------------------|-------------|--------------|-----------------|----------------------|---------------|
| `paper` | 90 | 180–720 | 120–540 | 500 | 12 | 8 |
| `web` | 120 | 240–1200 | 160–800 | 1000 | 20 | 10 |
| `acl` | 70 | 240–480 | 160–360 | 300 | 8 | 9 |

All style rules below emit **warnings** unless noted. Errors (`spec-unreadable`, `spec-unknown-type`) block lint before style checks run.

## Choosing a profile

| Situation | `--lint-profile` |
|-----------|------------------|
| General academic paper (default) | `paper` |
| ACL / EMNLP-style two-column, tight figure column | `acl` |
| Slides, blog, or large in-app figure | `web` |

Match profile to the **venue layout**, not the render theme. Themes (`--theme`) control colors and fonts at SVG export; lint profiles control size and readability checks on the spec.

Pair **`acl`** lint with **`acl-clean`** theme when targeting a narrow NLP column. See [Theme catalog](theme-catalog.md).

## Recommended figure sizes

Set explicit **`width`** and **`height`** on every paper figure (`size-missing` warns otherwise).

On **`infer`**, use `--width` and `--height` (pixels). On hand-written specs, set top-level `"width"` / `"height"` in the JSON.

Starting points inside each profile range:

| Profile | Typical starting size (W × H) | Notes |
|---------|------------------------------|-------|
| `paper` | 360 × 220 | Matches `paper-clean` default view; adjust for legend or facets |
| `acl` | 320 × 200 | Matches `acl-clean` default view; stay within narrow width cap |
| `web` | 480 × 300 | Larger canvas for screens; still set explicit dimensions |

If `size-out-of-range` fires, shrink or grow within the profile table above rather than switching profiles without reason.

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

MVP output is **SVG**. Treat the SVG + Vega-Lite spec + `*.meta.json` as the reproducible figure bundle.

### Embedding SVG

- Prefer **vector SVG** for LaTeX: scalable in `\includegraphics[width=\linewidth]{...}` when your toolchain accepts SVG (e.g. XeLaTeX/LuaLaTeX with `svg` package, or `\includesvg` from `svg` / `inkscape` conversion).
- **pdfLaTeX** often requires converting SVG to PDF/EPS first; VegaPaper does not ship a PDF export in MVP — convert externally if the venue requires PDF figures only.
- Keep figure **width** aligned with the column: use lint profile ranges and [recommended sizes](#recommended-figure-sizes); set `--width` on `infer` or spec `width` to match `\linewidth` or the venue’s max figure width in pixels.

### Title vs caption

- **`title-too-long`** exists because paper captions belong in **LaTeX** (`\caption{...}`), not in the chart title.
- Keep the in-figure title short (methods name or panel label). Put experimental detail, dataset name, and statistics in the LaTeX caption.
- For ACL-style narrow figures, prefer **`acl`** lint profile and shorter titles (70 characters).

### Files to commit with the paper

| Artifact | Role |
|----------|------|
| `*.vl.json` | Source spec; regenerate or edit figure |
| `*.svg` | Vector figure for the paper |
| `*.meta.json` | Provenance (`command`, versions, infer snapshot when applicable) |

Do not promise PNG/PDF export from VegaPaper MVP; SVG is the canonical artifact (see repository README).
