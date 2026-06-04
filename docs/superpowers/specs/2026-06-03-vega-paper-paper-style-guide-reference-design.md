# Paper Style Guide Reference Design

Date: 2026-06-03

## Context

Phase 2 skill draft (`skills/vega-paper/SKILL.md`) inlines lint profile guidance and `--strict` usage in the infer workflow. Brainstorm agreed to move thresholds, rules, and size guidance into `references/paper-style-guide.md` while keeping the revision loop procedure in SKILL.md.

## Goals

- Add `skills/vega-paper/references/paper-style-guide.md` (English, no command snippets).
- Shorten SKILL.md lint profile / strict paragraphs; link the new reference.
- Cover: three lint profiles and thresholds, profile selection, eight style lint rules with fixes, `--strict` vs default, recommended figure sizes, pitfalls.
- Update `theme-catalog.md` forward reference to link the new file.

## Non-Goals

- LaTeX embedding or caption writing.
- Per-rule JSON path deep dives.
- Theme ↔ lint mapping (themes stay in theme-catalog).
- CLI code changes.

## paper-style-guide.md Sections

1. **Lint profiles** — comparison table from `lint-profiles.ts`
2. **Choosing a profile** — paper / acl / web use cases
3. **Recommended figure sizes** — starting points within each profile range; infer `--width` / `--height`
4. **`--strict` vs default** — warnings vs blocking; meta write behavior on infer
5. **Lint rules** — eight `paperLintRules` rule ids with meaning and typical fix (infer flags first)
6. **Common mistakes** — profile mismatch, ignoring warnings without strict, size-missing

## SKILL.md Changes

- Replace Step 3 lint profile / strict paragraphs with brief pointer + link.
- Step 4 revision loop keeps procedural steps; link reference for rule fixes.
- Add References entry for paper-style-guide.

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/references/paper-style-guide.md` | New |
| `skills/vega-paper/SKILL.md` | Trim lint details + References |
| `skills/vega-paper/references/theme-catalog.md` | Link paper-style-guide (replace “future” wording) |

## Verification

- Thresholds match `packages/cli/src/core/lint-profiles.ts`
- Rule ids match `packages/cli/src/core/lint-rules.ts`
- `bun run check` passes
