# Infer Error Band Implementation Plan

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-error-band-design.md](../specs/2026-06-04-vega-paper-infer-error-band-design.md)

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | `errorBandField`, `yError` encoding, guards |
| `packages/cli/src/commands/infer.ts` | `--error-band`, `validateErrorBandOptions` |
| `packages/cli/test/infer.test.ts` | core tests |
| `packages/cli/test/infer-command.test.ts` | command tests |
