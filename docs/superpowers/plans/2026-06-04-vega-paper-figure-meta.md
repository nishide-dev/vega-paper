# Figure Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `vega-paper infer … --out <path.svg>` completes render successfully, write sibling `<path>.meta.json` with provenance and infer option snapshot.

**Architecture:** New `core/figure-meta.ts` owns path derivation, snapshot building, version lookup, and file write. `infer` command calls it once after `runRender` succeeds. Optional dependency injection on `registerInferCommand` for tests (same pattern as `writeSpec`).

**Tech Stack:** Bun, TypeScript, Commander, bun:test

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-figure-meta-design.md](../specs/2026-06-04-vega-paper-figure-meta-design.md)

---

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/figure-meta.ts` | **New** — types, `toSiblingMetaPath`, `buildInferSnapshot`, `resolveVegaDependencyVersions`, `buildFigureMeta`, `writeFigureMeta` |
| `packages/cli/src/commands/infer.ts` | After successful render: build + write meta; optional `writeFigureMeta` inject |
| `packages/cli/test/figure-meta.test.ts` | **New** — pure helper tests |
| `packages/cli/test/infer-command.test.ts` | Meta written / not written integration cases |

---

## Task 1: Core `figure-meta` helpers

**Files:**
- Create: `packages/cli/src/core/figure-meta.ts`
- Test: `packages/cli/test/figure-meta.test.ts`

- [ ] **Step 1: Write failing tests for `toSiblingMetaPath`**
  - `figures/f1.svg` → `figures/f1.meta.json`
  - `chart.svg` → `chart.meta.json`

- [ ] **Step 2: Implement `toSiblingMetaPath`** (mirror `toSiblingSpecPath` in `infer.ts`; consider exporting shared helper or duplicating one-liner to avoid coupling)

- [ ] **Step 3: Write failing tests for `buildInferSnapshot`**
  - Required keys always: `chart`, `x`, `y`
  - Optional keys only when corresponding CLI option present (`color`, `facet`, `aggregate`, `errorBand`, `inlineData: true`, types, `title`, `width`, `height`)
  - `errorBand` camelCase from `--error-band`
  - Omit `theme`, `specOut`, lint fields

- [ ] **Step 4: Implement `buildInferSnapshot(options: InferCommandOptions)`** using raw Commander options (not `InferRequest`) so unset width/height defaults in core infer do not appear in meta

- [ ] **Step 5: Write failing tests for `buildFigureMeta`**
  - Top-level fields: `generatedBy`, `input`, `output`, `specOut`, `createdAt`, versions
  - `theme` present only when `options.theme` set
  - `specOut` = explicit `--spec-out` or derived sibling of `--out`
  - Fixed `createdAt` injectable in tests (pass `now?: Date` to builder)

- [ ] **Step 6: Implement `buildFigureMeta`**

- [ ] **Step 7: Write failing test for `resolveVegaDependencyVersions`**
  - Returns semver strings from installed `vega` and `vega-lite` in workspace `node_modules`
  - Mock or read real packages in test env

- [ ] **Step 8: Implement `resolveVegaDependencyVersions`**
  - Resolve from `packages/cli` package root → `node_modules/vega/package.json`, `vega-lite/package.json`
  - Throw `VegaPaperError` if unreadable

- [ ] **Step 9: Implement `writeFigureMeta`**
  - `mkdir` parent, UTF-8 JSON + trailing newline
  - Map write failures to `VegaPaperError`

- [ ] **Step 10: Run `bun test packages/cli/test/figure-meta.test.ts`**

---

## Task 2: Wire `infer` command

**Files:**
- Modify: `packages/cli/src/commands/infer.ts`

- [ ] **Step 1: Add optional `writeFigureMeta` parameter to `registerInferCommand`** (default: real writer)

- [ ] **Step 2: After successful `runRender`, when `options.out` is set:**
  1. `metaPath = toSiblingMetaPath(options.out)`
  2. `versions = await resolveVegaDependencyVersions()`
  3. `meta = buildFigureMeta({ inputPath, options, specOut: request.specOutputPath as string for path recording — use `options.specOut ?? toSiblingSpecPath(options.out)` for meta `specOut` field per spec })`
  4. `await writeFigureMeta(metaPath, meta)`
  5. `writeOutput(\`Wrote ${metaPath}\n\`)`

- [ ] **Step 3: Ensure lint early-return paths do not write meta** (no change before render block)

- [ ] **Step 4: Export `toSiblingSpecPath` from command module or duplicate path logic in meta builder input** — meta `specOut` must match written spec path string (explicit CLI or derived sibling)

---

## Task 3: Command integration tests

**Files:**
- Modify: `packages/cli/test/infer-command.test.ts`

- [ ] **Step 1: Extend `runInferCommand` harness** with optional `writeFigureMeta` spy (or rely on real writes + `readFile`)

- [ ] **Step 2: Test — `--out` + mocked render writes meta at sibling path**
  - Parse JSON; assert `input`, `output`, `specOut`, `infer.chart/x/y`
  - Stdout contains `Wrote …meta.json`

- [ ] **Step 3: Test — `--theme` included in meta, omitted when not passed**

- [ ] **Step 4: Test — explicit `--spec-out` recorded in meta `specOut`**

- [ ] **Step 5: Test — `--spec-out` only (no `--out`) → no meta file**

- [ ] **Step 6: Test — lint strict failure before render → no meta file**
  - Mock lint returning issues + exit 1; render not called

- [ ] **Step 7: Run `bun test packages/cli/test/infer-command.test.ts`**

---

## Task 4: Final verification

- [ ] **Step 1:** `bun test`
- [ ] **Step 2:** `bun run typecheck`
- [ ] **Step 3:** `bun run check`
- [ ] **Step 4:** `bun run build`

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Meta only on `infer --out` success | Task 2, 3 |
| Sibling path `f1.svg` → `f1.meta.json` | Task 1 |
| Top-level provenance fields | Task 1 |
| `infer` nested snapshot, optional keys only | Task 1 |
| Paths as CLI strings; derived `specOut` when implicit | Task 1, 2 |
| `theme` omitted when unset | Task 1, 3 |
| Versions from installed `node_modules` | Task 1 |
| ISO 8601 `createdAt` | Task 1 |
| No meta on lint failure / no `--out` | Task 3 |
| Stdout `Wrote …meta.json` | Task 2, 3 |
| No new CLI flags | Task 2 |
| No `render` meta / no full bundle | — |

---

## Implementation Notes

- **`buildFigureMeta` input:** Pass `{ inputPath, options: InferCommandOptions, specOutPath, createdAt?, versions? }` so tests avoid filesystem for versions when desired.
- **Do not** add meta fields for `lintProfile` / `strict` in this slice.
- **Biome:** New TS files fall under existing `biome.json` scope; run `check` before PR.
- **Examples:** Do not regenerate `infer:examples` scripts (they use `--spec-out` only, no `--out`).
