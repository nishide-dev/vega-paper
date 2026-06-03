# Infer Aggregate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `--aggregate <method>` to `vega-paper infer`, emitting Vega-Lite `transform` aggregation on the chart-bearing spec.

**Architecture:** Build encoding and inner unit spec as today; when `aggregateMethod` is set, attach `transform: [buildAggregateTransform(...)]` to inner spec (top-level when flat). Command validates method enum only.

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-infer-aggregate-design.md](../specs/2026-06-04-vega-paper-infer-aggregate-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | `InferAggregateMethod`, `buildAggregateTransform`, inject `transform` |
| `packages/cli/src/commands/infer.ts` | Register `--aggregate`; parse method |
| `packages/cli/test/infer.test.ts` | Transform shape, count, facet, heatmap tests |
| `packages/cli/test/infer-command.test.ts` | Passthrough and invalid method tests |

---

## Task 1: Core aggregate transform

**Files:**
- Modify: `packages/cli/src/core/infer.ts`
- Test: `packages/cli/test/infer.test.ts`

- [ ] **Step 1: Write failing core tests** (flat mean+color, count, facet inner, heatmap sum)
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `buildAggregateTransform` and inject on `innerSpec`**
- [ ] **Step 4: Run core tests**

---

## Task 2: Command `--aggregate`

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`
- Test: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Write failing command tests**
- [ ] **Step 2: Register option and `parseInferAggregateMethod`**
- [ ] **Step 3: Run command + core tests**

---

## Task 3: Final verification

- [ ] **Step 1:** `bun test`, `bun run typecheck`, `bun run build`

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Optional `--aggregate` six methods | Task 2 |
| Cartesian: aggregate y, groupby x+color? | Task 1 |
| Heatmap: aggregate color, groupby x+y | Task 1 |
| Transform on inner spec when faceted | Task 1 |
| count = row count, no field | Task 1 |
| Always emit transform when flag set | Task 1 |
| No transform when omitted | Task 1 regression |
| No lint changes | — |
