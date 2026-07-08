# ML Figures Phase A: Shaded Error Band Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `vega-paper infer --chart line --error-band <field>` generate a layered Vega-Lite spec (shaded `errorband` layer + `line` layer) instead of a bare `encoding.yError` line, regenerate the training-curve example, and remove stale SVG-only/MVP language from the skill reference docs.

**Architecture:** All spec-generation changes live in one function in `packages/cli/src/core/infer.ts` (`inferVegaLiteSpec`): when `chart === "line"` and `errorBandField` is set, the inner spec becomes `{ width, height, layer: [errorband-layer, line-layer] }` instead of `{ mark, width, height, encoding }`. The facet wrapper, data handling, CLI validation, lint, render, and figure-meta pipelines all consume the result unchanged. Docs and the committed example spec/gallery are updated to match.

**Tech Stack:** Bun 1.3.14 workspace, TypeScript, `bun test`, biome (`bun run check`), Vega-Lite v6, commander CLI.

**Spec:** `docs/vega-paper-ml-conference-figures-spec.md` — Phase A (section 12), driven by sections 7.1, 9.4, and parts of 9.1.

## Global Constraints

- Run every command from the repo root: `/Users/ryusei0623/projects/vega-paper`.
- Bun 1.3.14 workspace; tests via `bun test`, typecheck via `bun run typecheck`, lint/format via `bun run check` (biome). All three must pass before every commit.
- Generated specs use `$schema` `https://vega.github.io/schema/vega-lite/v6.json`; default size is `DEFAULT_WIDTH = 360`, `DEFAULT_HEIGHT = 240` (already defined in `packages/cli/src/core/infer.ts`).
- The error band mark must be exactly `{ "type": "errorband", "extent": "stderr", "opacity": 0.25 }` (spec §7.1).
- The shaded-band change applies to `--chart line` only. `bar`, `scatter`, and `area` keep the existing `encoding.yError` behavior unchanged (spec §7.1 "Non-Line Charts").
- Existing rejections must keep working with identical messages: `--error-band` with `heatmap` (`'The "--error-band" option cannot be used with --chart heatmap.'`), with `boxplot` (`'... --chart boxplot.'`), and with `--aggregate` (`'The "--error-band" option cannot be used with --aggregate.'`).
- Do NOT remove the "no dedicated `examples/` folder for `bar` or `area`" note in `skills/vega-paper/references/chart-selection.md` (that fix belongs to Phase B, spec §7.2).
- Out of scope (later phases / open questions): `--error-band-type`, `--error-band-low/high`, `errorbar` layers for non-line charts, new examples, templates, ML lint rules.
- Commit messages: `fix: ...` / `docs: ...`, imperative mood, matching repo history.

## Verified Context (no changes needed in these files)

- `packages/cli/src/core/lint-rules.ts` already handles layered specs: `collectVegaLiteUnitSpecs` (lines 506–522) recursively visits `layer`, `spec`, `concat`, `hconcat`, `vconcat` children, so every lint rule that iterates unit specs (axis titles, legend categories, colors, series distinction) works on the new layered output. `checkSizePresence`/`checkSizeRange` read root `width`/`height`, which the layered spec still sets at the root (or on the facet inner spec, same as today). **No lint changes.**
- `packages/cli/src/core/spec.ts` `detectSpecType` (lines 30–52) checks `$schema` before the `mark`+`encoding` heuristic; `infer` always emits `$schema`, so render and lint recognize the layered spec as Vega-Lite. **No render/spec changes.**
- `packages/cli/src/commands/infer.ts` passes `errorBandField` through unchanged and its `validateErrorBandOptions` rejections stay as-is. **No command changes.**
- `packages/cli/src/core/figure-meta.ts` and `render.ts` operate on paths/options, not spec shape. **No changes.**
- `packages/cli/test/infer-command.test.ts` only asserts option passthrough and rejection messages for `--error-band` (lines 1298–1384) against a stubbed `runInfer`; those tests remain valid. **No changes.**

## File Map

| File | Change |
|------|--------|
| `packages/cli/src/core/infer.ts` | `InferEncoding` type, `ERROR_BAND_MARK` constant, `buildErrorBandLineSpec` helper, layered inner spec for line+errorBand |
| `packages/cli/test/infer.test.ts` | Rewrite 2 line-chart error-band tests; add 3 non-line preservation tests |
| `examples/training-curve/chart-error-band.vl.json` | Regenerated via `bun run infer:training-curve-error-band` |
| `examples/training-curve/README.md` | Error-band section: layered semantics, band vs bars |
| `scripts/render-gallery.ts` | Add gallery job for `chart-error-band.vl.json` |
| `scripts/render-gallery.test.ts` | Add `training-curve-error-band` to `EXAMPLE_PREVIEWS` |
| `examples/README.md` | Add error-band gallery row |
| `docs/assets/gallery/examples/training-curve-error-band.png` | New committed gallery preview |
| `skills/vega-paper/references/paper-style-guide.md` | Remove SVG-only/MVP language; document SVG/PNG/PDF (spec §9.4) |
| `skills/vega-paper/references/chart-selection.md` | Error-band semantics only (band on line, `yError` elsewhere) |

---

### Task 1: Layered errorband spec in core infer

**Files:**
- Modify: `packages/cli/src/core/infer.ts` (lines 59–98 type region, 171–208 spec assembly, helper near line 395)
- Test: `packages/cli/test/infer.test.ts` (lines 876–921)

**Interfaces:**
- Consumes: existing `InferRequest`, `InferEncodingChannel`, `MARK_BY_CHART`, `DEFAULT_WIDTH`/`DEFAULT_HEIGHT`, `JsonObject` from `./spec`.
- Produces: `type InferEncoding = { x: InferEncodingChannel; y: InferEncodingChannel; color?: InferEncodingChannel; yError?: InferEncodingChannel }` (module-private), `const ERROR_BAND_MARK: JsonObject`, and `function buildErrorBandLineSpec(request: InferRequest, encoding: InferEncoding): JsonObject` returning `{ width, height, layer: [bandLayer, lineLayer] }`. `inferVegaLiteSpec`'s public signature is unchanged; only the shape of `result.spec` changes for line+errorBand. Task 2 relies on the regenerated spec shape shown in its Step 2.

- [ ] **Step 1: Rewrite the two line-chart error-band tests to expect layers**

In `packages/cli/test/infer.test.ts`, replace this entire block (lines 876–921):

```ts
  test("adds yError encoding when errorBandField is set on a line chart", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,f1_se\n1,0.61,0.02\n2,0.68,0.015\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      errorBandField: "f1_se",
      specOutputPath,
    });

    expect(result.spec.encoding).toMatchObject({
      y: { field: "f1", type: "quantitative" },
      yError: { field: "f1_se", type: "quantitative" },
    });
  });

  test("places yError on inner spec when facet and errorBandField are set", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,f1_se,split\n1,0.61,0.02,a\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      errorBandField: "f1_se",
      facetField: "split",
      specOutputPath,
    });

    expect(result.spec.encoding).toBeUndefined();
    expect(result.spec.spec).toMatchObject({
      encoding: {
        yError: { field: "f1_se", type: "quantitative" },
      },
    });
  });
```

with:

```ts
  test("generates a layered errorband and line spec when errorBandField is set on a line chart", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,f1_se,model\n1,0.61,0.02,base\n2,0.68,0.015,base\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      colorField: "model",
      errorBandField: "f1_se",
      specOutputPath,
    });

    expect(result.spec.mark).toBeUndefined();
    expect(result.spec.encoding).toBeUndefined();
    expect(result.spec.width).toBe(360);
    expect(result.spec.height).toBe(240);
    expect(result.spec.layer).toEqual([
      {
        mark: { type: "errorband", extent: "stderr", opacity: 0.25 },
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
          color: { field: "model", type: "nominal" },
          yError: { field: "f1_se", type: "quantitative" },
        },
      },
      {
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
          color: { field: "model", type: "nominal" },
        },
      },
    ]);
  });

  test("places errorband layers on the inner spec when facet and errorBandField are set", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,f1_se,split\n1,0.61,0.02,a\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      errorBandField: "f1_se",
      facetField: "split",
      specOutputPath,
    });

    expect(result.spec.encoding).toBeUndefined();
    expect(result.spec.mark).toBeUndefined();
    expect(result.spec.facet).toEqual({ field: "split", type: "nominal" });
    expect(result.spec.spec).toMatchObject({
      layer: [
        {
          mark: { type: "errorband", extent: "stderr", opacity: 0.25 },
          encoding: {
            yError: { field: "f1_se", type: "quantitative" },
          },
        },
        {
          mark: "line",
        },
      ],
    });
  });

  test("keeps yError encoding when errorBandField is set on a scatter chart", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "latency,f1,f1_se\n10,0.61,0.02\n20,0.68,0.015\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "scatter",
      xField: "latency",
      yField: "f1",
      errorBandField: "f1_se",
      specOutputPath,
    });

    expect(result.spec.layer).toBeUndefined();
    expect(result.spec.mark).toBe("point");
    expect(result.spec.encoding).toMatchObject({
      y: { field: "f1", type: "quantitative" },
      yError: { field: "f1_se", type: "quantitative" },
    });
  });

  test("keeps yError encoding when errorBandField is set on a bar chart", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "model,f1,f1_se\nbase,0.61,0.02\nours,0.68,0.015\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "bar",
      xField: "model",
      yField: "f1",
      errorBandField: "f1_se",
      specOutputPath,
    });

    expect(result.spec.layer).toBeUndefined();
    expect(result.spec.mark).toBe("bar");
    expect(result.spec.encoding).toMatchObject({
      yError: { field: "f1_se", type: "quantitative" },
    });
  });

  test("keeps yError encoding when errorBandField is set on an area chart", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,f1_se\n1,0.61,0.02\n2,0.68,0.015\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "area",
      xField: "epoch",
      yField: "f1",
      errorBandField: "f1_se",
      specOutputPath,
    });

    expect(result.spec.layer).toBeUndefined();
    expect(result.spec.mark).toEqual({ type: "area", line: true });
    expect(result.spec.encoding).toMatchObject({
      yError: { field: "f1_se", type: "quantitative" },
    });
  });
```

Leave the existing rejection tests immediately below ("rejects error-band with aggregate in the request", "rejects error-band with heatmap in the request") untouched.

- [ ] **Step 2: Run the test file to verify the new tests fail**

Run: `bun test packages/cli/test/infer.test.ts`
Expected: FAIL — "generates a layered errorband and line spec..." fails (`result.spec.layer` is `undefined`, `result.spec.mark` is `"line"`), and "places errorband layers on the inner spec..." fails. The three "keeps yError..." tests PASS (current behavior already does this). The two rejection tests still PASS.

- [ ] **Step 3: Implement the layered spec in `packages/cli/src/core/infer.ts`**

3a. Replace the inline `encoding` type in `inferVegaLiteSpec` (lines 93–98):

```ts
  let encoding: {
    x: InferEncodingChannel;
    y: InferEncodingChannel;
    color?: InferEncodingChannel;
    yError?: InferEncodingChannel;
  };
```

with:

```ts
  let encoding: InferEncoding;
```

3b. Directly below the `InferEncodingChannel` type (after line 65, before `MARK_BY_CHART`), add:

```ts
type InferEncoding = {
  x: InferEncodingChannel;
  y: InferEncodingChannel;
  color?: InferEncodingChannel;
  yError?: InferEncodingChannel;
};
```

3c. Directly after the `MARK_BY_CHART` constant (after line 74), add:

```ts
const ERROR_BAND_MARK: JsonObject = {
  type: "errorband",
  extent: "stderr",
  opacity: 0.25,
};
```

3d. Replace the inner spec assembly (lines 175–180):

```ts
  const innerSpec: JsonObject = {
    mark: MARK_BY_CHART[chart],
    width: request.width ?? DEFAULT_WIDTH,
    height: request.height ?? DEFAULT_HEIGHT,
    encoding,
  };
```

with:

```ts
  const innerSpec: JsonObject =
    chart === "line" && request.errorBandField !== undefined
      ? buildErrorBandLineSpec(request, encoding)
      : {
          mark: MARK_BY_CHART[chart],
          width: request.width ?? DEFAULT_WIDTH,
          height: request.height ?? DEFAULT_HEIGHT,
          encoding,
        };
```

(The `if (request.aggregateMethod !== undefined)` transform block that follows stays as-is; `--error-band` with `--aggregate` is already rejected earlier by `assertErrorBandSupported`, so the layered branch can never receive a transform.)

3e. Directly after the `assertErrorBandSupported` function (after line 395), add:

```ts
function buildErrorBandLineSpec(request: InferRequest, encoding: InferEncoding): JsonObject {
  const lineEncoding: InferEncoding = { x: encoding.x, y: encoding.y };

  if (encoding.color !== undefined) {
    lineEncoding.color = encoding.color;
  }

  return {
    width: request.width ?? DEFAULT_WIDTH,
    height: request.height ?? DEFAULT_HEIGHT,
    layer: [
      { mark: ERROR_BAND_MARK, encoding },
      { mark: MARK_BY_CHART.line, encoding: lineEncoding },
    ],
  };
}
```

- [ ] **Step 4: Run the test file to verify all tests pass**

Run: `bun test packages/cli/test/infer.test.ts`
Expected: PASS — all tests in the file green, including the two rejection tests and all boxplot/heatmap/facet tests.

- [ ] **Step 5: Run the full suite, typecheck, and biome**

Run: `bun test && bun run typecheck && bun run check`
Expected: `bun test` all pass (including `infer-command.test.ts` — the stubbed passthrough tests are unaffected); typecheck exits 0; biome reports no issues. If biome complains about formatting, run `bun run check:fix` and re-run `bun run check`.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/core/infer.ts packages/cli/test/infer.test.ts
git commit -m "fix: generate layered errorband spec for --chart line --error-band"
```

---

### Task 2: Regenerate example spec, gallery, and example docs

**Files:**
- Modify: `examples/training-curve/chart-error-band.vl.json` (regenerated, not hand-edited)
- Modify: `examples/training-curve/README.md:30-32`
- Modify: `scripts/render-gallery.ts:23-27` (add a job)
- Modify: `scripts/render-gallery.test.ts:7-15` (add the new preview name)
- Modify: `examples/README.md:8,22`
- Create: `docs/assets/gallery/examples/training-curve-error-band.png` (rendered, committed)

**Interfaces:**
- Consumes: the layered spec shape from Task 1 (`{ $schema, data, width, height, layer: [errorband, line], title }`); npm scripts `infer:training-curve-error-band` and `render:gallery` in root `package.json`.
- Produces: committed reference spec + gallery PNG used by READMEs and asserted by `scripts/render-gallery.test.ts`; no code interfaces.

- [ ] **Step 1: Regenerate the committed error-band spec**

Run: `bun run infer:training-curve-error-band`
Expected stdout: `Wrote examples/training-curve/chart-error-band.vl.json`

- [ ] **Step 2: Verify the regenerated spec content**

Run: `cat examples/training-curve/chart-error-band.vl.json`
Expected exact content:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {
    "url": "data-with-error.csv"
  },
  "width": 360,
  "height": 240,
  "layer": [
    {
      "mark": {
        "type": "errorband",
        "extent": "stderr",
        "opacity": 0.25
      },
      "encoding": {
        "x": {
          "field": "epoch",
          "type": "quantitative"
        },
        "y": {
          "field": "f1",
          "type": "quantitative"
        },
        "color": {
          "field": "model",
          "type": "nominal"
        },
        "yError": {
          "field": "f1_se",
          "type": "quantitative"
        }
      }
    },
    {
      "mark": "line",
      "encoding": {
        "x": {
          "field": "epoch",
          "type": "quantitative"
        },
        "y": {
          "field": "f1",
          "type": "quantitative"
        },
        "color": {
          "field": "model",
          "type": "nominal"
        }
      }
    }
  ],
  "title": "Training F1 with standard error"
}
```

(Note: `yError` appears after `color` in the band layer — same channels as spec §7.1's target, in the CLI's channel-assignment order. This is the expected shape.)

- [ ] **Step 3: Add the error-band chart to the gallery script**

In `scripts/render-gallery.ts`, after the `training-curve.png` job (lines 23–27):

```ts
  {
    spec: "examples/training-curve/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/training-curve.png`,
  },
```

insert:

```ts
  {
    spec: "examples/training-curve/chart-error-band.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/training-curve-error-band.png`,
  },
```

- [ ] **Step 4: Verify the render toolchain, then render the gallery**

Run: `bun run packages/cli/src/index.ts doctor`
Expected: all checks pass (Vega CLI binaries `vl2svg`, `vl2png`, `vl2pdf` found). If this fails, fix per doctor's output before continuing.

Run: `bun run render:gallery`
Expected: one `Rendering paper-clean -> docs/assets/gallery/examples/training-curve-error-band.png` line among the theme and example renders; exit 0; file `docs/assets/gallery/examples/training-curve-error-band.png` exists and, opened locally, clearly shows a shaded band around each line (spec §7.1 acceptance).

- [ ] **Step 5: Stage only the new PNG; restore other rerendered binaries**

`render:gallery` rerenders every gallery PNG; only the new file should be committed (byte-level diffs on the others are noise). `.meta.json` sidecars under `docs/assets/gallery/` are gitignored.

```bash
git add docs/assets/gallery/examples/training-curve-error-band.png
git restore docs/assets/gallery
git status --short docs/assets/gallery
```

Expected `git status` output: only `A  docs/assets/gallery/examples/training-curve-error-band.png` (no `M` entries under `docs/assets/gallery`).

- [ ] **Step 6: Add the new preview to the gallery asset test**

`bun test` runs `scripts/render-gallery.test.ts`, which asserts every expected gallery PNG exists. In that file, extend the `EXAMPLE_PREVIEWS` array (lines 7–15). Replace:

```ts
const EXAMPLE_PREVIEWS = [
  "basic-line",
  "training-curve",
  "confusion-matrix",
  "faceted-training",
  "boxplot",
  "embedding-scatter",
  "custom-theme",
];
```

with:

```ts
const EXAMPLE_PREVIEWS = [
  "basic-line",
  "training-curve",
  "training-curve-error-band",
  "confusion-matrix",
  "faceted-training",
  "boxplot",
  "embedding-scatter",
  "custom-theme",
];
```

Run: `bun test scripts/render-gallery.test.ts`
Expected: PASS (the PNG was created in Step 4).

- [ ] **Step 7: Update `examples/training-curve/README.md`**

Replace (lines 30–32):

```markdown
## Line chart with error band

`f1_se` is a symmetric error magnitude mapped to `encoding.yError`. Do not combine with `--aggregate`.
```

with:

```markdown
## Line chart with error band

`f1_se` is a symmetric standard-error magnitude. On `--chart line`, `--error-band` generates a layered spec: a shaded `errorband` layer (`extent: "stderr"`, `opacity: 0.25`) drawn behind a `line` layer — the shaded uncertainty band expected for learning curves. Error **bars** (per-point whiskers) are different: on `bar`, `scatter`, and `area` charts the same flag maps to `encoding.yError` instead. Do not combine with `--aggregate`.
```

(The command block below it is already correct and stays unchanged.)

- [ ] **Step 8: Update `examples/README.md`**

8a. Replace the training-curve row in the folder table (line 8):

```markdown
| [training-curve/](training-curve/) | `infer` line chart; `--aggregate mean`; `--error-band` |
```

with:

```markdown
| [training-curve/](training-curve/) | `infer` line chart; `--aggregate mean`; `--error-band` shaded band |
```

8b. In the Gallery table, after the training-curve row (line 22):

```markdown
| [training-curve/](training-curve/) | ![training-curve](../docs/assets/gallery/examples/training-curve.png) |
```

insert:

```markdown
| [training-curve/](training-curve/) error band | ![training-curve-error-band](../docs/assets/gallery/examples/training-curve-error-band.png) |
```

- [ ] **Step 9: Verify checks still pass**

Run: `bun test && bun run typecheck && bun run check`
Expected: all pass (including `scripts/render-gallery.test.ts` with the new preview name; biome also formats/checks `scripts/render-gallery.ts` and `scripts/render-gallery.test.ts`).

- [ ] **Step 10: Commit**

```bash
git add examples/training-curve/chart-error-band.vl.json examples/training-curve/README.md scripts/render-gallery.ts scripts/render-gallery.test.ts examples/README.md docs/assets/gallery/examples/training-curve-error-band.png
git commit -m "docs: regenerate error-band example with shaded band and add gallery preview"
```

---

### Task 3: Fix stale SVG-only/MVP language in the paper style guide

**Files:**
- Modify: `skills/vega-paper/references/paper-style-guide.md:95-119`

**Interfaces:**
- Consumes: spec §9.4 replacement guidance (SVG canonical vector, PDF for LaTeX venues, PNG for README/slides; commit spec + rendered vector output + source data + `.meta.json`). No code interfaces.
- Produces: corrected doc only.

- [ ] **Step 1: Replace the "LaTeX and captions" intro (line 97)**

Replace:

```markdown
MVP output is **SVG**. Treat the SVG + Vega-Lite spec + `*.meta.json` as the reproducible figure bundle.
```

with:

```markdown
Rendered output formats are **SVG**, **PNG**, and **PDF** (`--format` on `render`/`infer`). Use SVG as the canonical editable vector artifact where possible, PDF for LaTeX venues that prefer or require PDF figures, and PNG for README, slides, and raster previews. Treat the spec + rendered vector output + `*.meta.json` as the reproducible figure bundle.
```

- [ ] **Step 2: Replace the pdfLaTeX bullet (line 102)**

Replace:

```markdown
- **pdfLaTeX** often requires converting SVG to PDF/EPS first; VegaPaper does not ship a PDF export in MVP — convert externally if the venue requires PDF figures only.
```

with:

```markdown
- **pdfLaTeX** venues usually require PDF figures: render them directly with `--format pdf` (e.g. `--out figures/f1.pdf`) — no external SVG conversion step is needed.
```

- [ ] **Step 3: Replace the files-to-commit table and closing line (lines 113–119; the `### Files to commit with the paper` heading at line 111 stays)**

Replace:

```markdown
| Artifact | Role |
|----------|------|
| `*.vl.json` | Source spec; regenerate or edit figure |
| `*.svg` | Vector figure for the paper |
| `*.meta.json` | Provenance (`command`, versions, infer snapshot when applicable) |

Do not promise PNG/PDF export from VegaPaper MVP; SVG is the canonical artifact (see repository README).
```

with:

```markdown
| Artifact | Role |
|----------|------|
| `*.vl.json` / `*.vg.json` | Source spec; regenerate or edit figure |
| `*.svg` or `*.pdf` | Rendered vector figure for the paper (PDF for pdfLaTeX venues) |
| Source data or data-generation script | Reproduce the spec from raw results |
| `*.meta.json` | Provenance (`command`, versions, infer snapshot when applicable) |

PNG (`--format png`) is for README, slides, and raster previews — keep a vector format as the paper artifact.
```

- [ ] **Step 4: Verify no stale language remains**

Run: `grep -n "MVP\|convert externally\|Do not promise" skills/vega-paper/references/paper-style-guide.md`
Expected: no output (exit code 1).

- [ ] **Step 5: Run repo checks**

Run: `bun run check`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
git add skills/vega-paper/references/paper-style-guide.md
git commit -m "docs: update paper style guide for SVG, PNG, and PDF output"
```

---

### Task 4: Update chart-selection reference for shaded band semantics

**Files:**
- Modify: `skills/vega-paper/references/chart-selection.md:37,62-68`

**Interfaces:**
- Consumes: the Task 1 behavior — layered `errorband` (`extent: "stderr"`, `opacity: 0.25`) + `line` on `--chart line`; `encoding.yError` on `bar`/`scatter`/`area`; rejections unchanged.
- Produces: corrected doc only. Line 18 (`There is no dedicated \`examples/\` folder for \`bar\` or \`area\` yet...`) MUST remain untouched (Phase B).

- [ ] **Step 1: Update the modifier summary row (line 37)**

Replace:

```markdown
| Symmetric uncertainty on y | `--error-band <field>` | Cartesian charts only; not with `--aggregate` |
```

with:

```markdown
| Symmetric uncertainty on y | `--error-band <field>` | Shaded band on `line`; `yError` on `bar`/`scatter`/`area`; not with `--aggregate` |
```

- [ ] **Step 2: Rewrite the `--error-band` modifier section (lines 62–68)**

Replace:

```markdown
### `--error-band <field>`

Symmetric error magnitude on `--y` (maps to `encoding.yError`).

- Allowed on cartesian charts: `line`, `bar`, `scatter`, `area`.
- **Not allowed** with `heatmap`, `boxplot`, or `--aggregate`.
- Field must differ from `--x`, `--y`, `--color`, and `--facet`.
```

with:

```markdown
### `--error-band <field>`

Symmetric error magnitude on `--y`.

- On `--chart line`: generates a **layered spec** — a shaded `errorband` layer (`extent: "stderr"`, `opacity: 0.25`) drawn behind the line. This is the shaded uncertainty band expected for learning curves.
- On `bar`, `scatter`, `area`: maps to `encoding.yError` (per-point error), unchanged.
- **Not allowed** with `heatmap`, `boxplot`, or `--aggregate`.
- Field must differ from `--x`, `--y`, `--color`, and `--facet`.

**Error band vs error bars:** a band is a continuous shaded region around a line — use it for metrics over epochs/steps. Error bars are per-point whiskers, which is what `yError` produces on non-line marks.
```

- [ ] **Step 3: Verify the Phase B note is untouched**

Run: `grep -n "no dedicated" skills/vega-paper/references/chart-selection.md`
Expected output (unchanged): line 18 containing `There is no dedicated \`examples/\` folder for \`bar\` or \`area\` yet; \`scatter\` is covered by [embedding-scatter/](../../../examples/embedding-scatter/).`

- [ ] **Step 4: Run repo checks**

Run: `bun run check`
Expected: no issues.

- [ ] **Step 5: Commit**

```bash
git add skills/vega-paper/references/chart-selection.md
git commit -m "docs: document shaded error band semantics in chart selection"
```

---

## Phase A Acceptance Check (spec §7.1 + §12 Phase A)

After Task 4, verify against the spec's acceptance criteria:

- `--error-band` on `line` produces a shaded band, not only `yError` (Task 1).
- Existing commands keep working; `bar`/`scatter`/`area` keep `yError`; heatmap/boxplot/`--aggregate` rejections unchanged (Task 1 tests).
- `chart-error-band.vl.json` regenerated via the existing script (Task 2).
- Gallery preview clearly shows a band (Task 2, Step 4) and is asserted by `scripts/render-gallery.test.ts` (Task 2 Step 6).
- Docs explain error bars vs error bands (Task 2 Step 7, Task 4 Step 2).
- Tests assert `layer` + `errorband` mark (Task 1 Step 1).
- Paper style guide no longer contradicts SVG/PNG/PDF support (Task 3).
- `chart-selection.md` updated only where it contradicted the fix; bar/area example note preserved for Phase B (Task 4).
