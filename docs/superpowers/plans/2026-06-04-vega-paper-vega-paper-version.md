# VegaPaper Version in Figure Meta Implementation Plan

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-vega-paper-version-design.md](../specs/2026-06-04-vega-paper-vega-paper-version-design.md)

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/figure-meta.ts` | `FigureMetaVersions`, `resolveFigureMetaVersions`, `vegaPaperVersion` |
| `packages/cli/src/commands/infer.ts` | Import rename |
| `packages/cli/src/commands/render.ts` | Import rename |
| `packages/cli/test/figure-meta.test.ts` | Updated expectations |

## Tasks

1. Rename types/functions and add CLI package.json read
2. Update command imports
3. Update tests; run `bun test`, `typecheck`, `check`, `build`
