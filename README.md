# VegaPaper

CLI for building publication-ready figures from CSV/JSON with [Vega-Lite](https://vega.github.io/vega-lite/). Generate specs with `infer`, apply paper themes, lint for common figure issues, and render SVG.

## Requirements

- [Bun](https://bun.sh) `1.3.14` (see [`.bun-version`](.bun-version))
- Node-compatible Vega CLI binaries for SVG rendering (checked by `doctor`)

## Setup

```bash
bun install
bun run check
bun test
```

Run the CLI from the repo root:

```bash
bun run packages/cli/src/index.ts --help
```

## Quick start

Render the hand-written line chart example:

```bash
bun run render:example
```

Generate a training curve from CSV, then render:

```bash
bun run infer:training-curve
bun run render:training-curve
```

More examples live under [`examples/`](examples/README.md).

## Commands

| Command | Purpose |
|---------|---------|
| `infer` | Build a Vega-Lite spec from CSV/JSON + chart options |
| `render` | Render a spec to SVG with an optional theme |
| `lint` | Check a spec against paper-oriented lint profiles |
| `themes` | List or inspect built-in themes |
| `doctor` | Verify render toolchain dependencies |

Example:

```bash
bun run packages/cli/src/index.ts infer data.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --spec-out figures/f1.vl.json

bun run packages/cli/src/index.ts render figures/f1.vl.json \
  --theme paper-clean \
  --format svg \
  --out figures/f1.svg

bun run packages/cli/src/index.ts lint figures/f1.vl.json --lint-profile paper
```

### `infer` highlights

- **Charts:** `line`, `bar`, `scatter`, `area`, `heatmap`, `boxplot`
- **Options:** `--x`, `--y`, `--color`, `--facet`, `--aggregate`, `--error-band`, type overrides, `--inline-data`
- **Output:** writes `.vl.json`; optionally renders SVG with `--out` and `--theme`

See [`examples/`](examples/) for copy-paste commands.

## AI Skill

Agents can follow [`skills/vega-paper/SKILL.md`](skills/vega-paper/SKILL.md) for infer-first workflows, lint revision loops, and figure meta sidecars.

| Reference | Topic |
|-----------|-------|
| [chart-selection.md](skills/vega-paper/references/chart-selection.md) | Chart types, decision guide, modifiers |
| [theme-catalog.md](skills/vega-paper/references/theme-catalog.md) | Built-in themes and selection |
| [paper-style-guide.md](skills/vega-paper/references/paper-style-guide.md) | Lint profiles, sizes, LaTeX notes |
| [vega-lite-patterns.md](skills/vega-paper/references/vega-lite-patterns.md) | Hand-written specs and `render` |

Optional wrappers (from repo root):

```bash
bun run skills/vega-paper/scripts/validate-spec.ts figures/f1.vl.json --lint-profile paper
bun run skills/vega-paper/scripts/render-chart.ts figures/f1.vl.json --out figures/f1.svg
```

The CLI prefix in `SKILL.md` remains canonical; scripts are thin entry points for agents.

## Development

| Script | Description |
|--------|-------------|
| `bun run check` | Biome lint/format check (CI) |
| `bun run check:fix` | Apply safe Biome fixes and formatting |
| `bun test` | Run tests |
| `bun run typecheck` | TypeScript check |
| `bun run build` | Build workspace packages |
| `bun run infer:examples` | Regenerate committed example specs |

Note: `bun run check` is **code** quality (Biome). `vega-paper lint` is **figure spec** quality (Vega-Lite).

## Repository layout

```text
packages/cli/      vega-paper CLI
packages/themes/   eight built-in themes (paper, ACL, NeurIPS, shadcn, nature, poster, monochrome)
skills/            agent skills (vega-paper workflow)
examples/          sample data, reference specs, and READMEs
docs/superpowers/  design specs and implementation plans
```

## License

See repository defaults; version `0.1.0` (pre-release MVP).
