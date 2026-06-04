# Grayscale Safety Lint Design

Date: 2026-06-03

## Context

Phase 3 includes grayscale safety checks (`initial-design.md` §6.4, §13). Themes include `monochrome-print`; lint had no print/grayscale-specific profile or rules.

## Goals

- Add **`print`** lint profile with stricter thresholds and `grayscaleSafe: true`.
- Add grayscale rules (warnings, only when `grayscaleSafe`):
  - **`grayscale-unsafe-color`** — explicit saturated hex/rgb in spec palette or static colors
  - **`color-only-series`** — multi-series line/bar distinguished only by `color` (no strokeDash/shape)
- Update CLI profile lists, tests, `paper-style-guide.md`, `theme-catalog.md`.

## Non-Goals

- Linting rendered SVG pixels
- Auto-fix or theme application during lint
- Venue-specific themes (NeurIPS, etc.)

## `print` profile thresholds

| Field | Value |
|-------|-------|
| titleMaxLength | 70 |
| widthRange | 180–480 |
| heightRange | 120–360 |
| maxInlineRows | 300 |
| maxColorCategories | 6 |
| minFontSize | 9 |
| grayscaleSafe | true |

## Verification

- `bun test packages/cli/test/lint.test.ts packages/cli/test/lint-profiles.test.ts`
- `bun run check`
