# Grayscale Safety Lint Implementation Plan

**Spec:** [docs/superpowers/specs/2026-06-03-vega-paper-grayscale-safety-lint-design.md](../specs/2026-06-03-vega-paper-grayscale-safety-lint-design.md)

## Tasks

1. Extend `lint-profiles.ts` with `grayscaleSafe` and `print` profile
2. Add grayscale rules to `lint-rules.ts`
3. Update lint/infer CLI help strings
4. Add tests; update skill references
5. `bun test` and `bun run check`
