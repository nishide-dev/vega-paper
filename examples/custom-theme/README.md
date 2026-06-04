# Custom theme example

Demonstrates loading a user theme JSON file with `--theme`.

## Render

From the repository root:

```bash
bun run packages/cli/src/index.ts render examples/custom-theme/chart.vl.json \
  --theme examples/custom-theme/theme.json \
  --format svg \
  --out examples/custom-theme/output.svg
```

Inspect the theme:

```bash
bun run packages/cli/src/index.ts themes show examples/custom-theme/theme.json
```

## Theme file format

See [`docs/superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md`](../../docs/superpowers/specs/2026-06-04-vega-paper-custom-themes-design.md).
