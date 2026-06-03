# Infer Boxplot Implementation Plan

**Goal:** Add `--chart boxplot` to `vega-paper infer`.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-boxplot-design.md](../specs/2026-06-04-vega-paper-infer-boxplot-design.md)

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | chart type, encoding branch, aggregate guard |
| `packages/cli/src/commands/infer.ts` | parser, `validateBoxplotOptions`, aggregate rejection |
| `packages/cli/test/infer.test.ts` | boxplot spec + validation tests |
| `packages/cli/test/infer-command.test.ts` | command passthrough + errors |

## Tasks

- [ ] Core boxplot encoding and mark
- [ ] Command validation and chart parser
- [ ] Tests and `bun test` / typecheck / build
