# Basic line chart

Hand-written Vega-Lite spec with inline `data.values`. Use this example to try `render` and `lint` without `infer`.

## Render

```bash
bun run render:example
```

Or:

```bash
vega-paper render examples/basic-line/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/basic-line/output.svg
```

## Lint

```bash
vega-paper lint examples/basic-line/chart.vl.json --lint-profile paper
```

Generated `output.svg` is not committed; create it locally with the commands above.
