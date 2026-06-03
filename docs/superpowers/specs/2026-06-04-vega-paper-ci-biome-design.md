# VegaPaper CI and Biome Design

## Context

The repository has no GitHub Actions workflows and no code linter/formatter. `initial-design.md` recommends Biome (or eslint + prettier). PR checks are currently empty.

## Goals

- Add GitHub Actions CI on `pull_request` and `push` to `main`.
- Pin Bun via `.bun-version` (`1.3.14`).
- Introduce Biome for TypeScript/JSON code quality.
- Run in CI: `check` → `test` → `typecheck` → `build`.
- Apply Biome to `packages/**`, `scripts/**`, and root config files.
- Exclude `docs/`, `examples/**/*.vl.json`, `dist/`, and `node_modules/`.
- Format all in-scope files in the introducing PR so CI is green on merge.
- Add npm scripts `check` and `check:fix` (distinct from `vega-paper lint`).

## Non-Goals

- Pre-commit hooks, Dependabot, ESLint/Prettier.
- Running `vega-paper lint`, `infer:examples`, or render smoke in CI.
- Biome on design docs or committed example Vega-Lite specs.
- Parallel CI jobs.

## Architecture

| File | Purpose |
|------|---------|
| `.bun-version` | Pin Bun for local + CI |
| `biome.json` | Linter/formatter config + ignores |
| `.github/workflows/ci.yml` | Single-job pipeline |
| `package.json` | `@biomejs/biome`, `check`, `check:fix` |

## CI Steps

1. checkout
2. oven-sh/setup-bun (read `.bun-version`)
3. `bun install --frozen-lockfile`
4. `bun run check`
5. `bun test`
6. `bun run typecheck`
7. `bun run build`
