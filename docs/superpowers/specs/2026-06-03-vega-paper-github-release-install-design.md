# GitHub Release Tarball Install Design (Phase 4a-2)

Date: 2026-06-03

Supersedes the **npm publish** and **prefix `bun install`** paths in [`2026-06-03-vega-paper-cli-distribution-design.md`](./2026-06-03-vega-paper-cli-distribution-design.md).

## Context

Phase 4a-1 shipped install-root resolution, `install.sh` layout, `dist/` builds, and `--from-repo` CI smoke. Production install must **not** use npm.

**Distribution model:** one **platform tarball per GitHub Release**, downloaded by `curl | bash` via `scripts/install.sh`.

Phase 4a-1 spec assumed npm publish; this spec replaces that with Release artifacts only.

## Goals

1. **Release tarball (option A):** each asset contains `vega-paper` + `vl2svg` + `vg2svg` + bundled Vega CLI dependencies for that platform.
2. **`install.sh` production path:** detect OS/arch → download Release asset → extract to `VEGA_PAPER_HOME` → write PATH shims.
3. **GitHub Actions release workflow:** build tarballs on version tags; attach to GitHub Release.
4. **Version pinning:** `install.sh --version v0.1.0` (default: repo’s current release tag or `latest` redirect).
5. **Keep `--from-repo`:** unchanged for contributors and CI (`bun run install:smoke`).

## Non-Goals

- npm publish, `bunx`, or `bun install vega-paper@…` in production `install.sh`
- Bundling a Node.js runtime inside the tarball (Node remains a host dependency; `doctor` already requires it)
- Windows tarball in the first slice (follow-up)
- MCP, custom themes

## Approaches considered

| Approach | Tarball contents | Trade-off |
|----------|------------------|-----------|
| **A. Compiled CLI + bundled `node_modules` (chosen)** | `vega-paper` (`--compile`) + vendored `vega-lite` / `vega-cli` bins | Node on PATH required for `vl2svg`; tarball size moderate; matches existing doctor checks |
| B. Compiled CLI only | Single binary | Users must install Vega CLI separately; poor UX |
| C. Full runtime bundle | A + embedded Node binary | Largest artifacts; true offline; defer |

## Tarball layout

Asset name:

```text
vega-paper-{version}-{target}.tar.gz
```

Example: `vega-paper-0.1.0-darwin-arm64.tar.gz`

Extracted prefix (also `VEGA_PAPER_HOME` after install):

```text
vega-paper-0.1.0-darwin-arm64/
  VERSION
  bin/
    vega-paper          # bun build --compile (single executable)
    vl2svg              # shim → ../lib/node_modules/.bin/vl2svg
    vg2svg              # shim → ../lib/node_modules/.bin/vg2svg
  lib/
    node_modules/       # production install of vega-lite + vega-cli (+ transitive deps)
```

`@vega-paper/themes` and CLI logic are **inside** the compiled `vega-paper` binary (no separate themes package in tarball).

### Shim contract

Production `install.sh` writes `$PREFIX/bin/*` wrappers that:

```bash
export VEGA_PAPER_HOME="$HOME/.local/share/vega-paper/current"
exec "$VEGA_PAPER_HOME/bin/vega-paper" "$@"
```

Use a `current` symlink (or versioned dir + symlink) so upgrades replace the symlink target without rewriting user PATH.

## Platform targets (MVP)

| `target` | Bun `--target` | Runner |
|----------|----------------|--------|
| `darwin-arm64` | `bun-darwin-arm64` | macos-14 (or macos-latest) |
| `darwin-x64` | `bun-darwin-x64` | macos-13 |
| `linux-x64` | `bun-linux-x64` | ubuntu-latest |

Defer: `linux-arm64`, `windows-x64`.

## Build pipeline

New script: `scripts/build-release-tarball.sh`

Per target (in CI or locally with cross-compile):

1. `bun install --frozen-lockfile` at repo root
2. `bun run build` (themes + CLI dist; validates compile inputs)
3. **Compile CLI:**

   ```bash
   bun build packages/cli/src/index.ts \
     --compile \
     --target=bun-${TARGET} \
     --outfile staging/bin/vega-paper
   ```

4. **Stage Vega CLI deps** in `staging/lib/`:

   ```bash
   # minimal package.json with vega-lite + vega-cli only
   cd staging/lib && bun install --production
   ```

5. Write `bin/vl2svg` and `bin/vg2svg` shell shims invoking `../lib/node_modules/.bin/*`
6. Write `VERSION` file
7. `tar czf vega-paper-${VERSION}-${TARGET}.tar.gz` from staging root

Local smoke (before Release): `install.sh --from-tarball path/to/vega-paper-….tar.gz` (dev flag).

## `install.sh` production path

Replace the current `bun install vega-paper@${VERSION}` branch.

Steps:

1. Parse `--version` (default `0.1.0` or read from remote `VERSION` file on tag).
2. `detect_target` → `darwin-arm64` | `darwin-x64` | `linux-x64`; fail with clear message if unsupported.
3. Download:

   ```text
   https://github.com/nishide-dev/vega-paper/releases/download/v{VERSION}/vega-paper-{VERSION}-{target}.tar.gz
   ```

4. Extract to `$VEGA_PAPER_HOME/versions/v{VERSION}/` and symlink `$VEGA_PAPER_HOME/current` → that directory.
5. Write shims in `$PREFIX/bin` pointing at `$VEGA_PAPER_HOME/current/bin/*`.
6. Print PATH instructions; suggest `vega-paper doctor`.

Remove: Bun auto-install and npm `package.json` staging from the default path.

Flags:

| Flag | Purpose |
|------|---------|
| `--version vX.Y.Z` | Pin Release tag |
| `--from-repo` | Existing dev/CI path (unchanged) |
| `--from-tarball PATH` | Dev/test extracted tarball without GitHub |
| `--home`, `--prefix` | Existing |

## Release workflow

New workflow: `.github/workflows/release.yml`

Trigger: `push` tags matching `v*.*.*`

Jobs:

1. **build** — matrix over targets; run `scripts/build-release-tarball.sh`; upload artifacts
2. **release** — `softprops/action-gh-release` (or `gh release create`) attach tarballs + generate notes

CI on PRs does **not** upload Release assets (optional: build one target as smoke without upload).

## CLI / doctor alignment

Existing Phase 4a-1 behavior should work when:

- `VEGA_PAPER_HOME` points at extracted prefix (`current` symlink)
- `vl2svg` / `vg2svg` on PATH via shims

Verify after install:

- `vega-paper doctor` exits 0
- `vega-paper render … --out /tmp/out.svg` from arbitrary cwd

Compiled binary: `resolveCliPackageRootFromMeta` already handles `dist/` parent; confirm compiled layout sets version lookup via `VEGA_PAPER_HOME/lib/node_modules` for `vega` / `vega-lite` versions in figure meta.

**Follow-up in implementation:** when `VEGA_PAPER_HOME` is set, `resolveFigureMetaVersions` should read Vega package versions from `$VEGA_PAPER_HOME/lib/node_modules`, not `$VEGA_PAPER_HOME/node_modules`.

## Documentation updates

| File | Change |
|------|--------|
| `README.md` | Release install as primary; remove npm/bunx references |
| `docs/roadmap.md` | Mark 4a-2 scope (already updated) |
| `skills/vega-paper/SKILL.md` | Installed users: `vega-paper` from Release |

## Verification

- [ ] `scripts/build-release-tarball.sh` produces a valid tarball locally (darwin-arm64 host)
- [ ] `install.sh --from-tarball` → `doctor` + render smoke
- [ ] Tag `v0.1.0` publishes three tarballs on GitHub Release
- [ ] `curl | bash` install on clean macOS / Linux VM
- [ ] `bun run install:smoke` (`--from-repo`) still passes
- [ ] Full `bun test` unchanged

## Implementation slices

| Slice | Deliverable |
|-------|-------------|
| **4a-2a** | `build-release-tarball.sh` + figure-meta path fix for `lib/node_modules` |
| **4a-2b** | `install.sh` Release download + `current` symlink layout |
| **4a-2c** | `release.yml` + first tagged release |
| **4a-2d** | README/SKILL; remove npm branch from `install.sh` |

## Open decisions (defaults)

| Question | Default |
|----------|---------|
| Default install version | Latest GitHub Release tag (fallback hardcoded `0.1.0` in script) |
| Node required? | Yes (doctor required check) |
| Bun required after install? | No (compiled `vega-paper`) |
| Repo slug in URL | `nishide-dev/vega-paper` |

## Success criteria

- [ ] User runs `curl -fsSL …/install.sh | bash` without clone or Bun installed
- [ ] `vega-paper` + render works; user does not manually install `vl2svg`
- [ ] No npm registry involvement
