# Render Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Emit sibling `*.meta.json` from `vega-paper render`, and add `command` to infer/render meta shapes.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-render-meta-design.md](../specs/2026-06-04-vega-paper-render-meta-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/figure-meta.ts` | Union types, `buildRenderFigureMeta`, infer `command` |
| `packages/cli/src/commands/render.ts` | Meta write + DI |
| `packages/cli/test/figure-meta.test.ts` | Render + infer command tests |
| `packages/cli/test/render-command.test.ts` | **New** integration tests |
| `packages/cli/test/infer-command.test.ts` | `command: "infer"` expectation |

---

## Task 1: Extend `figure-meta` types and builders

- [ ] Add `InferFigureMeta`, `RenderFigureMeta`, `FigureMeta` union
- [ ] `buildFigureMeta` → sets `command: "infer"`
- [ ] Add `buildRenderFigureMeta`
- [ ] Update `figure-meta.test.ts`

---

## Task 2: Wire `render` command

- [ ] Add optional `writeFigureMeta` inject to `registerRenderCommand`
- [ ] After successful render: build + write meta, stdout `Wrote …`

---

## Task 3: Command tests

- [ ] Create `render-command.test.ts`
- [ ] Update infer-command meta expectation

---

## Task 4: Final verification

- [ ] `bun test`, `bun run typecheck`, `bun run check`, `bun run build`

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| Render meta on success | Task 2, 3 |
| `command: "render"`, no specOut/infer/format | Task 1, 3 |
| `command: "infer"` on infer meta | Task 1, 3 |
| Sibling path + CLI strings | Task 2 |
| Theme when set only | Task 1, 3 |
