# Skill Scripts Design

Date: 2026-06-03

## Context

Phase 2 brainstorm agreed on thin CLI wrappers under `skills/vega-paper/scripts/` with Bun tests, after the four reference docs.

## Goals

- Add `validate-spec.ts` → spawns `lint` with defaults (`--profile paper`, optional `--strict`).
- Add `render-chart.ts` → spawns `render` with `--format svg`, default `--theme paper-clean`.
- Shared repo-root / CLI path resolution.
- Bun tests for argv building, defaults, and exit-code delegation (mocked spawn).
- Document scripts in `SKILL.md` (CLI prefix remains canonical).

## Non-Goals

- Globally installed binary wrappers.
- Infer wrapper script.
- MCP server.

## Script interfaces

```text
bun run skills/vega-paper/scripts/validate-spec.ts <spec> [--lint-profile paper] [--strict]
bun run skills/vega-paper/scripts/render-chart.ts <spec> --out <path> [--theme paper-clean]
```

Run from repository root.

## Files

| File | Change |
|------|--------|
| `skills/vega-paper/scripts/cli.ts` | Shared path helpers |
| `skills/vega-paper/scripts/validate-spec.ts` | Lint wrapper |
| `skills/vega-paper/scripts/render-chart.ts` | Render wrapper |
| `skills/vega-paper/scripts/*.test.ts` | Bun tests |
| `skills/vega-paper/SKILL.md` | Scripts section |

## Verification

- `bun test skills/vega-paper/scripts`
- `bun run check`
