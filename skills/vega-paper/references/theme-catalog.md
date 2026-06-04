# Theme catalog for `vega-paper`

Choose `--theme` when rendering SVG (`infer --out` or `render`). This guide covers built-in themes and selection only; see [SKILL.md](../SKILL.md) for infer → lint → render workflow and CLI commands.

## Built-in themes

Metadata matches `packages/themes`. Pass the **`name`** value to `--theme`.

| name | displayName | description | target | mode |
|------|-------------|-------------|--------|------|
| `paper-clean` | Paper Clean | General publication-ready theme with restrained grids and readable labels. | paper | light |
| `acl-clean` | ACL Clean | Compact two-column NLP paper theme optimized for small figure widths. | paper | light |
| `neurips-clean` | NeurIPS Clean | NeurIPS / ICML / ML conference theme with clear series colors and readable single-column figures. | paper | light |
| `shadcn-light` | shadcn Light | Modern light chart theme inspired by quiet application dashboards. | web | light |
| `shadcn-dark` | shadcn Dark | Modern dark chart theme for dashboards, demos, and dark UI surfaces. | web | dark |
| `nature-soft` | Nature Soft | Soft biomedical journal style with minimal axes and muted distinguishable colors. | paper | light |
| `monochrome-print` | Monochrome Print | Grayscale-safe print theme for review PDFs and black-and-white output. | paper | print |
| `poster-dark` | Poster Dark | Dark poster and slide theme with large labels and high-contrast lines. | poster | dark |

MVP output is **SVG only**. Themes adjust Vega-Lite `config` (fonts, colors, default view size); they do not change data or encodings.

## Choosing a theme

| Situation | Recommended `--theme` |
|-----------|------------------------|
| General academic paper (default) | `paper-clean` |
| ACL / EMNLP / NAACL two-column paper, narrow figure column | `acl-clean` |
| NeurIPS / ICML / ML conference single-column figure | `neurips-clean` |
| Biomedical / Nature-style soft color palette | `nature-soft` |
| Light web UI, blog, or dashboard (not print-first) | `shadcn-light` |
| Dark web UI or demo on dark background | `shadcn-dark` |
| Conference poster or slide on dark background | `poster-dark` |
| Grayscale print, arXiv B&W, or color-unreliable output | `monochrome-print` + `--lint-profile print` |

When unsure for a **paper submission**, start with **`paper-clean`**. Use **`nature-soft`** for softer journal-style color. Switch to **`acl-clean`** only when the figure must fit a very narrow column width. Use **`monochrome-print`** when color must not carry meaning. Reserve **`poster-dark`** / **`shadcn-dark`** for slides and screens, not print-first papers.

`--theme` applies at **render** time (including `infer` when `--out` is set). Lint profiles (`--lint-profile`) are separate; see [Paper style guide](paper-style-guide.md) for size and lint rules.

## Inspecting themes

Use the CLI to confirm names and inspect full `config`:

- **`themes list`** — table of all themes (`name`, `target`, `mode`, `description`). Use `--json` for machine-readable output.
- **`themes show <name>`** — one theme’s metadata plus pretty-printed `config` (fonts, view defaults, axis/legend styling). Use `--json` to copy config into a hand-written spec.

Command examples live in [SKILL.md](../SKILL.md) (**Other commands** and infer/render steps).

## Common mistakes

| Mistake | Why it fails / looks wrong | Fix |
|---------|---------------------------|-----|
| Unknown `--theme` name (typo or invented name) | CLI error: unknown theme | Run `themes list`; use an exact `name` from the table above |
| Render or `infer --out` without `--theme` | Spec renders without VegaPaper theme config; labels/colors may not match paper expectations | Always pass `--theme` (e.g. `paper-clean`) when producing SVG for publication |
| Picking a **web** or **poster** theme for print-first paper | Colors and contrast tuned for screens | Prefer `paper-clean`, `acl-clean`, `nature-soft`, or `monochrome-print` for print |
| Expecting theme to fix lint issues | Themes do not change spec size, titles, or data | Fix lint via infer flags or spec edits; match `--lint-profile` to the venue |
