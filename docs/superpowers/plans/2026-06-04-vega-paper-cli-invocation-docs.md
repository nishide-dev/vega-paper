# CLI Invocation Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all user- and agent-facing CLI documentation on `vega-paper …`, remove redundant skill script wrappers, and sweep the repository for obsolete `bun run packages/cli/src/index.ts` examples.

**Architecture:** Documentation-only change. Delete `skills/vega-paper/scripts/` and rewrite `SKILL.md` as the single agent entry point using installed CLI. Bulk-replace monorepo CLI paths in markdown; leave `package.json` maintainer scripts and `scripts/render-gallery.ts` unchanged per spec.

**Tech Stack:** Markdown, `rg` for verification, `bun test` / `bun run check`

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-cli-invocation-docs-design.md](../specs/2026-06-04-vega-paper-cli-invocation-docs-design.md)

---

## File map

| File / area | Action |
|-------------|--------|
| `skills/vega-paper/scripts/*` | Delete (5 files) |
| `skills/vega-paper/SKILL.md` | Rewrite CLI sections |
| `README.md` | Commands → `vega-paper`; remove skill scripts |
| `examples/custom-theme/README.md` | Replace CLI paths |
| `examples/theme-samples/README.md` | Replace CLI paths |
| `docs/releases/v0.1.0.md`, `v0.1.2.md` | Replace dev fallback wording |
| `docs/roadmap.md` | Skill scripts deprecated; CLI example |
| `docs/initial-design.md` | Note scripts removed (minimal edit) |
| `docs/superpowers/specs/*.md`, `plans/*.md` | Bulk replace (except new spec itself) |
| `docs/superpowers/specs/2026-06-03-vega-paper-skill-scripts-design.md` | Superseded header |
| `docs/superpowers/specs/2026-06-03-vega-paper-cli-distribution-design.md` | Update checklist item if still says dual path |

**Out of scope:** `package.json` scripts, `scripts/render-gallery.ts`, `scripts/render-theme-samples.ts`

---

### Task 1: Remove skill scripts

**Files:**
- Delete: `skills/vega-paper/scripts/cli.ts`
- Delete: `skills/vega-paper/scripts/validate-spec.ts`
- Delete: `skills/vega-paper/scripts/render-chart.ts`
- Delete: `skills/vega-paper/scripts/validate-spec.test.ts`
- Delete: `skills/vega-paper/scripts/render-chart.test.ts`

- [ ] **Step 1: Delete script directory contents**

```bash
rm -f skills/vega-paper/scripts/cli.ts \
      skills/vega-paper/scripts/validate-spec.ts \
      skills/vega-paper/scripts/render-chart.ts \
      skills/vega-paper/scripts/validate-spec.test.ts \
      skills/vega-paper/scripts/render-chart.test.ts
rmdir skills/vega-paper/scripts 2>/dev/null || true
```

- [ ] **Step 2: Run tests**

Run: `bun test`  
Expected: PASS (266 tests; script tests removed)

- [ ] **Step 3: Commit**

```bash
git add -A skills/vega-paper/scripts/
git commit -m "chore: remove redundant vega-paper skill script wrappers"
```

---

### Task 2: Rewrite `SKILL.md`

**Files:**
- Modify: `skills/vega-paper/SKILL.md`

- [ ] **Step 1: Replace Prerequisites + CLI invocation + remove Skill scripts**

Remove lines 19–53 (repo `bun run packages/cli` block and Skill scripts section). Replace with:

```markdown
## Prerequisites

Run before any render:

```bash
vega-paper doctor
```

If `vega-paper` is not on PATH, install from [README Install](../../../README.md#install) or, for vega-paper monorepo contributors, `bash scripts/install.sh --from-repo`.

Requires Vega CLI binaries (`vl2svg`, `vl2png`, `vl2pdf`, …). Fix `doctor` failures before rendering.

## CLI invocation

**IRON RULE:** Use `vega-paper <subcommand> …` for all CLI operations. Do not use `bun run packages/cli/src/index.ts`.

```bash
vega-paper <command> ...
```
```

- [ ] **Step 2: Replace workflow command blocks**

Step 3 infer:

```bash
vega-paper infer DATA.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "Training F1" \
  --spec-out figures/f1.vl.json \
  --lint-profile paper
```

Step 4 standalone lint (note: `lint` uses `--profile`, not `--lint-profile`):

```bash
vega-paper lint figures/f1.vl.json --profile paper
```

Step 5 infer + render:

```bash
vega-paper infer DATA.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --title "Training F1" \
  --spec-out figures/f1.vl.json \
  --theme paper-clean \
  --out figures/f1.svg \
  --lint-profile paper
```

Secondary render:

```bash
vega-paper render figures/f1.vl.json \
  --theme paper-clean \
  --format svg \
  --out figures/f1.svg
```

Other commands:

```bash
vega-paper themes show paper-clean
vega-paper doctor
```

- [ ] **Step 3: Update Agent checklist**

Replace SVG-only bullet with:

```markdown
- [ ] Output format matches user goal (`svg` for papers; `png` / `pdf` when requested)
- [ ] Commands in notes use `vega-paper`, not monorepo `bun run` paths
```

- [ ] **Step 4: Commit**

```bash
git add skills/vega-paper/SKILL.md
git commit -m "docs(skill): use installed vega-paper CLI in all examples"
```

---

### Task 3: Root README and example READMEs

**Files:**
- Modify: `README.md`
- Modify: `examples/custom-theme/README.md`
- Modify: `examples/theme-samples/README.md`

- [ ] **Step 1: `README.md`**

1. Development setup — replace:

```markdown
bun run packages/cli/src/index.ts --help
```

with:

```markdown
vega-paper --help
```

(Add one line: `Install locally first: bash scripts/install.sh --from-repo`.)

2. Commands section — replace all `bun run packages/cli/src/index.ts` with `vega-paper` (infer, render, lint blocks).

3. Fix lint example flag: `vega-paper lint figures/f1.vl.json --profile paper` (not `--lint-profile`).

4. Remove entire "Optional wrappers" block (lines ~156–161) that references `skills/vega-paper/scripts/`.

5. AI Skill table — no script rows.

- [ ] **Step 2: `examples/custom-theme/README.md`**

Replace:

```bash
bun run packages/cli/src/index.ts render ...
bun run packages/cli/src/index.ts themes show ...
```

with `vega-paper render ...` and `vega-paper themes show ...`.

- [ ] **Step 3: `examples/theme-samples/README.md`**

Replace render and lint examples with `vega-paper render ...` and `vega-paper lint ... --profile print`.

- [ ] **Step 4: Commit**

```bash
git add README.md examples/custom-theme/README.md examples/theme-samples/README.md
git commit -m "docs: use vega-paper in README and example command snippets"
```

---

### Task 4: Releases, roadmap, initial-design

**Files:**
- Modify: `docs/releases/v0.1.0.md`, `docs/releases/v0.1.2.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/initial-design.md` (skill scripts tree only if present)

- [ ] **Step 1: Release notes**

Replace:

```text
bun run packages/cli/src/index.ts
```

with:

```text
vega-paper
```

(or "install then `vega-paper`") in clone/dev sentences.

- [ ] **Step 2: `docs/roadmap.md`**

- Phase 2 skill bullets: change "Skill scripts: validate-spec, render-chart" → "Agents call `vega-paper` directly (skill scripts removed in doc unification)."
- Replace `bun run packages/cli/src/index.ts --help` with `vega-paper --help` if present.

- [ ] **Step 3: `docs/initial-design.md`**

In skill layout tree, remove or strike `validate-spec.ts` / `render-chart.ts` with note "removed — use `vega-paper` directly". Minimal edit; do not rewrite whole doc.

- [ ] **Step 4: Commit**

```bash
git add docs/releases/ docs/roadmap.md docs/initial-design.md
git commit -m "docs: align roadmap and releases with vega-paper CLI invocation"
```

---

### Task 5: Superpowers bulk replace

**Files:**
- Modify: all `docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md` except the new invocation spec (already documents both forms intentionally)

- [ ] **Step 1: Run replacement from repo root**

```bash
rg -l 'bun run packages/cli/src/index.ts' docs/superpowers --glob '*.md' \
  | grep -v '2026-06-04-vega-paper-cli-invocation-docs-design.md' \
  | while read -r f; do
      sed -i '' 's|PATH="$HOME/.bun/bin:$PATH" bun run packages/cli/src/index.ts|vega-paper|g' "$f"
      sed -i '' 's|bun run packages/cli/src/index.ts|vega-paper|g' "$f"
    done
```

On Linux use `sed -i` without `''`.

Also fix standalone `bun run packages/cli/...` fragments in `docs/superpowers/plans/2026-06-03-vega-paper-cli-distribution.md` line ~392 if pattern differs.

- [ ] **Step 2: Add superseded notice to skill-scripts spec**

At top of `docs/superpowers/specs/2026-06-03-vega-paper-skill-scripts-design.md`, after title:

```markdown
> **Superseded** by [2026-06-04-vega-paper-cli-invocation-docs-design.md](./2026-06-04-vega-paper-cli-invocation-docs-design.md). Skill scripts were removed; use `vega-paper lint` and `vega-paper render` directly.
```

- [ ] **Step 3: Update distribution spec checklist (optional clarity)**

In `docs/superpowers/specs/2026-06-03-vega-paper-cli-distribution-design.md`, change verification bullet "Monorepo contributors still use bun run..." to "Contributors install via `--from-repo` and use `vega-paper`; monorepo `bun run packages/cli` is not documented."

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/
git commit -m "docs: replace monorepo CLI paths with vega-paper in superpowers archive"
```

---

### Task 6: Reference docs spot-check

**Files:**
- Read: `skills/vega-paper/references/*.md`

- [ ] **Step 1: Grep references**

Run: `rg 'bun run packages/cli' skills/vega-paper/references/`  
Expected: no matches (already clean as of plan write)

- [ ] **Step 2: Fix any CLI examples found**

If any reference uses old path, replace with `vega-paper`. Ensure `paper-style-guide.md` / `theme-catalog.md` mention `vega-paper themes list` not bun path.

- [ ] **Step 3: Commit only if changes**

```bash
git add skills/vega-paper/references/
git commit -m "docs(skill): vega-paper prefix in reference docs"
```

---

### Task 7: Verification gate

- [ ] **Step 1: Markdown sweep**

Run:

```bash
rg 'bun run packages/cli/src/index.ts' --glob '*.md'
```

Expected: **zero hits** (or only inside `2026-06-04-vega-paper-cli-invocation-docs-design.md` when describing the old form — acceptable).

Also:

```bash
rg 'skills/vega-paper/scripts' --glob '*.md'
```

Expected: zero hits except superseded skill-scripts spec (historical paths OK in superseded doc body) or invocation spec. Remove stale README references.

- [ ] **Step 2: SKILL sanity**

Run: `rg 'bun run' skills/vega-paper/SKILL.md`  
Expected: no `bun run packages/cli`; no skill scripts section.

- [ ] **Step 3: Tests and lint**

Run: `bun run check && bun test`  
Expected: PASS

- [ ] **Step 4: Final commit if verification fixes only**

```bash
git add -A
git commit -m "docs: verification fixes for vega-paper CLI invocation sweep"
```

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| Single `vega-paper` prefix | 2, 3, 5 |
| Remove skill scripts | 1 |
| SKILL IRON RULE + prerequisites | 2 |
| README + examples | 3 |
| Superpowers sweep (scope C) | 5 |
| Releases / roadmap | 4 |
| Keep package.json scripts | — (out of scope) |
| Verification rg + tests | 7 |
| Superseded skill-scripts spec | 5 |
| Fix lint `--profile` vs infer `--lint-profile` | 2, 3 |

## Out of scope

- `package.json` script rewrites
- `scripts/render-gallery.ts` spawn
- CI grep gate
- Semver release tag
