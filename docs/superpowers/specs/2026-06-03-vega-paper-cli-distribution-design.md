# CLI Distribution & Install Design (Phase 4a)

Date: 2026-06-03

## Context

VegaPaper is developed and run from a monorepo checkout (`vega-paper`). Phase 2 Skill docs explicitly avoid assuming a global binary. External users, CI outside the repo, and future MCP need an install path where **`vega-paper` on PATH is enough to render**.

Render still shells out to official Vega CLI binaries (`vl2svg`, `vg2svg`). A standalone compiled `vega-paper` executable alone is insufficient unless those binaries are also installed or bundled.

See [`roadmap.md`](../../roadmap.md) Phase 4a. Custom themes (4b) and MCP (5) depend on this slice.

## Goals

1. **User-facing install:** `curl -fsSL …/install.sh | bash` installs a working CLI (primary UX).
2. **One command on PATH:** After install, `vega-paper doctor` passes and `vega-paper render …` works without a repo checkout.
3. **Package publish:** Publish `vega-paper` and `@vega-paper/themes` to npm (Bun-compatible; `bunx vega-paper` also documented).
4. **Install-prefix layout:** Bundle `vega-paper` + Vega CLI deps under a single prefix; expose `vega-paper`, `vl2svg`, and `vg2svg` on PATH (user sees one tool; render deps are handled).
5. **Docs:** README, SKILL.md, and `roadmap.md` distinguish **installed** vs **dev-repo** invocation.

## Non-Goals

- **Compiled release binaries** (`bun build --compile` per OS/arch) — follow-up slice 4a-2 after npm + install.sh work.
- Custom theme files (Phase 4b).
- MCP server (Phase 5).
- Homebrew formula / apt packages (optional later; install.sh is enough for MVP).
- Changing render backend away from official `vl2svg` / `vg2svg`.

## Approaches considered

| Approach | Summary | Trade-off |
|----------|---------|-----------|
| **A. npm/bunx only** | Document `bunx vega-paper` | Low effort; poor “curl install” UX; PATH/`vl2svg` left to user |
| **B. install.sh + prefix (recommended)** | curl script → `~/.local/share/vega-paper` with `node_modules` + bin shims | Matches “normal CLI” feel; one-time shell setup |
| **C. Single compiled binary** | GitHub Release artifact, no Bun on target | Best isolation; heavy CI; still must bundle or ship `vl2svg` |

**Recommendation:** **B for Phase 4a-1**, **C as Phase 4a-2**. npm publish supports both B (install into prefix) and direct `bunx`.

## Recommended design

### Install layout

Default prefix: `$VEGA_PAPER_HOME` or `~/.local/share/vega-paper`.

```text
~/.local/share/vega-paper/          # VEGA_PAPER_HOME
  package.json                      # pins vega-paper + vega-lite + vega-cli
  node_modules/
    .bin/vl2svg
    .bin/vg2svg
    vega-paper/ …
~/.local/bin/                       # user PATH (install.sh appends if missing)
  vega-paper    → shim to Bun + CLI entry under VEGA_PAPER_HOME
  vl2svg        → shim into prefix node_modules/.bin/vl2svg
  vg2svg        → shim into prefix node_modules/.bin/vg2svg
```

Shims may be small shell scripts:

```bash
#!/usr/bin/env bash
exec bun "$VEGA_PAPER_HOME/node_modules/vega-paper/dist/index.js" "$@"
```

(`dist/index.js` after publish build; dev-repo continues using `src/index.ts`.)

### `install.sh` behavior

Location: `scripts/install.sh` (served from repo raw URL or project site later).

Steps:

1. Parse flags: `--prefix`, `--version`, `--no-modify-path`, `--help`.
2. Ensure **Bun** exists (install via `https://bun.sh/install` if missing; honor existing `~/.bun/bin`).
3. Create `$VEGA_PAPER_HOME`, write minimal `package.json` pinning `vega-paper@<version>`.
4. Run `bun install` in that directory (pulls `vega-lite`, `vega-cli`, `@vega-paper/themes` transitively).
5. Write shims into `$PREFIX/bin` (default `~/.local/bin`).
6. Print next steps: open new shell or `export PATH=…`, run `vega-paper doctor`.

Idempotent: re-run upgrades pinned version when `--version` set.

Documented one-liner (placeholder until domain):

```bash
curl -fsSL https://raw.githubusercontent.com/nishide-dev/vega-paper/main/scripts/install.sh | bash
```

### npm package shape

**`@vega-paper/themes`**

- Publish with `files: ["dist/**"]` (built JS, not only `.ts` sources).
- `exports` → `./dist/index.js`.
- Version aligned with `vega-paper`.

**`vega-paper`**

- Replace `"@vega-paper/themes": "workspace:*"` with semver range before publish.
- `bin.vega-paper` → `./dist/index.js` with shebang `#!/usr/bin/env bun` (or document Bun as runtime requirement for 4a-1).
- `files`: `dist/**`, README snippet.
- `dependencies`: `@vega-paper/themes`, `commander`, `vega`, `vega-lite`, `vega-cli` (unchanged).
- Build step produces `dist/index.js` (existing `bun build` in package script; ensure themes package builds first).

Monorepo dev: keep `workspace:*`; release script or CI job rewrites/version-tags for publish.

### CLI resolution changes

Today `resolveVegaCliBinary` searches **cwd** `node_modules/.bin`, then Bun package store under cwd. That breaks when the user runs `vega-paper` from an arbitrary project directory.

**New resolution order** (highest priority first):

1. `process.env.VEGA_PAPER_HOME/node_modules/.bin/<binary>` when set.
2. **Install root** derived from running CLI location (`import.meta.url` → package root → `node_modules/.bin`).
3. cwd `node_modules/.bin` (current behavior for paper repos that depend on vega locally).
4. Bun package-store under cwd (current).
5. `PATH` (`resolveExecutableOnPath`) — already used as fallback in doctor for Vega CLIs; extend primary resolver to match.

Error messages: replace “Run bun install in this workspace” with “Run install.sh or ensure vl2svg is on PATH” when not in dev layout.

**`doctor` checks (installed mode):**

| Check | Required | Notes |
|-------|----------|-------|
| `vega-paper` on PATH | yes | shim or global bin |
| `vl2svg` | yes | shim or prefix |
| `vg2svg` | yes | shim or prefix |
| Bun | yes for 4a-1 | warn-only optional in 4a-2 compiled mode |
| Node | warn or optional | needed by some Vega CLI paths; revisit after install testing |

`figure-meta` version lookup must read versions from **install root** `node_modules`, not monorepo cwd.

### Documentation updates

| File | Change |
|------|--------|
| `README.md` | “Install” section: curl one-liner + `bunx`; keep “Development” with monorepo commands |
| `skills/vega-paper/SKILL.md` | Prefer `vega-paper …` when installed; fallback to repo path for contributors |
| `docs/roadmap.md` | Mark 4a-1 scope (this spec) vs 4a-2 compiled releases |

Dev-repo workflow **unchanged** for contributors.

### Verification

- **Unit tests:** install-root resolution helpers with injected paths (no real install).
- **Integration test (CI optional):** run `install.sh --prefix $TMP/vega-paper-test` in job; `vega-paper doctor`; render `examples/basic-line/chart.vl.json` to SVG.
- **Manual:** fresh machine or container without repo checkout.
- Existing `bun test` / monorepo dev path must remain green.

## Implementation slices

| Slice | Deliverable |
|-------|-------------|
| **4a-1a** | Publishable packages: themes + cli `dist` build, version fields, `files` whitelist |
| **4a-1b** | Install-root + Vega CLI resolution; doctor messages |
| **4a-1c** | `scripts/install.sh`, README/SKILL install docs |
| **4a-1d** | CI smoke: install script + render integration (optional job) |
| **4a-2** | GitHub Release compiled `vega-paper` + install.sh `--binary` path (deferred) |

## Open decisions (defaults chosen)

| Question | Default for 4a-1 |
|----------|------------------|
| npm org scope | `@vega-paper/themes` + `vega-paper` on public npm |
| Bun required at runtime? | Yes for 4a-1 (install.sh ensures Bun) |
| Pin Vega packages in install prefix? | Same semver as cli `package.json` dependencies |
| Global `bun install -g` vs prefix | Prefer **prefix + shims** for predictable `vl2svg` layout |

## Success criteria

- [ ] User without repo clone runs curl install and `vega-paper doctor` exits 0.
- [ ] `vega-paper render examples/basic-line/chart.vl.json --out /tmp/out.svg` works from any cwd when spec path is absolute (or after cd to project).
- [ ] `bunx vega-paper@<version> --help` works on a clean project with Vega deps installed.
- [ ] Monorepo contributors still use `vega-paper` or linked workspace without regression.
