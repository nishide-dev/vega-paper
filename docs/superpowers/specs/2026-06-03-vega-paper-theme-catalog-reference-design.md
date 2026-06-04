# Theme Catalog Reference Design

Date: 2026-06-03

## Context

Phase 2 skill draft (`skills/vega-paper/SKILL.md`) inlines theme names and a default recommendation. Brainstorm agreed to move details into `references/theme-catalog.md` with progressive disclosure (same pattern as chart-selection).

## Goals

- Add `skills/vega-paper/references/theme-catalog.md` (English, no command snippets).
- Shorten SKILL.md Themes section; add References link to the new file.
- Cover: four built-in themes (metadata from `packages/themes`), use-case picker, role of `themes list` / `themes show`, common pitfalls.

## Non-Goals

- Per-theme config highlights (use `themes show`).
- Lint profile ↔ theme mapping (belongs in `paper-style-guide.md`).
- Other reference files or skill scripts.
- CLI or theme package code changes.

## theme-catalog.md Sections

1. **Built-in themes** — table: `name`, `displayName`, `description`, `target`, `mode`
2. **Choosing a theme** — use-case → theme name (paper general, ACL-style, web/slides, B&W print)
3. **Inspecting themes** — what `themes list` and `themes show <name>` return; point to SKILL.md for commands
4. **Common mistakes** — unknown theme name; missing `--theme` on infer/render

## SKILL.md Changes

Replace Themes list block with brief summary + link. Add References entry:

```markdown
- [Theme catalog](references/theme-catalog.md) — built-in themes and selection guidance
```

Keep `themes list` / `themes show` command examples under **Other commands** (or infer/render steps that already use `--theme`).

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/references/theme-catalog.md` | New |
| `skills/vega-paper/SKILL.md` | Trim Themes + References |

## Verification

- Links resolve from `skills/vega-paper/SKILL.md`
- Theme metadata matches `packages/themes/src/*.ts`
- `bun run check` passes
