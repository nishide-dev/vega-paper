# GitHub Release Tarball Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Phase 4a-2 — platform tarballs on GitHub Release, `install.sh` download path, no npm.

**Architecture:** `build-release-tarball.sh` compiles `vega-paper` and vendors `vega-lite`/`vega-cli` under `lib/node_modules`; production install extracts to `VEGA_PAPER_HOME/current`; install-root helpers detect release layout (`bin/` + `lib/node_modules`).

**Spec:** [docs/superpowers/specs/2026-06-03-vega-paper-github-release-install-design.md](../specs/2026-06-03-vega-paper-github-release-install-design.md)

---

### Task 1: Release layout in install-root

**Files:** `packages/cli/src/core/install-root.ts`, `packages/cli/test/install-root.test.ts`, `packages/cli/src/core/figure-meta.ts`

- [ ] Add `isReleaseInstallHome(home)` — true when `lib/node_modules` exists
- [ ] `resolveInstallBinDirectory` → `$HOME/bin` for release layout
- [ ] `resolveCliNodeModulesDirectory` → `$HOME/lib/node_modules` for release layout
- [ ] `resolveFigureMetaVersions` → read `$HOME/VERSION` for vegaPaperVersion when present
- [ ] Tests + `bun test packages/cli/test/install-root.test.ts packages/cli/test/figure-meta.test.ts`

### Task 2: `scripts/build-release-tarball.sh`

**Files:** Create `scripts/build-release-tarball.sh`

- [ ] Args: `--version`, `--target`, `--outdir`
- [ ] Compile CLI, stage lib deps, write bin shims, tar.gz output
- [ ] Local: `bash scripts/build-release-tarball.sh --target darwin-arm64 --version 0.1.0`

### Task 3: `install.sh` release path

**Files:** `scripts/install.sh`, `scripts/install-tarball-smoke.sh`, root `package.json`

- [ ] Add `--from-tarball`, GitHub download path, `current` symlink
- [ ] Remove npm/bun install branch
- [ ] `bun run install:tarball-smoke` for CI (build local tarball + install)

### Task 4: Release workflow

**Files:** `.github/workflows/release.yml`

- [ ] Matrix build on tag `v*.*.*`; upload Release assets

### Task 5: Docs

**Files:** `README.md`, `skills/vega-paper/SKILL.md`, `docs/roadmap.md`

- [ ] Mark 4a-2 done when merged

### Task 6: Verify

- [ ] `bun run check && bun test && bun run install:smoke && bun run install:tarball-smoke`
