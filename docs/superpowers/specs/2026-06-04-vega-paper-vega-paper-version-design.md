# VegaPaper `vegaPaperVersion` in Figure Meta Design

Date: 2026-06-04

## Context

Infer and render meta already record `vegaVersion` and `vegaLiteVersion`. The CLI package version (`packages/cli/package.json`, currently `0.1.0`) is not recorded yet.

## Goals

- Add required top-level `vegaPaperVersion` to infer and render meta.
- Rename `VegaDependencyVersions` → `FigureMetaVersions`.
- Rename `resolveVegaDependencyVersions()` → `resolveFigureMetaVersions()`.
- Read `vegaPaperVersion` from `packages/cli/package.json` at runtime.
- Fail meta write when CLI version cannot be read (same strictness as Vega packages).

## Non-Goals

- Git tag / build-time embed versioning.
- Changing `generatedBy` (stays `"vega-paper"`).
- Lint provenance fields.

## Schema Change

Add to both `InferFigureMeta` and `RenderFigureMeta`:

| Field | Type | Source |
|-------|------|--------|
| `vegaPaperVersion` | `string` | `packages/cli/package.json` `"version"` |

Field order in JSON output:

```text
createdAt
vegaPaperVersion
vegaVersion
vegaLiteVersion
```

### Example

```json
{
  "generatedBy": "vega-paper",
  "command": "infer",
  "input": "data.csv",
  "output": "figures/f1.svg",
  "specOut": "figures/f1.vl.json",
  "createdAt": "2026-06-03T12:00:00.000Z",
  "vegaPaperVersion": "0.1.0",
  "vegaVersion": "6.2.0",
  "vegaLiteVersion": "6.4.1",
  "infer": { "chart": "line", "x": "epoch", "y": "f1" }
}
```

## Core API

```ts
export type FigureMetaVersions = {
  vegaPaperVersion: string;
  vegaVersion: string;
  vegaLiteVersion: string;
};

export async function resolveFigureMetaVersions(): Promise<FigureMetaVersions>;
```

Resolution paths (from `packages/cli/src/core/figure-meta.ts`):

- `vegaPaperVersion`: `{cliPackageRoot}/package.json`
- `vegaVersion`: `{cliPackageRoot}/node_modules/vega/package.json`
- `vegaLiteVersion`: `{cliPackageRoot}/node_modules/vega-lite/package.json`

## Error Handling

| Condition | Behavior |
|-----------|----------|
| CLI `package.json` missing or empty version | `VegaPaperError`: Could not read version from installed "vega-paper" package. |
| Vega packages unreadable | Existing behavior unchanged |

## Files

| File | Change |
|------|--------|
| `packages/cli/src/core/figure-meta.ts` | Rename types/functions; add field to builders |
| `packages/cli/src/commands/infer.ts` | Import rename |
| `packages/cli/src/commands/render.ts` | Import rename |
| `packages/cli/test/figure-meta.test.ts` | Expect `vegaPaperVersion` |

## Testing

- Unit tests assert `vegaPaperVersion: "0.1.0"` in builders and resolver.
- Existing infer/render command meta tests continue to pass (they do not pin version fields).
