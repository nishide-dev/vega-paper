# Theme Expansion Batch 1 Design

Date: 2026-06-03

## Context

Phase 3 expands the official theme catalog in `packages/themes`. MVP shipped four themes; `initial-design.md` §7.3 lists seven.

## Goals

Add three built-in themes matching initial-design §7.2–7.3:

| name | target | mode | description (summary) |
|------|--------|------|------------------------|
| `shadcn-dark` | web | dark | Modern dark chart theme |
| `nature-soft` | paper | light | Soft biomedical journal style |
| `poster-dark` | poster | dark | Dark poster / slide theme |

Update registry order to match initial-design catalog, tests, `theme-catalog.md`, README layout line.

## Non-Goals

- User custom theme paths
- Grayscale lint rules (follow-up slice)
- NeurIPS-specific theme (future)

## Registry order

```text
paper-clean → acl-clean → shadcn-light → shadcn-dark → nature-soft → monochrome-print → poster-dark
```

## Verification

- `bun test packages/themes`
- `bun test packages/cli/test/themes-command.test.ts`
- `bun run check`
