# Chart Selection Reference Design

Date: 2026-06-04

## Context

Phase 2 skill draft (`skills/vega-paper/SKILL.md`) inlines chart selection. Brainstorm agreed to move details into `references/chart-selection.md` with progressive disclosure.

## Goals

- Add `skills/vega-paper/references/chart-selection.md` (English, no infer command snippets).
- Shorten SKILL.md Chart selection section; add References section linking the new file.
- Cover: six chart types, modifiers, repo examples mapping, common mistakes.

## Non-Goals

- Decision trees or paper-style guidance.
- Field type override guide (`--x-type`).
- Other reference files or skill scripts.
- CLI code changes.

## chart-selection.md Sections

1. **Chart types** — goal, `--chart`, typical `--x` / `--y` / `--color` roles
2. **Modifiers** — aggregate, facet, error-band; valid charts; CLI rejection rules
3. **Examples in this repo** — table linking to `examples/` folders
4. **Common mistakes** — pitfalls aligned with CLI validation

## SKILL.md Changes

Replace Chart selection table with brief summary + link. Add:

```markdown
## References
- [Chart selection](references/chart-selection.md) — chart types and infer modifiers
```

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/references/chart-selection.md` | New |
| `skills/vega-paper/SKILL.md` | Trim + References |

## Verification

- Links resolve from `skills/vega-paper/SKILL.md`
- `bun run check` passes (skills excluded from Biome)
