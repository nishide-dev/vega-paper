# NeurIPS Clean Theme Design

Date: 2026-06-03

## Context

Phase 3 venue-specific themes. `acl-clean` covers ACL/EMNLP narrow columns; ML conferences (NeurIPS, ICML) need a distinct built-in preset.

## Goals

- Add `neurips-clean` theme in `packages/themes`
- Register after `acl-clean` in theme order
- Update tests and `theme-catalog.md`

## Non-Goals

- Separate EMNLP theme (use `acl-clean`)
- Lint profile changes

## Theme metadata

| Field | Value |
|-------|-------|
| name | `neurips-clean` |
| displayName | NeurIPS Clean |
| target | paper |
| mode | light |
| description | NeurIPS / ICML / ML conference theme with clear series colors and readable single-column figures |

## Verification

- `bun test packages/themes packages/cli/test/themes-command.test.ts`
- `bun run typecheck`
