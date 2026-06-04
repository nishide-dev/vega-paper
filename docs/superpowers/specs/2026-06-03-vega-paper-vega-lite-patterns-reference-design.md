# Vega-Lite Patterns Reference Design

Date: 2026-06-03

## Context

Phase 2 skill draft (`skills/vega-paper/SKILL.md`) includes a Secondary workflow (render) section with a command example. Brainstorm agreed to move hand-written spec guidance into `references/vega-lite-patterns.md` while keeping primary/secondary contrast in SKILL.md.

## Goals

- Add `skills/vega-paper/references/vega-lite-patterns.md` (English, no command snippets).
- Shorten SKILL.md Secondary workflow section; add References link.
- Cover: when to use render vs infer, spec minimum requirements, render flag roles, repo examples mapping, hand-written lint notes, pitfalls.

## Non-Goals

- JSON snippet / template catalog.
- External `data.url` patterns.
- CLI code changes.

## vega-lite-patterns.md Sections

1. **When to use `render`** — existing spec, infer-unsupported marks, user-provided JSON
2. **Spec minimum requirements** — `$schema`, structure, explicit size for papers
3. **Render flags** — `--out`, `--theme`, `--format svg` roles; point to SKILL for commands
4. **Examples in this repo** — hand-written vs infer-generated folders
5. **Lint for hand-written specs** — edit spec; link paper-style-guide
6. **Common mistakes** — infer vs render confusion; render meta shape

## SKILL.md Changes

Replace Secondary workflow detail with brief summary + link. Keep one render command example or trim to pointer? Chart-selection kept infer examples in SKILL. For secondary, brainstorm said "SKILL は手順の短い要約 + リンク" - the render bash example could stay in SKILL as command canonical source (like themes show in Other commands). Theme-catalog removed themes list bash but kept examples in Other commands and infer steps.

Looking at theme-catalog SKILL change - removed themes list bash, kept themes show in Other commands and infer/render have --theme examples.

For vega-lite-patterns - shorten Secondary workflow to summary + link, but KEEP the render bash example in SKILL since reference has no bash (command examples in SKILL Steps). Actually re-read brainstorm: "reference: render の必須フラグ — 役割の説明のみ、bash 例は SKILL 側"

So SKILL can keep the render example block - that's the command canonical source. Shorten the prose around it to link to reference.

Current Secondary workflow:
```
Use when the user already has a Vega-Lite spec...

bash render example

Writes sibling meta...
```

I'll shorten to:
```
Use when the user already has a Vega-Lite spec. Read [Vega-Lite patterns](references/vega-lite-patterns.md) for when to prefer render, spec requirements, and hand-written lint.

bash render example (keep)

Writes sibling meta - can move meta detail to reference or keep one line
```

Actually meta pitfall is in reference - SKILL can keep one line about command: render.

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/references/vega-lite-patterns.md` | New |
| `skills/vega-paper/SKILL.md` | Trim Secondary workflow + References |

## Verification

- Links resolve from SKILL.md
- Examples table matches `examples/`
- `bun run check` passes
