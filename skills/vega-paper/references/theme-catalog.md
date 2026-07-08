# Theme catalog for `vega-paper`

Choose `--theme` when rendering SVG (`infer --out` or `render`). This guide covers built-in themes and selection; see [SKILL.md](../SKILL.md) for workflow and CLI commands.

## Custom theme files

`--theme` accepts either a **built-in `name`** (below) or a **path to a JSON file** (e.g. `lab/theme.json`). Required field: `config` (Vega-Lite top-level config object). Optional metadata: `name`, `displayName`, `description`, `target`, `mode`.

- Inspect a file: `themes show path/to/theme.json`
- Example in repo: [`examples/custom-theme/`](../../../examples/custom-theme/)
- Spec: [`docs/superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md`](../../../docs/superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md)

`themes list` shows built-in presets only.

## Built-in themes

Metadata matches `packages/themes`. Pass the **`name`** value to `--theme`. Series colors come from [curated palettes](../../../docs/palettes.md); run `themes show <name>` for `paletteId` and source URL.

| name | displayName | palette | target | mode |
|------|-------------|---------|--------|------|
| `paper-clean` | Paper Clean | `carbon-categorical` | paper | light |
| `acl-clean` | ACL Clean | `carbon-categorical` | paper | light |
| `neurips-clean` | NeurIPS Clean | `ft-line-web` | paper | light |
| `shadcn-light` | shadcn Light | `catppuccin-latte` | web | light |
| `shadcn-dark` | shadcn Dark | `catppuccin-mocha` | web | dark |
| `nature-soft` | Nature Soft | `ft-line-web` | paper | light |
| `monochrome-print` | Monochrome Print | _(grayscale)_ | paper | print |
| `poster-dark` | Poster Dark | `catppuccin-mocha` | poster | dark |

Rendered output formats are **SVG**, **PNG**, and **PDF** (`--format` on `render`/`infer`). Themes adjust Vega-Lite `config` (fonts, colors, default view size); they do not change data or encodings.

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
- **`themes show <name|path>`** — built-in preset or custom JSON file; metadata plus pretty-printed `config`. Use `--json` to copy config into a hand-written spec.

Command examples live in [SKILL.md](../SKILL.md) (**Other commands** and infer/render steps).

## Common mistakes

| Mistake | Why it fails / looks wrong | Fix |
|---------|---------------------------|-----|
| Unknown `--theme` name (typo or invented name) | CLI error: unknown theme | Run `themes list`; use an exact `name` from the table above |
| Render or `infer --out` without `--theme` | Spec renders without VegaPaper theme config; labels/colors may not match paper expectations | Always pass `--theme` (e.g. `paper-clean`) when producing SVG for publication |
| Picking a **web** or **poster** theme for print-first paper | Colors and contrast tuned for screens | Prefer `paper-clean`, `acl-clean`, `nature-soft`, or `monochrome-print` for print |
| Expecting theme to fix lint issues | Themes do not change spec size, titles, or data | Fix lint via infer flags or spec edits; match `--lint-profile` to the venue |
