# Theme catalog for `vega-paper`

Choose `--theme` when rendering SVG (`infer --out` or `render`). This guide covers built-in themes and selection only; see [SKILL.md](../SKILL.md) for infer → lint → render workflow and CLI commands.

## Built-in themes

Metadata matches `packages/themes`. Pass the **`name`** value to `--theme`.

| name | displayName | description | target | mode |
|------|-------------|-------------|--------|------|
| `paper-clean` | Paper Clean | General publication-ready theme with restrained grids and readable labels. | paper | light |
| `acl-clean` | ACL Clean | Compact two-column NLP paper theme optimized for small figure widths. | paper | light |
| `shadcn-light` | shadcn Light | Modern light chart theme inspired by quiet application dashboards. | web | light |
| `monochrome-print` | Monochrome Print | Grayscale-safe print theme for review PDFs and black-and-white output. | paper | print |

MVP output is **SVG only**. Themes adjust Vega-Lite `config` (fonts, colors, default view size); they do not change data or encodings.

## Choosing a theme

| Situation | Recommended `--theme` |
|-----------|------------------------|
| General academic paper (default) | `paper-clean` |
| ACL / EMNLP-style two-column paper, narrow figure column | `acl-clean` |
| Slides, blog post, or in-app figure (not print-first) | `shadcn-light` |
| Grayscale print, arXiv B&W, or color-unreliable output | `monochrome-print` |

When unsure for a **paper submission**, start with **`paper-clean`**. Switch to **`acl-clean`** only when the figure must fit a very narrow column width. Use **`monochrome-print`** when color must not carry meaning.

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
| Picking a **web** theme (`shadcn-light`) for print-first paper | Colors and contrast tuned for screens | Prefer `paper-clean`, `acl-clean`, or `monochrome-print` for print |
| Expecting theme to fix lint issues | Themes do not change spec size, titles, or data | Fix lint via infer flags or spec edits; match `--lint-profile` to the venue |
