# Output Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `svg|png|pdf` render output with `--scale` via Vega CLI binaries; keep SVG canonical.

**Architecture:** Extend `RenderFormat` and `external-vega-cli` binary map; `normalizeRenderOptions` infers format from extension; six shims in tarball/install; figure meta records format/scale.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-output-formats-design.md](../specs/2026-06-04-vega-paper-output-formats-design.md)

---

### Task 1: Render format core + Vega CLI backend

**Files:** `packages/cli/src/core/render-format.ts`, `packages/cli/src/core/render.ts`, `packages/cli/src/backends/external-vega-cli.ts`, `packages/cli/test/render-formats.test.ts`, `packages/cli/test/external-vega-cli.test.ts`

- [ ] `RenderFormat`, `parseScale`, `inferFormatFromPath`, `assertFormatMatchesExtension`
- [ ] Six binaries; argv `[input, output]` + `-s` when scale ≠ 1
- [ ] Unit tests for normalization and binary names

### Task 2: render + infer commands

**Files:** `packages/cli/src/commands/render.ts`, `packages/cli/src/commands/infer.ts`, `packages/cli/test/render-options.test.ts`, `packages/cli/test/infer-command.test.ts`

- [ ] `--scale` on render; infer accepts `.png`/`.pdf` `--out`

### Task 3: Figure meta + doctor

**Files:** `packages/cli/src/core/figure-meta.ts`, `packages/cli/src/core/doctor.ts`, tests

- [ ] `format` + `scale` on meta; six doctor checks

### Task 4: Distribution scripts + CI smoke

**Files:** `scripts/build-release-tarball.sh`, `scripts/install.sh`, `scripts/install-tarball-smoke.sh`

- [ ] Six shims; smoke renders PNG once

### Task 5: Docs + roadmap

**Files:** `README.md`, `skills/vega-paper/SKILL.md`, `docs/roadmap.md`, spec/plan paths

- [ ] Phase 4.5 done when merged

### Task 6: Verify + PR

- [ ] `bun run check && bun test`
