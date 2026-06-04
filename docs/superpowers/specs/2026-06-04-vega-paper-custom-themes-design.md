# Custom Themes Design (Phase 4b)

Date: 2026-06-04

## Context

Phase 3 shipped eight built-in themes as TypeScript presets in `packages/themes`. Phase 4a made the CLI installable via GitHub Release tarballs; built-in themes are compiled into the `vega-paper` binary.

Users need **lab- or venue-specific styling** without forking the repo or adding a new built-in theme for every paper.

**Depends on:** Phase 4a (installable CLI for docs and smoke tests).

**Roadmap:** [`docs/roadmap.md`](../../roadmap.md) Phase 4b.

## Goals

1. **Load a user theme from a JSON file** at render time (and `infer` when `--theme` + `--out` render).
2. **Reuse the same merge semantics** as built-ins: theme `config` deep-merged under spec `config` (spec wins).
3. **Keep `--theme` as the single flag** — value is either a built-in name or a path to a theme file.
4. **Validate theme files** with clear `VegaPaperError` messages (missing file, invalid JSON, schema violations).
5. **Document format** in README + Skill + an `examples/custom-theme/` sample.
6. **Extend `themes show`** to display a custom theme file (same output shape as built-ins).

## Non-Goals (Phase 4b slice)

- Built-in registry changes (no new official themes)
- `themes list` including user files or scanning `~/.vega-paper/themes`
- YAML / TOML theme files
- Partial override file merged onto a built-in in one command (e.g. `--theme paper-clean --override tweaks.json`) — defer to 4b-2
- `vega-paper themes preview` gallery
- Theme-aware lint rule changes (print/grayscale rules stay profile-based)
- Shipping custom themes inside Release tarballs
- Windows-specific path quirks beyond normal Node `path` resolution

## Current behavior (baseline)

| Piece | Behavior |
|-------|----------|
| `VegaPaperTheme` | `name`, `displayName`, `description`, `target`, `mode`, `config` — see `packages/themes/src/index.ts` |
| Built-in lookup | `getTheme(name)`; unknown → `Unknown theme "<name>"` |
| Apply | `applyThemeToSpec(spec, theme.config)` in `packages/cli/src/core/spec.ts` |
| CLI | `render` / `infer` use `--theme <name>`; `themes list` / `themes show <name>` |
| Figure meta | `theme` field stores the raw `--theme` string |

## Approaches considered

| Approach | UX | Trade-off |
|----------|-----|-----------|
| **A. Unified `--theme` ref (chosen)** | `--theme paper-clean` or `--theme ./lab/theme.json` | One flag for Skill/scripts; needs deterministic resolution rules |
| B. Separate `--theme-file` | Built-in name vs file always explicit | Extra flag; Skill and docs must teach two options |
| C. Config-only file | `--config path.json` merges Vega-Lite `config` only | Skips theme metadata; overlaps future `--config` from MVP deferral; weaker catalog story |

**Recommendation:** **A** — matches roadmap wording and minimizes Skill churn (`render-chart.ts` already passes one `--theme` value).

## Theme file format

### Filename convention

```text
docs/releases/...     # unrelated
themes/my-lab.json    # recommended suffix .json
```

### JSON schema (version 1)

Top-level object:

| Field | Required | Type | Default if omitted |
|-------|----------|------|------------------|
| `config` | **yes** | object | — |
| `name` | no | string | basename of file without extension |
| `displayName` | no | string | same as `name` |
| `description` | no | string | `""` |
| `target` | no | `"paper" \| "slide" \| "web" \| "poster"` | `"paper"` |
| `mode` | no | `"light" \| "dark" \| "print"` | `"light"` |

**`config`:** Vega / Vega-Lite top-level `config` object (same keys as built-in themes, e.g. `background`, `font`, `axis`, `view`, `range`).

**Unknown top-level keys:** reject with a list of allowed keys (strict v1 — easier for agents and validation).

Example:

```json
{
  "name": "lab-compact",
  "displayName": "Lab Compact",
  "description": "Two-column lab report figures.",
  "target": "paper",
  "mode": "light",
  "config": {
    "background": "white",
    "font": "Helvetica, Arial, sans-serif",
    "view": { "continuousWidth": 320, "continuousHeight": 200 }
  }
}
```

Minimal valid file (metadata inferred):

```json
{
  "config": {
    "background": "white"
  }
}
```

### Validation rules

1. File must exist and be readable.
2. JSON parse succeeds; root is a plain object.
3. `config` present and is a plain object (not array).
4. `target` / `mode` — if present, must be enum values.
5. `name` — if present, non-empty string matching `^[a-z0-9][a-z0-9-]*$` (same spirit as built-in slugs).
6. Reject empty `config: {}` with a hint to add at least one styling key (optional strictness — improves agent feedback).

Errors use `VegaPaperError` with prefix `Invalid theme file <path>:`.

## Theme resolution (`resolveThemeRef`)

New function in `packages/themes` (exported for CLI):

```ts
resolveThemeRef(ref: string, options?: { cwd?: string }): VegaPaperTheme
```

### Algorithm

1. **Built-in fast path:** if `ref` does not look like a path **and** `getTheme(ref)` succeeds → return built-in (preserve today’s error for unknown names).
2. **Path detection:** treat `ref` as a path when any of:
   - starts with `.`, `~`, `/` (POSIX), or Windows drive/UNC patterns
   - contains `/` or `\`
   - ends with `.json`
3. **Resolve path:** try `ref` as-is if absolute; else `join(cwd ?? process.cwd(), ref)`.
4. If resolved path is a file → `loadThemeFromFile(path)`.
5. Else if built-in name exists → built-in (covers `my-theme` with no slashes and no file — still unknown).
6. Else throw: `Unknown theme "<ref>". Use a built-in name (vega-paper themes list) or a path to a .json theme file.`

**Ambiguity:** `paper-clean.json` in cwd shadows built-in `paper-clean` when the file exists — document this; acceptable for explicit filenames.

**Relative paths:** resolved from **process cwd**, not spec directory (document; spec-dir-relative is 4b-2 if needed).

### `loadThemeFromFile`

- Read UTF-8, `JSON.parse`, validate schema, return `VegaPaperTheme`.
- `structuredClone` on `config` before return (match built-in clone behavior).

## CLI changes

### `render` / `infer`

- Help text: `--theme <name|path>` — built-in preset or path to theme JSON.
- Replace `getCliTheme(themeName)` with `resolveThemeRef(themeRef)` in `packages/cli/src/core/render.ts` (shared helper used by `infer` render path and `themes show`).

### `themes show`

- Argument: `<name|path>` — same resolution as `--theme`.
- JSON / text output unchanged (full theme object including `config`).

### `themes list`

- **Unchanged** — built-ins only. Custom themes are out-of-repo artifacts.

### Figure meta

- Continue storing the raw `--theme` string (built-in name or path as passed).
- No new fields in 4b.

## Package layout

```text
packages/themes/src/
  index.ts              # export resolveThemeRef, loadThemeFromFile
  load-theme-file.ts    # parse + validate file
  resolve-theme.ts      # resolution algorithm
  theme-schema.ts       # types + validators (optional small module)

packages/themes/test/
  load-theme-file.test.ts
  resolve-theme.test.ts

packages/cli/test/
  render-custom-theme.test.ts   # integration: temp theme file + render
  themes-command.test.ts        # extend show with file path
```

Keep `applyThemeToSpec` in CLI `spec.ts` — no move required.

## Skill & docs

| Artifact | Change |
|----------|--------|
| `skills/vega-paper/SKILL.md` | Short “custom theme JSON” subsection; `--theme path/to.json` |
| `skills/vega-paper/references/theme-catalog.md` | Link to custom theme format; built-ins table unchanged |
| `examples/custom-theme/` | `theme.json` + minimal `chart.vl.json` + README with render command |
| `README.md` | One subsection under themes |
| `docs/roadmap.md` | Phase 4b → link this spec; mark spec ready |

`render-chart.ts` / `validate-spec.ts`: no code change if they only forward `--theme` (already supports arbitrary string).

## Distribution note

Release tarball embeds built-in themes only. Custom themes are **user files** on disk; `resolveThemeRef` works the same in compiled binary and dev `bun run` CLI.

## Testing strategy

| Level | Cases |
|-------|--------|
| Unit | valid minimal file; full metadata; invalid JSON; bad enum; unknown keys; missing config; path resolution with `cwd` |
| Unit | `resolveThemeRef`: built-in name; `./theme.json`; unknown name; shadowing file |
| CLI | `themes show ./theme.json`; `render` with custom theme produces SVG; errors for missing file |
| CI | existing suites + new tests; optional `examples/custom-theme` render in CI smoke (lightweight) |

## Verification commands

```bash
bun test packages/themes
bun test packages/cli/test/themes-command.test.ts
bun test packages/cli/test/render-custom-theme.test.ts  # new
bun run check
```

Manual:

```bash
vega-paper themes show examples/custom-theme/theme.json
vega-paper render examples/custom-theme/chart.vl.json \
  --theme examples/custom-theme/theme.json \
  --format svg --out /tmp/custom-theme.svg
```

## Deferred (4b-2+)

| Item | Notes |
|------|--------|
| `--theme-override <path>` | Deep-merge partial `config` onto built-in selected by `--theme` |
| Spec-adjacent path resolution | Resolve relative theme path from input spec directory |
| `themes export <builtin> --out file.json` | Scaffolding for custom edits |
| Theme discovery dir | e.g. `$VEGA_PAPER_HOME/themes/*.json` |
| JSON Schema file + `$schema` in theme file | Optional documentation / editor support |

## Success criteria

- [ ] User can render with `--theme ./my-theme.json` without modifying `packages/themes` source.
- [ ] Invalid theme files fail with actionable errors before Vega CLI runs.
- [ ] Built-in `--theme paper-clean` behavior unchanged.
- [ ] `themes show` works for custom files.
- [ ] Skill/docs/example demonstrate the workflow.
- [ ] All tests and `bun run check` pass.

## Open questions (defaults chosen above)

1. **Empty `config: {}`** — reject in v1 (recommended) vs allow no-op merge?
2. **Strict unknown top-level keys** — yes in v1; relax later if needed.
3. **CI example render** — include in `render:examples` or separate script?

Defaults in this spec: **reject empty config**, **strict keys**, **add `examples/custom-theme` to README only** (CI optional in implementation plan).
