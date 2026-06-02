# Vega-Lite Composed Lint Design

## Context

`vega-paper lint` now checks top-level Vega and Vega-Lite JSON specs with a small set of static paper-quality rules. The current implementation is intentionally simple: Vega-Lite-specific rules inspect top-level `mark`, `encoding`, and `data.values`.

The next slice extends those Vega-Lite-specific rules to common composed Vega-Lite specs. This keeps the command useful for paper figures that use layers, facets, repeats, and concatenation without introducing rendered-output inspection or deeper visual analysis.

## Goals

- Traverse common Vega-Lite composed spec containers.
- Run selected unit-spec lint rules against discovered child unit specs.
- Preserve stable JSON paths that point to the original location in the input spec.
- Keep root-level/global rules on the root spec to avoid noisy duplicate warnings.
- Keep the implementation pure and testable inside `packages/cli/src/core/lint-rules.ts`.

## Non-Goals

- No rendered SVG, PDF, or PNG linting.
- No profile thresholds.
- No Markdown report output.
- No rule suppression or ignore file support.
- No automatic spec repair.
- No broad Vega mark/scale traversal.
- No inheritance inference beyond the explicit data fallback described below.

## Supported Composition Shapes

The traversal should inspect unit specs under:

- `layer[]`
- `spec` when paired with top-level `facet`
- `spec` when paired with top-level `repeat`
- `concat[]`
- `hconcat[]`
- `vconcat[]`

Traversal is recursive, so nested shapes such as a faceted child under `layer[0].spec` are supported when each step has the expected object or array shape.

Malformed composition fields are ignored rather than reported by this slice. For example, a non-array `layer` or non-object `spec` child should not crash linting.

## Rule Scope

Only Vega-Lite unit-level rules should run across collected unit specs:

- `axis-title-missing`
- `legend-too-many-categories`
- `bar-y-axis-zero-missing`

Root/global rules continue to run only against the root spec:

- `title-too-long`
- `size-missing`
- `size-out-of-range`
- `inline-data-large`
- `font-size-small`

This avoids duplicate or misleading warnings for properties that are usually global in composed specs, such as `title`, `width`, `height`, and `config`.

## Architecture

Add a small traversal helper in `packages/cli/src/core/lint-rules.ts`.

```ts
type VegaLiteUnitSpec = {
  spec: JsonObject;
  path: string;
};
```

`collectVegaLiteUnitSpecs(rootSpec)` returns discovered unit specs in stable traversal order:

1. The root spec itself when it looks like a unit spec.
2. Items under `layer[]`.
3. `spec` children used by faceted specs.
4. `spec` children used by repeated specs.
5. Items under `concat[]`.
6. Items under `hconcat[]`.
7. Items under `vconcat[]`.

A spec should be treated as a unit spec when it has an object `encoding` or an explicit `mark`. This is intentionally conservative enough for current lint rules without attempting to fully validate Vega-Lite grammar.

Each unit-level rule uses the collected unit specs and prefixes issue paths with the unit path:

```text
$.layer[0].encoding.x
$.spec.encoding.y
$.spec.encoding.y.scale
$.hconcat[1].encoding.color
```

Root-level paths keep their current shape, such as `$.title` or `$.config.axis.labelFontSize`.

## Data Handling

`legend-too-many-categories` needs inline data to count categories. In composed Vega-Lite specs, data is commonly defined at the root while child specs define only encodings.

For this rule:

1. Use the child unit spec's `data.values` when present.
2. Otherwise fall back to the root spec's `data.values`.
3. If neither is present, do not warn.

This is the only inheritance-like behavior in this slice. Mark, encoding, scale, width, height, title, and config inheritance are not inferred.

## Error Handling

Traversal should be defensive:

- Ignore non-object array items.
- Ignore missing or malformed composition containers.
- Avoid throwing for unexpected JSON shapes.
- Continue to skip all Vega-Lite-only traversal when `specType !== "vega-lite"`.

This slice should not introduce new `error` severity rules. It only improves coverage for existing warning rules.

## Testing

Add focused tests in `packages/cli/test/lint.test.ts` for:

- `layer[0]` and `layer[1]` axis title warnings with paths such as `$.layer[0].encoding.x`.
- `spec.encoding.x` axis title warnings for faceted specs.
- `spec.encoding.y` axis title warnings for repeated specs.
- `concat[0]`, `hconcat[0]`, and `vconcat[0]` child specs.
- `legend-too-many-categories` using root `data.values` for a layer child.
- `bar-y-axis-zero-missing` inside a layer child.
- Nested composition, such as a faceted unit under `layer[0].spec`.
- Malformed composition fields are ignored without throwing.
- Vega specs still skip Vega-Lite-only traversal.

Tests should assert stable paths and rule IDs. They should also preserve existing top-level behavior.

## Expected User Impact

Users can lint common multi-view Vega-Lite specs and receive warnings at the actual child spec location rather than silently missing issues. Existing single-view specs keep the same behavior and output shape.
