# CLI invocation documentation unification

**Status:** Approved for implementation planning  
**Depends on:** Phase 4a CLI distribution (install.sh, `vega-paper` on PATH)

## Problem

Documentation and the agent skill mix two CLI invocation styles:

- **Installed (intended for users and agents):** `vega-paper infer …`, `vega-paper render …`
- **Monorepo dev:** `bun run packages/cli/src/index.ts …`

`skills/vega-paper/SKILL.md` states both forms in Prerequisites but **all workflow examples** use the `bun run` path. Agents copy those examples and fail in user paper repos where only `vega-paper` is installed.

Optional skill scripts (`validate-spec.ts`, `render-chart.ts`) only spawn the monorepo CLI entry via Bun. They duplicate `vega-paper lint` / `vega-paper render` without adding behavior.

Phase 4a distribution spec already required SKILL to prefer `vega-paper`; this slice completes that across the repository (scope **C**).

## Goals

1. **Single CLI prefix** for user- and agent-facing commands: `vega-paper <subcommand> …`.
2. Update **`skills/vega-paper/SKILL.md`** and references so every infer/lint/render/themes example uses `vega-paper`.
3. **Remove** `skills/vega-paper/scripts/` (wrappers + tests) — agents call the CLI directly.
4. **Repository-wide doc sweep:** replace `bun run packages/cli/src/index.ts` in READMEs, examples, releases, and superpowers specs/plans.
5. Keep **`bun run <npm-script>`** only for repository maintenance (Biome, tests, gallery, infer:examples).

## Non-goals

- Changing install.sh, shims, or CLI implementation
- Replacing `package.json` dev scripts (`render:example`, etc.) unless trivially aligned later
- CI grep gate forbidding `bun run packages/cli` (optional follow-up)
- Updating `scripts/render-gallery.ts` internal spawn (maintainer-only; may stay on `bun run packages/cli` or switch to `vega-paper` in a separate maintainer pass)

## Invocation rules

| Context | Command form | Examples |
|---------|--------------|----------|
| User paper repo, agents, public docs | `vega-paper` | `vega-paper infer data.csv …`, `vega-paper doctor` |
| Repo maintenance | `bun run <script>` | `bun run check`, `bun run render:gallery`, `bun run infer:examples` |
| Monorepo CLI entry via Bun | **Do not document** | `bun run packages/cli/src/index.ts` — replace everywhere in docs |

**Prerequisite for agents:** `vega-paper doctor` must pass. If missing, point to [README Install](../../../README.md#install) or `bash scripts/install.sh --from-repo` for vega-paper contributors.

## SKILL.md changes

### Remove

- Dual "CLI invocation" blocks (installed vs repo `bun run packages/cli/...`)
- Entire **Skill scripts** section and script examples

### Add (top of skill body, after frontmatter)

Short rule for agents:

> Use **`vega-paper <subcommand> …`** for all CLI operations. Do not use `bun run packages/cli/src/index.ts`.

### Prerequisites (revised)

1. `vega-paper doctor` — required before render
2. Install pointer if `doctor` fails (curl install or `--from-repo` for monorepo dev)

### Workflow examples

Replace every block that uses `bun run packages/cli/src/index.ts` with equivalent `vega-paper` commands (infer, lint, render, themes show, doctor).

### Agent checklist

- Drop outdated "SVG-only MVP" / no PNG promises if still present; align with current output formats (svg, png, pdf).
- Explicit: commands in deliverables use `vega-paper`, not Bun repo entry.

## Skill scripts deprecation

Delete:

```text
skills/vega-paper/scripts/cli.ts
skills/vega-paper/scripts/validate-spec.ts
skills/vega-paper/scripts/render-chart.ts
skills/vega-paper/scripts/validate-spec.test.ts
skills/vega-paper/scripts/render-chart.test.ts
```

**Mapping for agents:**

| Former wrapper | Direct CLI |
|----------------|------------|
| `validate-spec.ts <spec> --lint-profile paper` | `vega-paper lint <spec> --profile paper` |
| `validate-spec.ts … --strict` | `vega-paper lint … --profile paper --strict` |
| `render-chart.ts <spec> --out path --theme paper-clean` | `vega-paper render <spec> --theme paper-clean --format svg --out path` |

## Documentation sweep (scope C)

### Search-and-replace

- **From:** `bun run packages/cli/src/index.ts`  
- **To:** `vega-paper`  
- **Also:** lines like `PATH="$HOME/.bun/bin:$PATH" bun run packages/cli/src/index.ts` → `vega-paper` (drop PATH prefix when only needed for monorepo entry)

### Directories / files

| Area | Action |
|------|--------|
| `skills/vega-paper/SKILL.md` | Full rewrite per above |
| `skills/vega-paper/references/*.md` | CLI examples → `vega-paper`; keep `bun run infer:examples` where maintainer-only |
| `README.md` | Quick start / Commands → `vega-paper`; Development keeps `bun install`, `bun test`, `bun run check`; remove AI Skill script examples |
| `examples/**/README.md` | Any remaining `bun run packages/cli` → `vega-paper` |
| `docs/releases/*.md` | User-facing commands → `vega-paper` |
| `docs/superpowers/specs/*.md`, `plans/*.md` | Bulk replace for consistency |
| `docs/roadmap.md`, `docs/initial-design.md` | Skill scripts → deprecated; note direct CLI |
| `docs/superpowers/specs/2026-06-03-vega-paper-skill-scripts-design.md` | Add superseded notice at top linking this spec |

### Do not replace

- `bun run check`, `bun test`, `bun run typecheck`, `bun run build`, `bun install`
- `bun run render:gallery`, `bun run infer:examples`, `bun run render:theme-samples`, other `package.json` scripts
- `scripts/render-gallery.ts` internal spawn (out of scope unless changed in implementation plan)
- `package.json` script definitions that invoke CLI for dev ergonomics

### README Development section

Replace "Run the CLI from the repo root: `bun run packages/cli/src/index.ts --help`" with:

- `vega-paper --help` after `bash scripts/install.sh --from-repo`, or
- pointer to Install section

Keep monorepo test/lint commands as `bun run …`.

## Verification

Before merge:

1. `rg 'bun run packages/cli/src/index.ts' --glob '*.md'` returns no hits outside an explicit allowlist (if any: none expected after sweep).
2. `skills/vega-paper/SKILL.md` contains no `bun run packages/cli`.
3. `skills/vega-paper/scripts/` directory removed.
4. `bun test` passes (delete script tests; no new failures).
5. `bun run check` passes.

Manual: open SKILL.md and confirm infer → lint → render flow reads as copy-paste `vega-paper` only.

## Versioning

Documentation-only slice. No semver bump required; may ship in next patch release notes as "agent skill: use installed `vega-paper` CLI".

## Supersedes / relates

- Implements remaining **Phase 4a** doc item from [`2026-06-03-vega-paper-cli-distribution-design.md`](./2026-06-03-vega-paper-cli-distribution-design.md) (SKILL prefers `vega-paper`).
- Supersedes agent workflow in [`2026-06-03-vega-paper-skill-scripts-design.md`](./2026-06-03-vega-paper-skill-scripts-design.md) (scripts removed).
