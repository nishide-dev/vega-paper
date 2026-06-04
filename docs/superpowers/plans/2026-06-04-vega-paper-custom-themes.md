# Custom Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load user theme JSON files via unified `--theme <name|path>` while preserving built-in presets and merge semantics.

**Architecture:** Add `loadThemeFromFile` + `resolveThemeRef` in `@vega-paper/themes`; CLI uses shared `getCliTheme()` wrapping errors as `VegaPaperError`; `render` / `infer` / `themes show` call the resolver.

**Tech Stack:** Bun, TypeScript, Commander, existing `applyThemeToSpec` in CLI.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md](../specs/2026-06-04-vega-paper-custom-themes-design.md)

---

### Task 1: Theme file loader + schema

**Files:**
- Create: `packages/themes/src/theme-schema.ts`
- Create: `packages/themes/src/load-theme-file.ts`
- Create: `packages/themes/test/load-theme-file.test.ts`
- Modify: `packages/themes/src/index.ts`

- [ ] **Step 1:** Failing tests for valid minimal/full files, empty config, unknown keys, bad enums
- [ ] **Step 2:** Implement `loadThemeFromFile(absolutePath)` with strict top-level keys
- [ ] **Step 3:** `bun test packages/themes/test/load-theme-file.test.ts` passes
- [ ] **Step 4:** Export from `index.ts`

### Task 2: `resolveThemeRef`

**Files:**
- Create: `packages/themes/src/resolve-theme.ts`
- Create: `packages/themes/test/resolve-theme.test.ts`
- Modify: `packages/themes/src/index.ts`

- [ ] **Step 1:** Tests — built-in name, relative `.json`, unknown ref, file shadows built-in when `paper-clean.json` exists
- [ ] **Step 2:** Implement path detection + `resolveThemeRef(ref, { cwd })`
- [ ] **Step 3:** `bun test packages/themes/test/resolve-theme.test.ts` passes

### Task 3: CLI wiring

**Files:**
- Create: `packages/cli/src/core/theme.ts`
- Modify: `packages/cli/src/core/render.ts`, `packages/cli/src/commands/themes.ts`
- Modify: `packages/cli/src/commands/render.ts`, `packages/cli/src/commands/infer.ts` (help text only)
- Modify: `packages/cli/test/themes-command.test.ts`
- Create: `packages/cli/test/render-custom-theme.test.ts`

- [ ] **Step 1:** `getCliTheme(ref)` → `resolveThemeRef` + `VegaPaperError`
- [ ] **Step 2:** Replace `getCliTheme` duplicates in render + themes commands
- [ ] **Step 3:** Unit test: `applyThemeToSpec` via `renderChart` with temp theme file (mock backend or theme-only merge test)
- [ ] **Step 4:** `themes show` with temp JSON path; `bun test packages/cli/test/themes-command.test.ts packages/cli/test/render-custom-theme.test.ts`

### Task 4: Example + docs

**Files:**
- Create: `examples/custom-theme/theme.json`, `chart.vl.json`, `README.md`
- Modify: `README.md`, `skills/vega-paper/SKILL.md`, `skills/vega-paper/references/theme-catalog.md`
- Modify: `docs/roadmap.md` (Phase 4b status when done)

- [ ] **Step 1:** Example files + README render command
- [ ] **Step 2:** Skill + root README subsection

### Task 5: Verify

- [ ] `bun run check && bun test packages/themes packages/cli/test/themes-command.test.ts packages/cli/test/render-custom-theme.test.ts`
