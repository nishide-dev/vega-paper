# CLI Distribution & Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 4a-1 so users can `curl | bash` install `vega-paper` to PATH and render from any directory without a repo checkout.

**Architecture:** Publishable `dist/` bundles for `@vega-paper/themes` and `vega-paper`; a new `install-root` module resolves CLI package root and `VEGA_PAPER_HOME` for Vega CLI binaries and figure-meta versions; `scripts/install.sh` installs a pinned prefix under `~/.local/share/vega-paper` with bin shims.

**Tech Stack:** Bun, TypeScript, bash, npm pack (local verify before publish)

**Spec:** [docs/superpowers/specs/2026-06-03-vega-paper-cli-distribution-design.md](../specs/2026-06-03-vega-paper-cli-distribution-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/cli/src/core/install-root.ts` | Resolve CLI package root, `VEGA_PAPER_HOME`, install `node_modules/.bin` |
| `packages/cli/src/backends/external-vega-cli.ts` | Vega CLI lookup order (install root before cwd) |
| `packages/cli/src/core/figure-meta.ts` | Version lookup from CLI package root (unchanged path logic, shared helper) |
| `packages/cli/src/core/doctor.ts` | Resolve `vega-paper` on PATH; clearer messages |
| `packages/themes/package.json` | `files`, `exports` → `dist/` |
| `packages/cli/package.json` | `files`, `bin` → `dist/index.js`, build script |
| `scripts/install.sh` | curl installer |
| `scripts/install-local-smoke.sh` | Dev/CI smoke without npm publish |
| `packages/cli/test/install-root.test.ts` | Unit tests for path helpers |
| `packages/cli/test/external-vega-cli.test.ts` | Extend for install-root resolution |
| `README.md`, `skills/vega-paper/SKILL.md` | Install vs dev docs |

---

### Task 1: Install-root helpers

**Files:**
- Create: `packages/cli/src/core/install-root.ts`
- Create: `packages/cli/test/install-root.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  resolveCliPackageRootFromMeta,
  resolveInstallBinDirectory,
} from "../src/core/install-root";

describe("install-root", () => {
  test("resolveCliPackageRootFromMeta walks up from src/core to packages/cli", () => {
    const metaUrl = new URL("../src/core/install-root.ts", import.meta.url).href;
    const root = resolveCliPackageRootFromMeta(metaUrl);
    expect(root.endsWith(`${join("packages", "cli")}`)).toBe(true);
  });

  test("resolveInstallBinDirectory prefers VEGA_PAPER_HOME", () => {
    const original = process.env.VEGA_PAPER_HOME;
    process.env.VEGA_PAPER_HOME = "/tmp/vega-paper-home";

    try {
      expect(resolveInstallBinDirectory(import.meta.url)).toBe(
        join("/tmp/vega-paper-home", "node_modules", ".bin"),
      );
    } finally {
      if (original === undefined) {
        delete process.env.VEGA_PAPER_HOME;
      } else {
        process.env.VEGA_PAPER_HOME = original;
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/cli/test/install-root.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement helpers**

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveCliPackageRootFromMeta(importMetaUrl: string): string {
  const moduleDirectory = dirname(fileURLToPath(importMetaUrl));

  if (moduleDirectory.endsWith(`${join("dist", "core")}`)) {
    return join(moduleDirectory, "..", "..");
  }

  if (moduleDirectory.endsWith(`${join("src", "core")}`)) {
    return join(moduleDirectory, "..", "..");
  }

  return join(moduleDirectory, "..", "..");
}

export function resolveVegaPaperHome(): string | undefined {
  const home = process.env.VEGA_PAPER_HOME?.trim();
  return home && home.length > 0 ? home : undefined;
}

export function resolveInstallBinDirectory(importMetaUrl: string = import.meta.url): string {
  const home = resolveVegaPaperHome();

  if (home) {
    return join(home, "node_modules", ".bin");
  }

  return join(resolveCliPackageRootFromMeta(importMetaUrl), "node_modules", ".bin");
}

export function resolveCliNodeModulesDirectory(importMetaUrl: string = import.meta.url): string {
  const home = resolveVegaPaperHome();

  if (home) {
    return join(home, "node_modules");
  }

  return join(resolveCliPackageRootFromMeta(importMetaUrl), "node_modules");
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/cli/test/install-root.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/install-root.ts packages/cli/test/install-root.test.ts
git commit -m "feat: add install-root path helpers for CLI distribution"
```

---

### Task 2: Vega CLI resolution order

**Files:**
- Modify: `packages/cli/src/backends/external-vega-cli.ts`
- Modify: `packages/cli/test/external-vega-cli.test.ts`

- [ ] **Step 1: Write failing test — install bin before cwd**

Add to `external-vega-cli.test.ts`:

```typescript
test("resolves Vega-Lite binary from install bin before cwd node_modules", async () => {
  await withTemporaryWorkspace(async (workspace) => {
    const originalHome = process.env.VEGA_PAPER_HOME;
    process.env.VEGA_PAPER_HOME = join(workspace, "home");

    try {
      const installBinary = join(workspace, "home", "node_modules", ".bin", "vl2svg");
      const cwdBinary = join(workspace, "node_modules", ".bin", "vl2svg");
      await createExecutable(installBinary, "#!/bin/sh\nexit 0\n");
      await createExecutable(cwdBinary, "#!/bin/sh\nexit 1\n");

      expect(await resolveVegaCliBinary("vl2svg")).toBe(installBinary);
    } finally {
      if (originalHome === undefined) {
        delete process.env.VEGA_PAPER_HOME;
      } else {
        process.env.VEGA_PAPER_HOME = originalHome;
      }
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (cwd wins today)

Run: `bun test packages/cli/test/external-vega-cli.test.ts`

- [ ] **Step 3: Update resolver**

In `external-vega-cli.ts`, import `resolveInstallBinDirectory`, `resolveExecutableOnPath` from install-root/doctor.

Replace `resolveVegaCliBinary` body with ordered candidates:

```typescript
export async function resolveVegaCliBinary(binary: VegaCliBinaryName): Promise<string | undefined> {
  const candidates = [
    join(resolveInstallBinDirectory(), binary),
    join(await getWorkspacePath(), "node_modules", ".bin", binary),
    ...(await getBunPackageStoreCandidates(binary)),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return resolveExecutableOnPath(binary);
}
```

Extract `getBunPackageStoreCandidates` from existing `getBunPackageStoreBinary` logic (return array, not first match).

Update ENOENT error message:

```typescript
`Missing Vega CLI binary "${displayName}". Install vega-paper via install.sh or ensure ${displayName} is on PATH.`
```

Export `resolveExecutableOnPath` from `doctor.ts` if not already importable without cycle — if cycle, move `resolveExecutableOnPath` to `install-root.ts` or new `executable-path.ts`.

- [ ] **Step 4: Run tests**

Run: `bun test packages/cli/test/external-vega-cli.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/backends/external-vega-cli.ts packages/cli/test/external-vega-cli.test.ts
git commit -m "feat: resolve Vega CLI binaries from install prefix before cwd"
```

---

### Task 3: Doctor PATH resolution

**Files:**
- Modify: `packages/cli/src/core/doctor.ts`
- Modify: `packages/cli/test/doctor.test.ts`

- [ ] **Step 1: Write failing test**

Doctor should find `vega-paper` on PATH when not in cwd `node_modules/.bin`.

- [ ] **Step 2: Change `resolveExecutable` in doctor**

Try `resolveExecutableOnPath(name)` first, then cwd `node_modules/.bin`.

- [ ] **Step 3: Run `bun test packages/cli/test/doctor.test.ts`**

- [ ] **Step 4: Commit**

```bash
git commit -m "fix: doctor resolves vega-paper from PATH for global installs"
```

---

### Task 4: Figure-meta versions from CLI package root

**Files:**
- Modify: `packages/cli/src/core/figure-meta.ts`

- [ ] **Step 1: Use `resolveCliNodeModulesDirectory` in `resolveFigureMetaVersions`**

```typescript
import { resolveCliPackageRootFromMeta, resolveCliNodeModulesDirectory } from "./install-root";

export async function resolveFigureMetaVersions(): Promise<FigureMetaVersions> {
  const cliPackageRoot = resolveCliPackageRootFromMeta(import.meta.url);
  const nodeModules = resolveCliNodeModulesDirectory();

  return {
    vegaPaperVersion: await readPackageVersion(cliPackageRoot, "vega-paper"),
    vegaVersion: await readPackageVersion(join(nodeModules, "vega"), "vega"),
    vegaLiteVersion: await readPackageVersion(join(nodeModules, "vega-lite"), "vega-lite"),
  };
}
```

- [ ] **Step 2: Run `bun test packages/cli/test/figure-meta.test.ts`**

- [ ] **Step 3: Commit**

---

### Task 5: Publishable package builds

**Files:**
- Modify: `packages/themes/package.json`
- Modify: `packages/cli/package.json`
- Modify: root `package.json` (optional `build:packages` script)

- [ ] **Step 1: Themes package**

```json
{
  "main": "./dist/index.js",
  "exports": { ".": "./dist/index.js" },
  "files": ["dist/**"],
  "scripts": {
    "build": "bun ../../scripts/run-if-sources.ts build -- bun build ./src/index.ts --outdir dist --target bun"
  }
}
```

- [ ] **Step 2: CLI package**

```json
{
  "bin": { "vega-paper": "./dist/index.js" },
  "files": ["dist/**"],
  "scripts": {
    "build": "bun ../../scripts/run-if-sources.ts build -- bun run --filter @vega-paper/themes build && bun build ./src/index.ts --outdir dist --target bun --banner \"#!/usr/bin/env bun\""
  }
}
```

Add shebang via bun build `--banner` or post-build prepend script `scripts/add-shebang.ts`.

- [ ] **Step 3: Run `bun run build && bun test`**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: build dist bundles for publishable cli and themes packages"
```

---

### Task 6: install.sh

**Files:**
- Create: `scripts/install.sh`
- Create: `scripts/install-local-smoke.sh`

- [ ] **Step 1: Implement `scripts/install.sh`**

Flags: `--prefix`, `--home`, `--version`, `--no-modify-path`, `--help`.

Default:
- `VEGA_PAPER_HOME=$HOME/.local/share/vega-paper`
- `PREFIX=$HOME/.local`

Write `package.json` with `"dependencies": { "vega-paper": "<version>" }`, run `bun install` in home dir.

Shims in `$PREFIX/bin`:

```bash
#!/usr/bin/env bash
export VEGA_PAPER_HOME="${VEGA_PAPER_HOME:-$HOME/.local/share/vega-paper}"
exec bun "$VEGA_PAPER_HOME/node_modules/vega-paper/dist/index.js" "$@"
```

Same pattern for `vl2svg` / `vg2svg` pointing at `$VEGA_PAPER_HOME/node_modules/.bin/…`.

For **local dev smoke** (before npm publish), support:

```bash
scripts/install.sh --version file:../../packages/cli/vega-paper-0.1.0.tgz
```

via `scripts/install-local-smoke.sh` that runs `bun pm pack` in packages first.

- [ ] **Step 2: Manual smoke**

```bash
bash scripts/install-local-smoke.sh
export PATH="$HOME/.local/bin:$PATH"
vega-paper doctor
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add curl-installable install.sh with prefix layout"
```

---

### Task 7: Documentation

**Files:**
- Modify: `README.md`
- Modify: `skills/vega-paper/SKILL.md`

- [ ] **Step 1: README — add Install section**

```markdown
## Install

curl -fsSL https://raw.githubusercontent.com/nishide-dev/vega-paper/main/scripts/install.sh | bash

Then open a new shell and run `vega-paper doctor`.

## Development

(clone repo, bun install, vega-paper …)
```

- [ ] **Step 2: SKILL.md — prefer `vega-paper` when installed; repo path for contributors**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: add install instructions for curl and bunx paths"
```

---

### Task 8: CI smoke (optional job)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add job step after build**

```yaml
- name: Install smoke
  run: bash scripts/install-local-smoke.sh
- name: Doctor smoke
  run: |
    export PATH="$HOME/.local/bin:$PATH"
    vega-paper doctor
```

- [ ] **Step 2: Commit**

---

### Task 9: Final verification

- [ ] Run `bun run check && bun run typecheck && bun test`
- [ ] Manual: install smoke + render absolute path to `/tmp/out.svg`
- [ ] Update `docs/roadmap.md` Phase 4a status when merged

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| curl install.sh | Task 6 |
| one command on PATH | Task 6 shims |
| npm publish shape | Task 5 |
| install-prefix layout | Task 6 |
| resolution order | Task 2 |
| doctor installed mode | Task 3 |
| figure-meta versions | Task 4 |
| README/SKILL docs | Task 7 |
| unit + integration verify | Tasks 1–2, 8–9 |
| 4a-2 compiled binary | Out of scope |

## Deferred (4a-2)

- GitHub Release `bun build --compile` artifacts
- `install.sh --binary` flag
