# ML Conference Figures Phase D: Multi-Panel Paper Figure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `examples/multipanel-paper-figure/` (hand-written `hconcat` Vega-Lite spec with `(a)`/`(b)`/`(c)` panel labels), multi-panel sizing/label documentation, and an optional `multipanel` template that composes existing `.vl.json` specs via `vega-paper template multipanel --panel <spec>:<label>:<title>`.

**Spec:** [docs/vega-paper-ml-conference-figures-spec.md](../../vega-paper-ml-conference-figures-spec.md) — Phase D (section 12), driven by sections 7.8, 8, and 9.

**Architecture:** The example is a committed hand-written Vega-Lite `hconcat` spec with three panels (learning curve, ablation bar, Pareto scatter), each referencing a small local CSV via `data.url`, with panel labels rendered as anchored panel `title` objects. Themes already apply to concat specs because `renderChart` merges the theme into top-level `config` (`applyThemeToSpec` in `packages/cli/src/core/spec.ts`) and Vega-Lite config is global across concatenated views. The `multipanel` template is a pure builder in `packages/cli/src/core/templates/multipanel.ts` that wraps already-loaded panel specs in `hconcat`/`vconcat`, plus command-layer parsing of repeatable `--panel` values; it hooks into Phase C's `buildTemplateSpec` dispatcher with one union member and one `switch` case.

**Tech Stack:** Bun 1.3.14 workspace, TypeScript, commander, Vega-Lite v6 (`https://vega.github.io/schema/vega-lite/v6.json`), biome, `bun test`.

## Global Constraints

- Bun 1.3.14 workspace; run all commands from repo root `/Users/ryusei0623/projects/vega-paper`.
- Lint/format gate: `bun run check` (biome). Typecheck: `bun run typecheck`. Tests: `bun test`.
- Commit message prefixes: `feat: ...` for features, `docs: ...` for documentation-only, `test: ...` never used alone here — tests commit with their feature.
- Vega-Lite schema URL in all specs: `https://vega.github.io/schema/vega-lite/v6.json` (constant `VEGA_LITE_SCHEMA` mirrors `packages/cli/src/core/infer.ts:57`).
- All errors raised by CLI code use `VegaPaperError` from `packages/cli/src/core/errors.ts`.
- Generated JSON files end with a trailing newline: `` `${JSON.stringify(value, null, 2)}\n` `` (matches `writeSpecFile` in `packages/cli/src/commands/infer.ts:266-269`).
- `examples/**/output.svg` and `docs/assets/gallery/**/*.meta.json` are gitignored; `examples/**/output.meta.json` is NOT gitignored, so delete stray `output.meta.json` files before committing (repo convention: render outputs under `examples/` are not committed; gallery PNGs under `docs/assets/gallery/` ARE committed).

**Phase prerequisites (plans executed in parallel, land BEFORE this plan):**

- **Phase A** fixed `--error-band` to emit layered `errorband` specs in `examples/training-curve/`. This plan does not touch training-curve specs; it only reads `examples/training-curve/chart.vl.json` (plain line spec, unchanged by Phase A) and `examples/training-curve/data.csv`.
- **Phase B** added `examples/ablation-bar/` with `examples/ablation-bar/data.csv` and `examples/ablation-bar/chart.vl.json` (an infer-generated bar spec with `"data": { "url": "data.csv" }`). Task 5's `template:multipanel` script and its example test reference these files as existing.
- **Phase C** added the `vega-paper template` command and is a **hard prerequisite**: do not start Tasks 4–6 of this plan until Phase C's plan ([2026-07-08-vega-paper-ml-figures-phase-c-template-command.md](2026-07-08-vega-paper-ml-figures-phase-c-template-command.md)) has landed. Task 5's diffs are written against Phase C's code as planned there:
  - `packages/cli/src/commands/template.ts` — `registerTemplateCommand(program, writeOutput?, runRender?, writeSpec?, writeFigureMetaFile?, loadTable?)`, registered in `packages/cli/src/index.ts`. Command registration: `.command("template")`, `.argument("<template-name>", ...)` (help text interpolates `TEMPLATE_NAMES.join(", ")`), `.argument("<data>", "CSV input path")`, options `--x/--y/--score/--label/--color/--size/--confidence/--accuracy/--count/--ece/--highlight-best/--x-scale/--frontier/--fit/--title/--width/--height/--theme/--format/--scale/--out/--spec-out`, action `(templateNameValue: string, inputPath: string, options: TemplateCommandOptions)`. Module-private helpers this plan reuses: `resolveTemplateOutputs(options)` (defaults `--spec-out` to the sibling `.vl.json` of `--out` via `toSiblingSpecPath`; throws `'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".'` and `'The "--theme" option requires "--out <path>".'`; validates render options via `buildRenderRequest`), `toSpecWriteError`, `toMetaWriteError`, and `ALLOWED_OPTIONS_BY_TEMPLATE: Record<TemplateName, readonly TemplateOptionKey[]>`. stdout lines go through the injected `writeOutput` (`Wrote <path>\n` / `Rendered <path>\n`).
  - `packages/cli/src/core/template.ts` — exports `TEMPLATE_NAMES = ["benchmark-heatmap", "pareto-frontier", "scaling-law", "calibration-curve"] as const`, `type TemplateName = (typeof TEMPLATE_NAMES)[number]` (a derived type, **not** a hand-written union), request types `BenchmarkHeatmapRequest`/`ParetoFrontierRequest`/`ScalingLawRequest`/`CalibrationCurveRequest` composing `TemplateRequest`, `parseTemplateName(value)` whose error message interpolates `TEMPLATE_NAMES.join(", ")`, and `buildTemplateSpec(request: TemplateRequest): JsonObject` implemented as a `switch (request.template)` with no default case.
  - Per-template builders under `packages/cli/src/core/templates/<name>.ts`.
  - `packages/cli/src/core/figure-meta.ts` — exports `type TemplateOptionsSnapshot = Record<string, string | number | boolean>`, `type TemplateFigureMeta` (with **required** `input: string`), `type BuildTemplateFigureMetaInput` (with **required** `inputPath: string`, optional `versions` with a runtime throw when absent), and `buildTemplateFigureMeta(input): TemplateFigureMeta` (uses `applyOutputFormatMeta` for `format`/`scale`). The multipanel template has no `<data>` input and snapshots `--panel` values as a `string[]`, so Task 5 Step 4e widens `input`/`inputPath` to optional and widens `TemplateOptionsSnapshot` to allow `string[]` values — both backward compatible with Phase C's tests, which always pass `inputPath` and scalar snapshot values.
  - `packages/cli/test/template.test.ts` and `packages/cli/test/template-command.test.ts` assert the `parseTemplateName` unknown-template error message **verbatim** (`Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve.`); adding `"multipanel"` to `TEMPLATE_NAMES` changes that message, so Task 5 Step 3d updates both tests.
  - Root `package.json` has `template:*` scripts ending with `template:examples`.
  - **If Phase C landed with different identifier names**, keep this plan's multipanel-specific code verbatim (it is self-contained) and adapt only the integration points named in Task 5 (`TEMPLATE_NAMES` entry, union member, `switch` case, command registration, figure-meta widening) to Phase C's actual names. Do not rename Phase C code.

## File Map

| File | Change |
|------|--------|
| `examples/multipanel-paper-figure/learning-curve.csv` | Create — panel (a) data |
| `examples/multipanel-paper-figure/ablation.csv` | Create — panel (b) data |
| `examples/multipanel-paper-figure/pareto.csv` | Create — panel (c) data |
| `examples/multipanel-paper-figure/chart.vl.json` | Create — hand-written 3-panel `hconcat` spec |
| `examples/multipanel-paper-figure/chart-composed.vl.json` | Create (generated by `template:multipanel` script) |
| `examples/multipanel-paper-figure/README.md` | Create — commands + facet vs concat vs separate-files guidance |
| `packages/cli/test/examples.test.ts` | Modify — spec-structure tests for both multipanel specs |
| `examples/README.md` | Modify — folder table row + gallery row |
| `scripts/render-gallery.ts` | Modify — add gallery job |
| `scripts/render-gallery.test.ts` | Modify — add `multipanel-paper-figure` to `EXAMPLE_PREVIEWS` |
| `docs/assets/gallery/examples/multipanel-paper-figure.png` | Create (rendered, committed) |
| `package.json` | Modify — `render:multipanel`, `template:multipanel` scripts |
| `skills/vega-paper/references/paper-style-guide.md` | Modify — new "Multi-panel figures" section |
| `skills/vega-paper/references/chart-selection.md` | Modify — one cross-link row in "Examples in this repo" |
| `packages/cli/src/core/templates/multipanel.ts` | Create — `buildMultipanelSpec`, `rebaseDataUrl` |
| `packages/cli/src/core/template.ts` | Modify — add `"multipanel"` to `TEMPLATE_NAMES`, request union member, `switch` case |
| `packages/cli/src/commands/template.ts` | Modify — `--panel`/`--layout` options, optional `[data]`, `parsePanelOption`, `parseMultipanelLayout`, `runMultipanelTemplate`, `multipanel: []` entry in `ALLOWED_OPTIONS_BY_TEMPLATE` |
| `packages/cli/src/core/figure-meta.ts` | Modify — widen `input`/`inputPath` to optional; allow `string[]` in `TemplateOptionsSnapshot` |
| `packages/cli/test/template.test.ts` | Modify — unknown-template error message now lists `multipanel` |
| `packages/cli/test/template-command.test.ts` | Modify — same unknown-template error-message update |
| `packages/cli/test/template-multipanel.test.ts` | Create — builder, parsing, and end-to-end command tests |

**Documentation home decision (spec §9 / task 2 of Phase D):** the sizing/layout and panel-label guidance goes into `skills/vega-paper/references/paper-style-guide.md`, not `chart-selection.md`. Justification: `paper-style-guide.md` already owns figure dimensions ("Recommended figure sizes"), lint-profile width/height ranges, and LaTeX layout advice — single- vs double-column width recommendations are exactly that domain. `chart-selection.md` is explicitly scoped to choosing `--chart` for `vega-paper infer` ("This guide covers selection only"), and multipanel is not an `infer` chart type. `chart-selection.md` gets only a one-row cross-link so agents discover the example from the selection guide.

**Decisions resolving spec ambiguities:**

- Panel labels are panel `title` objects — `{ "text": "(a) Training", "anchor": "start", "fontWeight": "bold" }` — not text layers. Rationale: one mechanism for label + short panel title, styled by themes' title config, and detectable by future lint rule `ml-panel-label-missing` (spec §10.1) without walking layers.
- Panels reference local CSVs via `data.url` (no inline data). Rationale: matches every other committed example, keeps the spec readable, and exercises the template's data-URL rebasing.
- The `multipanel` template composes **existing spec files only** (spec §15 open question 7 resolved as: specs, not raw data). The `<data>` positional becomes optional (`[data]`); passing a data argument to `multipanel` is an error, and omitting it for any other template remains an error.
- `--panel` value grammar: `<spec-path>:<label>[:<title>]`, split on `:`; parts beyond the third are re-joined so titles may contain colons; spec paths containing `:` are unsupported (documented in the command help via the grammar).

---

## Tasks

- [ ] Task 1: `examples/multipanel-paper-figure/` example (data, spec, README, structure tests)
- [ ] Task 2: Gallery coverage, `render:multipanel` script, examples README
- [ ] Task 3: Multi-panel docs in paper-style-guide.md + chart-selection cross-link
- [ ] Task 4: `buildMultipanelSpec` + `rebaseDataUrl` core builder
- [ ] Task 5: `multipanel` template CLI wiring, `template:multipanel` script, composed example
- [ ] Task 6: Full-suite verification

---

### Task 1: `examples/multipanel-paper-figure/` example

**Files:**
- Create: `examples/multipanel-paper-figure/learning-curve.csv`
- Create: `examples/multipanel-paper-figure/ablation.csv`
- Create: `examples/multipanel-paper-figure/pareto.csv`
- Create: `examples/multipanel-paper-figure/chart.vl.json`
- Create: `examples/multipanel-paper-figure/README.md`
- Modify: `packages/cli/test/examples.test.ts` (append inside the `describe("examples", ...)` block, after the `embedding-scatter` test at line 97-109)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `examples/multipanel-paper-figure/chart.vl.json` — a top-level `hconcat` array of exactly 3 panel views, each with `data.url` of `learning-curve.csv` / `ablation.csv` / `pareto.csv` and `title.text` starting `(a) ` / `(b) ` / `(c) `. Tasks 2, 3, and 5 rely on these exact paths and titles.

- [ ] **Step 1: Write the failing spec-structure test**

Append inside `describe("examples", ...)` in `packages/cli/test/examples.test.ts` (immediately before the closing `});` of the describe block):

```typescript
  test("multipanel-paper-figure composes three labeled panels with hconcat", async () => {
    const spec = await readExampleSpec("examples/multipanel-paper-figure/chart.vl.json");

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(Array.isArray(panels)).toBe(true);
    expect(panels).toHaveLength(3);
    expect(panels[0]?.data).toEqual({ url: "learning-curve.csv" });
    expect(panels[1]?.data).toEqual({ url: "ablation.csv" });
    expect(panels[2]?.data).toEqual({ url: "pareto.csv" });

    const titles = panels.map((panel) => panel.title as { text: string; anchor: string });

    expect(titles[0]?.text).toStartWith("(a) ");
    expect(titles[1]?.text).toStartWith("(b) ");
    expect(titles[2]?.text).toStartWith("(c) ");

    for (const title of titles) {
      expect(title.anchor).toBe("start");
    }

    for (const panel of panels) {
      expect(panel.width).toBe(200);
      expect(panel.height).toBe(170);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/cli/test/examples.test.ts`
Expected: FAIL — `multipanel-paper-figure composes three labeled panels with hconcat` errors with `ENOENT` (missing `examples/multipanel-paper-figure/chart.vl.json`); all pre-existing tests pass.

- [ ] **Step 3: Create the three data CSVs**

Create `examples/multipanel-paper-figure/learning-curve.csv`:

```csv
epoch,f1,model
1,0.61,base
2,0.68,base
3,0.72,base
4,0.75,base
5,0.76,base
1,0.64,large
2,0.71,large
3,0.76,large
4,0.79,large
5,0.81,large
```

Create `examples/multipanel-paper-figure/ablation.csv`:

```csv
component,score
full,85.6
no reranking,84.0
no retrieval,83.1
baseline,81.2
```

Create `examples/multipanel-paper-figure/pareto.csv`:

```csv
model,family,score,latency_ms
TinyLM,baseline,68.1,12
BaseLM,baseline,72.4,28
Ours-S,ours,73.0,18
Ours-L,ours,77.2,42
```

- [ ] **Step 4: Create the hand-written hconcat spec**

Create `examples/multipanel-paper-figure/chart.vl.json` (three panels at 200×170 each: total rendered width ≈ 700pt including axes/legends — a double-column figure; see Task 3 sizing table):

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "hconcat": [
    {
      "title": {
        "text": "(a) Training",
        "anchor": "start",
        "fontWeight": "bold"
      },
      "width": 200,
      "height": 170,
      "data": {
        "url": "learning-curve.csv"
      },
      "mark": "line",
      "encoding": {
        "x": {
          "field": "epoch",
          "type": "quantitative"
        },
        "y": {
          "field": "f1",
          "type": "quantitative",
          "scale": {
            "zero": false
          }
        },
        "color": {
          "field": "model",
          "type": "nominal"
        }
      }
    },
    {
      "title": {
        "text": "(b) Ablation",
        "anchor": "start",
        "fontWeight": "bold"
      },
      "width": 200,
      "height": 170,
      "data": {
        "url": "ablation.csv"
      },
      "mark": "bar",
      "encoding": {
        "x": {
          "field": "component",
          "type": "nominal",
          "sort": null
        },
        "y": {
          "field": "score",
          "type": "quantitative"
        }
      }
    },
    {
      "title": {
        "text": "(c) Quality vs latency",
        "anchor": "start",
        "fontWeight": "bold"
      },
      "width": 200,
      "height": 170,
      "data": {
        "url": "pareto.csv"
      },
      "mark": "point",
      "encoding": {
        "x": {
          "field": "latency_ms",
          "type": "quantitative"
        },
        "y": {
          "field": "score",
          "type": "quantitative",
          "scale": {
            "zero": false
          }
        },
        "color": {
          "field": "family",
          "type": "nominal"
        }
      }
    }
  ]
}
```

Notes locked in by this spec: `$schema` is REQUIRED here — `detectSpecType` (`packages/cli/src/core/spec.ts:30-52`) cannot classify a concat spec without it because there is no top-level `mark`/`encoding`. Panel (b) uses `"sort": null` so bars keep CSV order (best-to-baseline) instead of alphabetical (spec §10.1 `ml-unordered-ablation` rationale).

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS — all tests including `multipanel-paper-figure composes three labeled panels with hconcat`.

- [ ] **Step 6: Verify the spec renders with a theme (concat + config merge)**

Run: `bun run packages/cli/src/index.ts render examples/multipanel-paper-figure/chart.vl.json --theme paper-clean --format svg --out examples/multipanel-paper-figure/output.svg`
Expected output:

```text
Rendered examples/multipanel-paper-figure/output.svg
Wrote examples/multipanel-paper-figure/output.meta.json
```

Open `examples/multipanel-paper-figure/output.svg` (or `head -c 400 examples/multipanel-paper-figure/output.svg`) and confirm it is a non-empty `<svg` document. Then remove the non-committed meta sidecar (`output.svg` is already gitignored):

Run: `rm examples/multipanel-paper-figure/output.meta.json`

- [ ] **Step 7: Create the example README**

Create `examples/multipanel-paper-figure/README.md`:

```markdown
# Multi-panel paper figure (hand-written spec)

A Figure-2(a)/(b)/(c)-style composite: three Vega-Lite views concatenated with
`hconcat`, each with its own small CSV and a bold, left-anchored panel label.
This is a hand-written spec — `infer` does not generate multi-panel layouts.

| Panel | Content | Data |
|-------|---------|------|
| (a) | Learning curve (line, two models) | `learning-curve.csv` |
| (b) | Ablation bars (kept in CSV order via `"sort": null`) | `ablation.csv` |
| (c) | Quality vs latency scatter (Pareto-style trade-off) | `pareto.csv` |

Panel labels are panel `title` objects:

```json
"title": { "text": "(a) Training", "anchor": "start", "fontWeight": "bold" }
```

Keep the label text short; put full experimental detail in the LaTeX caption.

## Render

The theme is applied once at render time and styles all panels uniformly
(theme config merges into the top-level `config`, which is global across
concatenated views):

```bash
vega-paper render examples/multipanel-paper-figure/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/multipanel-paper-figure/output.svg
```

Or from the repo root: `bun run render:multipanel`.

## Compose from existing specs with the template CLI

`chart-composed.vl.json` is generated (not hand-written) by the `multipanel`
template, which reads existing `.vl.json` files, rewrites their relative
`data.url` values, and wraps them in `hconcat`/`vconcat` with panel labels:

```bash
vega-paper template multipanel \
  --panel examples/training-curve/chart.vl.json:a:Training \
  --panel examples/ablation-bar/chart.vl.json:b:Ablation \
  --layout hconcat \
  --spec-out examples/multipanel-paper-figure/chart-composed.vl.json
```

Regenerate from the repo root with `bun run template:multipanel`. Add
`--theme <name> --out <path>.svg` to also render and write a `.meta.json`
sidecar. `--panel` values use `<spec-path>:<label>[:<title>]`; the template
takes no `<data>` argument.

## Facet vs concat vs separate files

| Approach | Use when | Trade-off |
|----------|----------|-----------|
| `--facet` (`infer`) / `facet` spec | Same chart repeated over one field's values (same data, same encodings) | Shared scales and legend for free; panels cannot differ in chart type |
| `hconcat` / `vconcat` (this example) | Panels are **different chart types or datasets** but belong in one figure with one caption | One coherent artifact, one theme pass, panel labels inside the figure; scales are independent unless you add `resolve` |
| Separate files + LaTeX `subfigure` | Panels need independent placement, sizing, or reuse across papers | Maximum layout control in LaTeX; label styling drifts (LaTeX labels vs figure labels) and panels can render with inconsistent themes |

Rule of thumb: same view repeated → facet; different views, one figure →
concat; panels reused or independently floated → separate files.

Sizing guidance (single- vs double-column widths) lives in
[skills/vega-paper/references/paper-style-guide.md](../../skills/vega-paper/references/paper-style-guide.md)
under "Multi-panel figures".

Committed `.vl.json` files are reference outputs. `output.svg` and
`output.meta.json` are generated locally and not committed.
```

- [ ] **Step 8: Lint-gate and commit**

Run: `bun run check`
Expected: `Checked N files ... No fixes applied` (or equivalent clean biome exit 0). If biome reformats the test file, re-run `bun test packages/cli/test/examples.test.ts` (expected PASS).

```bash
git add examples/multipanel-paper-figure/learning-curve.csv examples/multipanel-paper-figure/ablation.csv examples/multipanel-paper-figure/pareto.csv examples/multipanel-paper-figure/chart.vl.json examples/multipanel-paper-figure/README.md packages/cli/test/examples.test.ts
git commit -m "feat: add multipanel-paper-figure example with labeled hconcat panels"
```

---

### Task 2: Gallery coverage, `render:multipanel` script, examples README

**Files:**
- Modify: `scripts/render-gallery.test.ts` (`EXAMPLE_PREVIEWS`, lines 7-15)
- Modify: `scripts/render-gallery.ts` (`exampleJobs`, lines 17-53)
- Modify: `package.json` (scripts block, after `render:boxplot` at line 32)
- Modify: `examples/README.md` (folder table and gallery table)
- Create: `docs/assets/gallery/examples/multipanel-paper-figure.png` (rendered output, committed)

**Interfaces:**
- Consumes: `examples/multipanel-paper-figure/chart.vl.json` (Task 1).
- Produces: root script `render:multipanel`; gallery PNG at `docs/assets/gallery/examples/multipanel-paper-figure.png` referenced by `examples/README.md`.

- [ ] **Step 1: Write the failing gallery-asset test**

In `scripts/render-gallery.test.ts`, change `EXAMPLE_PREVIEWS` to:

```typescript
const EXAMPLE_PREVIEWS = [
  "basic-line",
  "training-curve",
  "confusion-matrix",
  "faceted-training",
  "boxplot",
  "embedding-scatter",
  "custom-theme",
  "multipanel-paper-figure",
];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test scripts/render-gallery.test.ts`
Expected: FAIL — `example PNGs exist` fails on `docs/assets/gallery/examples/multipanel-paper-figure.png`.

- [ ] **Step 3: Add the gallery job**

In `scripts/render-gallery.ts`, append to the `exampleJobs` array (after the `custom-theme` entry ending at line 52):

```typescript
  {
    spec: "examples/multipanel-paper-figure/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/multipanel-paper-figure.png`,
  },
```

- [ ] **Step 4: Render the new gallery PNG**

Render only the new asset directly (avoids re-rendering the whole gallery):

Run: `bun run packages/cli/src/index.ts render examples/multipanel-paper-figure/chart.vl.json --theme paper-clean --format png --scale 2 --out docs/assets/gallery/examples/multipanel-paper-figure.png`
Expected output:

```text
Rendered docs/assets/gallery/examples/multipanel-paper-figure.png
Wrote docs/assets/gallery/examples/multipanel-paper-figure.meta.json
```

(The `.meta.json` is gitignored under `docs/assets/gallery/**` — leave it.) Visually confirm the PNG shows three side-by-side panels with bold `(a)`/`(b)`/`(c)` labels.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test scripts/render-gallery.test.ts`
Expected: PASS (2 pass, 0 fail).

- [ ] **Step 6: Add the root `render:multipanel` script**

In root `package.json`, add after the `render:boxplot` line (keep it the last `render:*` entry; mind the comma on the previous line):

```json
    "render:multipanel": "bun run packages/cli/src/index.ts render examples/multipanel-paper-figure/chart.vl.json --theme paper-clean --format svg --out examples/multipanel-paper-figure/output.svg"
```

Verify: `bun run render:multipanel`
Expected output:

```text
Rendered examples/multipanel-paper-figure/output.svg
Wrote examples/multipanel-paper-figure/output.meta.json
```

Then: `rm examples/multipanel-paper-figure/output.meta.json`

- [ ] **Step 7: Update `examples/README.md`**

Add to the folder table (after the `embedding-scatter/` row, line 12):

```markdown
| [multipanel-paper-figure/](multipanel-paper-figure/) | Hand-written `hconcat` spec with `(a)`/`(b)`/`(c)` panel labels; `template multipanel` composition |
```

Add to the gallery table (after the `custom-theme/` row, line 27):

```markdown
| [multipanel-paper-figure/](multipanel-paper-figure/) | ![multipanel-paper-figure](../docs/assets/gallery/examples/multipanel-paper-figure.png) |
```

- [ ] **Step 8: Lint-gate and commit**

Run: `bun run check`
Expected: clean exit 0.

```bash
git add scripts/render-gallery.ts scripts/render-gallery.test.ts package.json examples/README.md docs/assets/gallery/examples/multipanel-paper-figure.png
git commit -m "feat: add multipanel example to gallery, render script, and examples index"
```

---

### Task 3: Multi-panel docs in paper-style-guide.md + chart-selection cross-link

**Files:**
- Modify: `skills/vega-paper/references/paper-style-guide.md` (insert new section after "Recommended figure sizes", i.e. after line 48)
- Modify: `skills/vega-paper/references/chart-selection.md` (add one row to "Examples in this repo" table, after the `basic-line/` row at line 81)

Anchor on the **section headings**, not line numbers: Phase A rewrites the "LaTeX and captions" region of `paper-style-guide.md` (SVG-only language), Phase E inserts an ML-lint section after the "Errors (always blocking)" table, and Phase B appends rows to `chart-selection.md`'s "Examples in this repo" table — none of these overlap the regions edited here, but they shift line numbers. If Phase B's rows landed first, append this plan's row after the **last** row of the table instead of directly after `basic-line/`.

**Interfaces:**
- Consumes: `examples/multipanel-paper-figure/` (Task 1); the `template multipanel` CLI (Task 5 — the doc references the command that Task 5 implements; the command text below matches Task 5's grammar exactly).
- Produces: section anchor "Multi-panel figures" in `paper-style-guide.md`, linked from the example README (Task 1) and chart-selection row.

Docs-only task: no test cycle; verification is `bun run check` (biome checks markdown formatting is not in scope, but the command must still pass) and a manual link check.

- [ ] **Step 1: Add the "Multi-panel figures" section to paper-style-guide.md**

Insert after the "Recommended figure sizes" section (after line 48, before `## \`--strict\` vs default`):

```markdown
## Multi-panel figures

Composite figures — Figure 2(a), 2(b), 2(c) — built with Vega-Lite `hconcat`
/ `vconcat`. Reference example:
[examples/multipanel-paper-figure/](../../../examples/multipanel-paper-figure/).

### Facet vs concat vs separate files

| Approach | Use when |
|----------|----------|
| `facet` (or `infer --facet`) | Same chart repeated over one field's values; shared scales/legend |
| `hconcat` / `vconcat` | Different chart types or datasets in one figure with one caption |
| Separate files + LaTeX `subfigure` | Panels floated, sized, or reused independently in LaTeX |

### Panel label conventions

- Label every panel `(a)`, `(b)`, `(c)` — lowercase, parenthesized, in reading
  order (left→right for `hconcat`, top→bottom for `vconcat`).
- Put the label in the panel `title`, left-anchored and bold:

  ```json
  "title": { "text": "(a) Training", "anchor": "start", "fontWeight": "bold" }
  ```

- Keep the panel title to a 1–3 word cue after the label; the full description
  belongs in the LaTeX caption (`\caption{... (a) Training curve. (b) ...}`).
- Compose existing specs with panel labels via the CLI:

  ```bash
  vega-paper template multipanel \
    --panel path/to/first.vl.json:a:Training \
    --panel path/to/second.vl.json:b:Ablation \
    --layout hconcat \
    --spec-out figure.vl.json
  ```

### Sizing for single- vs double-column layouts

Total rendered width ≈ sum of per-panel `width` + roughly 40–60px per panel
for axes, legends, and concat spacing. Set explicit `width`/`height` on
**every panel view**: lint's `size-out-of-range` only reads top-level
dimensions (which concat specs do not have), and `size-missing` will warn on
the missing top-level size regardless — treat that warning as a reminder to
size each panel, not as something to fix at the top level.

| Layout target | Lint profile | Total width budget | Panels (`hconcat`) | Per-panel `width` | Per-panel `height` |
|---------------|--------------|-------------------|--------------------|-------------------|--------------------|
| Single column (~360pt, e.g. one ACL/two-column column) | `acl` (240–480 width range) | ≤ 360 | 1–2 | 120–160 | 140–200 |
| Double column / full page width (~700pt) | `paper` (180–720 width range) | ≤ 700 | 2–3 | 180–220 | 150–200 |

Lint the composed spec with the profile matching the layout target:
`vega-paper lint figure.vl.json --lint-profile acl` for single-column,
`--lint-profile paper` (the default) for double-column figures.

- More than 3 panels in one row is rarely readable at paper scale — switch to
  `vconcat`, a 2×2 grid (`vconcat` of `hconcat` rows), or separate files.
- For `vconcat`, budget total height instead: keep it under ~540 for `paper`
  profile pages (matches the profile height cap).
- Themes apply once at render (`--theme` merges into top-level `config`) and
  style all panels uniformly — never bake per-panel fonts/colors into views.
```

- [ ] **Step 2: Add the cross-link row to chart-selection.md**

In the "Examples in this repo" table, after the `basic-line/` row:

```markdown
| [multipanel-paper-figure/](../../../examples/multipanel-paper-figure/) | (hand-written `hconcat` spec) | panel labels `(a)`–`(c)`; sizing in [paper-style-guide.md](paper-style-guide.md#multi-panel-figures) — not `infer` |
```

- [ ] **Step 3: Verify links and lint-gate**

Run: `ls examples/multipanel-paper-figure/README.md skills/vega-paper/references/paper-style-guide.md`
Expected: both paths print (link targets exist).

Run: `bun run check`
Expected: clean exit 0.

- [ ] **Step 4: Commit**

```bash
git add skills/vega-paper/references/paper-style-guide.md skills/vega-paper/references/chart-selection.md
git commit -m "docs: add multi-panel sizing and panel label conventions"
```

---

### Task 4: `buildMultipanelSpec` + `rebaseDataUrl` core builder

**Files:**
- Create: `packages/cli/src/core/templates/multipanel.ts`
- Create: `packages/cli/test/template-multipanel.test.ts`

**Interfaces:**
- Consumes: `JsonObject` from `packages/cli/src/core/spec.ts`, `VegaPaperError` from `packages/cli/src/core/errors.ts`.
- Produces (Task 5 relies on these exact signatures):
  - `type MultipanelLayout = "hconcat" | "vconcat"`
  - `type MultipanelPanel = { spec: JsonObject; label: string; title?: string | undefined }`
  - `type MultipanelRequest = { panels: MultipanelPanel[]; layout: MultipanelLayout }`
  - `buildMultipanelSpec(request: MultipanelRequest): JsonObject`
  - `rebaseDataUrl(spec: JsonObject, specDirectory: string, outputDirectory: string): JsonObject`

- [ ] **Step 1: Write the failing builder tests**

Create `packages/cli/test/template-multipanel.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { JsonObject } from "../src/core/spec";
import { buildMultipanelSpec, rebaseDataUrl } from "../src/core/templates/multipanel";

function linePanel(): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    mark: "line",
    width: 360,
    height: 240,
    config: { font: "serif" },
    title: "Training F1",
    encoding: {
      x: { field: "epoch", type: "quantitative" },
      y: { field: "f1", type: "quantitative" },
    },
  };
}

function barPanel(): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    mark: "bar",
    encoding: {
      x: { field: "component", type: "nominal" },
      y: { field: "score", type: "quantitative" },
    },
  };
}

describe("buildMultipanelSpec", () => {
  test("wraps panels in hconcat with anchored bold labels", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");
    expect(spec.vconcat).toBeUndefined();

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(panels).toHaveLength(2);
    expect(panels[0]?.title).toEqual({
      text: "(a) Training",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[1]?.title).toEqual({
      text: "(b) Ablation",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[0]?.mark).toBe("line");
    expect(panels[1]?.mark).toBe("bar");
  });

  test("strips panel $schema and config so the outer spec owns both", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    for (const panel of panels) {
      expect(panel.$schema).toBeUndefined();
      expect(panel.config).toBeUndefined();
    }
  });

  test("omitted panel title yields a bare label", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a" },
        { spec: barPanel(), label: "b" },
      ],
    });

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect((panels[0]?.title as { text: string }).text).toBe("(a)");
  });

  test("vconcat layout stacks panels vertically", () => {
    const spec = buildMultipanelSpec({
      layout: "vconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(spec.hconcat).toBeUndefined();
    expect(spec.vconcat as unknown[]).toHaveLength(2);
  });

  test("does not mutate the input panel specs", () => {
    const original = linePanel();
    const untouched = structuredClone(original);

    buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: original, label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(original).toEqual(untouched);
  });

  test("rejects fewer than two panels", () => {
    expect(() =>
      buildMultipanelSpec({
        layout: "hconcat",
        panels: [{ spec: linePanel(), label: "a", title: "Training" }],
      }),
    ).toThrow(VegaPaperError);
  });
});

describe("rebaseDataUrl", () => {
  test("rewrites a relative data url from the panel dir to the output dir", () => {
    const rebased = rebaseDataUrl(
      linePanel(),
      "/repo/examples/training-curve",
      "/repo/examples/multipanel-paper-figure",
    );

    expect(rebased.data).toEqual({ url: "../training-curve/data.csv" });
  });

  test("keeps the url unchanged when panel and output dirs match", () => {
    const rebased = rebaseDataUrl(linePanel(), "/repo/figures", "/repo/figures");

    expect(rebased.data).toEqual({ url: "data.csv" });
  });

  test("leaves remote and absolute urls unchanged", () => {
    const remote: JsonObject = { data: { url: "https://example.org/data.csv" }, mark: "line" };
    const absolute: JsonObject = { data: { url: "/srv/data.csv" }, mark: "line" };

    expect(rebaseDataUrl(remote, "/repo/a", "/repo/b").data).toEqual({
      url: "https://example.org/data.csv",
    });
    expect(rebaseDataUrl(absolute, "/repo/a", "/repo/b").data).toEqual({
      url: "/srv/data.csv",
    });
  });

  test("leaves inline data.values specs unchanged", () => {
    const inline: JsonObject = { data: { values: [{ x: 1 }] }, mark: "line" };

    expect(rebaseDataUrl(inline, "/repo/a", "/repo/b").data).toEqual({
      values: [{ x: 1 }],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-multipanel.test.ts`
Expected: FAIL — cannot resolve module `../src/core/templates/multipanel`.

- [ ] **Step 3: Implement the builder**

Create `packages/cli/src/core/templates/multipanel.ts`:

```typescript
import { isAbsolute, relative, resolve } from "node:path";
import { VegaPaperError } from "../errors";
import type { JsonObject } from "../spec";

export type MultipanelLayout = "hconcat" | "vconcat";

export type MultipanelPanel = {
  spec: JsonObject;
  label: string;
  title?: string | undefined;
};

export type MultipanelRequest = {
  panels: MultipanelPanel[];
  layout: MultipanelLayout;
};

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";

export function buildMultipanelSpec(request: MultipanelRequest): JsonObject {
  if (request.panels.length < 2) {
    throw new VegaPaperError(
      "The multipanel template requires at least two panels. Pass --panel twice or more.",
    );
  }

  return {
    $schema: VEGA_LITE_SCHEMA,
    [request.layout]: request.panels.map((panel) => toPanelView(panel)),
  };
}

function toPanelView(panel: MultipanelPanel): JsonObject {
  const view = structuredClone(panel.spec);

  delete view.$schema;
  delete view.config;

  const text = panel.title === undefined ? `(${panel.label})` : `(${panel.label}) ${panel.title}`;

  view.title = { text, anchor: "start", fontWeight: "bold" };

  return view;
}

export function rebaseDataUrl(
  spec: JsonObject,
  specDirectory: string,
  outputDirectory: string,
): JsonObject {
  const rebased = structuredClone(spec);
  const data = rebased.data;

  if (!isPlainObject(data) || typeof data.url !== "string") {
    return rebased;
  }

  if (isRemoteUrl(data.url) || isAbsolute(data.url)) {
    return rebased;
  }

  data.url = relative(resolve(outputDirectory), resolve(specDirectory, data.url));

  return rebased;
}

function isRemoteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

Design notes locked in: `rebaseDataUrl` handles the **top-level** `data.url` only. Every spec `infer` emits (including Phase A's layered errorband spec) carries data at the top level, so nested per-layer `data` rebasing is YAGNI for now; the panel keeps its own `width`/`height`/`title`-free view semantics otherwise untouched. Stripping `config` prevents a panel's baked-in theme from overriding the render-time theme merged into the outer spec's `config`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/cli/test/template-multipanel.test.ts`
Expected: PASS (10 pass, 0 fail).

- [ ] **Step 5: Lint-gate, typecheck, and commit**

Run: `bun run check`
Expected: clean exit 0.
Run: `bun run typecheck`
Expected: exit 0, no diagnostics.

```bash
git add packages/cli/src/core/templates/multipanel.ts packages/cli/test/template-multipanel.test.ts
git commit -m "feat: add multipanel template spec builder with data url rebasing"
```

---

### Task 5: `multipanel` template CLI wiring, `template:multipanel` script, composed example

**Files:**
- Modify: `packages/cli/src/core/template.ts` (Phase C dispatcher)
- Modify: `packages/cli/src/commands/template.ts` (Phase C command)
- Modify: `packages/cli/src/core/figure-meta.ts` (widen Phase C's template meta for input-less templates)
- Modify: `packages/cli/test/template.test.ts` and `packages/cli/test/template-command.test.ts` (unknown-template error message gains `multipanel`)
- Modify: `packages/cli/test/template-multipanel.test.ts` (append parsing + end-to-end tests)
- Modify: `packages/cli/test/examples.test.ts` (append composed-spec test)
- Modify: root `package.json` (add `template:multipanel` script)
- Create: `examples/multipanel-paper-figure/chart-composed.vl.json` (generated by the script, committed)

**Interfaces:**
- Consumes: `buildMultipanelSpec`, `rebaseDataUrl`, `MultipanelPanel`, `MultipanelLayout`, `MultipanelRequest` (Task 4, exact signatures above); Phase C's `TEMPLATE_NAMES` / `buildTemplateSpec` / `TemplateRequest` / `registerTemplateCommand` / `TemplateCommandOptions` / `resolveTemplateOutputs` / `toSpecWriteError` / `toMetaWriteError` and its injected `writeOutput` / `runRender` / `writeSpec` / `writeFigureMetaFile` dependencies; Phase C's `buildTemplateFigureMeta` (widened in Step 4e); `loadJsonSpec` / `detectSpecType` (`packages/cli/src/core/spec.ts`); Phase B's `examples/ablation-bar/chart.vl.json`.
- Produces: CLI `vega-paper template multipanel --panel <spec-path>:<label>[:<title>] --panel ... [--layout hconcat|vconcat] [--theme <t>] [--format <f>] [--scale <s>] [--out <o>] [--spec-out <s>]`; exported `parsePanelOption(value: string): ParsedPanelOption` and `parseMultipanelLayout(value: string | undefined): MultipanelLayout` from `packages/cli/src/commands/template.ts`.

**CLI option decisions (final):**
- `--panel` is repeatable (commander collect callback into `string[]`); at least two values required.
- Grammar `<spec-path>:<label>[:<title>]`: split on `:`; part 1 = path, part 2 = label, parts 3+ re-joined with `:` as the title (so shell-quoted titles like `Quality: latency` work). Empty path or label → error. A trailing empty title (`p.vl.json:a:`) is treated as no title.
- `multipanel` takes **no** `<data>` positional. The command's data argument becomes optional (`[data]`); `template multipanel some.csv` errors with a message pointing at `--panel`; every other template still errors when `<data>` is missing, and rejects `--panel`/`--layout`.
- `--layout` defaults to `hconcat`; only `hconcat`/`vconcat` accepted.
- Output rules reuse Phase C's `resolveTemplateOutputs` helper verbatim (same module): at least one of `--spec-out`/`--out` required; `--spec-out` defaults to the sibling `.vl.json` of `--out` (`toSiblingSpecPath`); `--theme` requires `--out`.
- Every panel spec must be Vega-Lite (`detectSpecType` must return `"vega-lite"`); raw Vega panels are rejected.

- [ ] **Step 1: Write the failing parsing tests**

Append to `packages/cli/test/template-multipanel.test.ts`:

```typescript
import { parseMultipanelLayout, parsePanelOption } from "../src/commands/template";

describe("parsePanelOption", () => {
  test("splits path, label, and title", () => {
    expect(parsePanelOption("examples/training-curve/chart.vl.json:a:Training")).toEqual({
      specPath: "examples/training-curve/chart.vl.json",
      label: "a",
      title: "Training",
    });
  });

  test("title is optional", () => {
    expect(parsePanelOption("chart.vl.json:b")).toEqual({
      specPath: "chart.vl.json",
      label: "b",
      title: undefined,
    });
  });

  test("re-joins colons inside the title", () => {
    expect(parsePanelOption("chart.vl.json:c:Quality: latency")).toEqual({
      specPath: "chart.vl.json",
      label: "c",
      title: "Quality: latency",
    });
  });

  test("treats a trailing empty title as no title", () => {
    expect(parsePanelOption("chart.vl.json:a:")).toEqual({
      specPath: "chart.vl.json",
      label: "a",
      title: undefined,
    });
  });

  test("rejects a value without a label", () => {
    expect(() => parsePanelOption("chart.vl.json")).toThrow(VegaPaperError);
    expect(() => parsePanelOption("chart.vl.json")).toThrow(
      'Invalid --panel value "chart.vl.json". Expected <spec-path>:<label>[:<title>].',
    );
  });

  test("rejects empty path or empty label", () => {
    expect(() => parsePanelOption(":a:Training")).toThrow(VegaPaperError);
    expect(() => parsePanelOption("chart.vl.json::Training")).toThrow(VegaPaperError);
  });
});

describe("parseMultipanelLayout", () => {
  test("defaults to hconcat and accepts both layouts", () => {
    expect(parseMultipanelLayout(undefined)).toBe("hconcat");
    expect(parseMultipanelLayout("hconcat")).toBe("hconcat");
    expect(parseMultipanelLayout("vconcat")).toBe("vconcat");
  });

  test("rejects unknown layouts", () => {
    expect(() => parseMultipanelLayout("grid")).toThrow(VegaPaperError);
  });
});
```

Note: place the `import { parseMultipanelLayout, parsePanelOption } ...` line with the other imports at the top of the file, not mid-file (biome enforces import position).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/cli/test/template-multipanel.test.ts`
Expected: FAIL — `parsePanelOption`/`parseMultipanelLayout` are not exported from `../src/commands/template`.

- [ ] **Step 3: Hook `multipanel` into the Phase C dispatcher**

Modify `packages/cli/src/core/template.ts` (three integration points against Phase C's code as planned).

3a. Add `"multipanel"` to the `TEMPLATE_NAMES` const. This widens the derived `TemplateName` type and updates `parseTemplateName`'s accept list, its error message, and the `<template-name>` argument help text automatically — there is no separate hand-written union to edit:

```diff
 export const TEMPLATE_NAMES = [
   "benchmark-heatmap",
   "pareto-frontier",
   "scaling-law",
   "calibration-curve",
+  "multipanel",
 ] as const;
```

3b. Add the import (alphabetical position between the calibration-curve and pareto-frontier builder imports) and the request union member:

```diff
 import { buildBenchmarkHeatmapSpec } from "./templates/benchmark-heatmap";
 import { buildCalibrationCurveSpec } from "./templates/calibration-curve";
+import { buildMultipanelSpec, type MultipanelRequest } from "./templates/multipanel";
 import { buildParetoFrontierSpec } from "./templates/pareto-frontier";
 import { buildScalingLawSpec } from "./templates/scaling-law";
```

```diff
+export type MultipanelTemplateRequest = { template: "multipanel" } & MultipanelRequest;
+
 export type TemplateRequest =
   | BenchmarkHeatmapRequest
   | ParetoFrontierRequest
   | ScalingLawRequest
-  | CalibrationCurveRequest;
+  | CalibrationCurveRequest
+  | MultipanelTemplateRequest;
```

(`MultipanelTemplateRequest` deliberately does **not** extend Phase C's `TemplateCommonRequest` — multipanel has no CSV `table`, `inputPath`, or top-level size overrides.)

3c. Add the `switch` case in `buildTemplateSpec`:

```diff
     case "calibration-curve":
       return buildCalibrationCurveSpec(request);
+    case "multipanel":
+      return buildMultipanelSpec(request);
   }
```

3d. Adding `"multipanel"` to `TEMPLATE_NAMES` changes the `parseTemplateName` error message, which two Phase C tests assert verbatim. In `packages/cli/test/template.test.ts` (test `rejects unknown template names`) and `packages/cli/test/template-command.test.ts` (test `rejects unknown template names`), update the expected message in both places to:

```text
Unknown template "violin". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve, multipanel.
```

Run: `bun test packages/cli/test/template.test.ts packages/cli/test/template-command.test.ts`
Expected: PASS (0 fail). (`bun run typecheck` would still fail at this point — `ALLOWED_OPTIONS_BY_TEMPLATE` in `commands/template.ts` is missing the `multipanel` key until Step 4.)

- [ ] **Step 4: Add parsing and the multipanel run path to the command**

Modify `packages/cli/src/commands/template.ts`.

4a. Add imports (merge into existing import statements — Phase C's file already imports `extname` from `node:path` and `type JsonObject` from `../core/spec`):

```typescript
import { dirname, extname } from "node:path";
import { detectSpecType, type JsonObject, loadJsonSpec } from "../core/spec";
import {
  type MultipanelLayout,
  type MultipanelPanel,
  rebaseDataUrl,
} from "../core/templates/multipanel";
```

Everything else this task uses — `VegaPaperError`, `buildTemplateSpec`, `buildRenderRequest`, `toSiblingMetaPath`, `resolveFigureMetaVersions`, `buildTemplateFigureMeta`, `resolveTemplateOutputs`, `toSpecWriteError`, `toMetaWriteError`, and the injected `writeOutput`/`runRender`/`writeSpec`/`writeFigureMetaFile` — is already imported or defined by Phase C's `commands/template.ts`. Do not add `node:fs/promises` imports; file writes go through the injected `writeSpec` (`writeSpecFile`, which creates directories) and `writeFigureMetaFile`.

4b. Extend `TemplateCommandOptions` with:

```typescript
  panel?: string[];
  layout?: string;
```

4c. Register the new options and make the data positional optional. Expected diff on Phase C's command registration (`--panel`/`--layout` go directly after the `--fit` option; keep every other option line unchanged):

```diff
   program
     .command("template")
     .argument("<template-name>", `template name: ${TEMPLATE_NAMES.join(", ")}`)
-    .argument("<data>", "CSV input path")
+    .argument("[data]", "CSV input path (not used by the multipanel template)")
     .description("Generate a structured ML paper figure spec from a named template")
     ...
     .option("--fit <method>", "fitted trend overlay: regression")
+    .option(
+      "--panel <value>",
+      "multipanel panel as <spec-path>:<label>[:<title>] (repeatable)",
+      collectPanelValues,
+      [] as string[],
+    )
+    .option("--layout <layout>", "multipanel layout: hconcat or vconcat (default hconcat)")
     .option("--title <text>", "chart title")
     ...
     .action(
-      async (templateNameValue: string, inputPath: string, options: TemplateCommandOptions) => {
+      async (
+        templateNameValue: string,
+        inputPath: string | undefined,
+        options: TemplateCommandOptions,
+      ) => {
         const template = parseTemplateName(templateNameValue);
+
+        if (template === "multipanel") {
+          if (inputPath !== undefined) {
+            throw new VegaPaperError(
+              "The multipanel template does not take a <data> argument. Pass panels with --panel <spec-path>:<label>[:<title>].",
+            );
+          }
+
+          await runMultipanelTemplate(options, {
+            writeOutput,
+            runRender,
+            writeSpec,
+            writeFigureMetaFile,
+          });
+          return;
+        }
+
+        if (inputPath === undefined) {
+          throw new VegaPaperError("Missing required argument <data>.");
+        }
+
+        if ((options.panel ?? []).length > 0 || options.layout !== undefined) {
+          throw new VegaPaperError(
+            'The "--panel" and "--layout" options are only valid with the multipanel template.',
+          );
+        }
         const specOutputPath = resolveTemplateOutputs(options);
         ...existing Phase C flow unchanged...
```

(`writeOutput`, `runRender`, `writeSpec`, and `writeFigureMetaFile` are Phase C's injected `registerTemplateCommand` parameters, in scope inside the action.)

Also add a `multipanel` entry to Phase C's `ALLOWED_OPTIONS_BY_TEMPLATE` so the `Record<TemplateName, readonly TemplateOptionKey[]>` type stays exhaustive after Step 3a (the multipanel branch returns before `buildTemplateRequest`, so the empty list exists only for the type):

```diff
   "scaling-law": ["x", "y", "color", "xScale", "fit"],
   "calibration-curve": ["confidence", "accuracy", "count", "ece"],
+  multipanel: [],
 };
```

4d. Add the complete new functions to `packages/cli/src/commands/template.ts`:

```typescript
export type ParsedPanelOption = {
  specPath: string;
  label: string;
  title?: string | undefined;
};

export function parsePanelOption(value: string): ParsedPanelOption {
  const parts = value.split(":");

  if (parts.length < 2) {
    throw new VegaPaperError(
      `Invalid --panel value "${value}". Expected <spec-path>:<label>[:<title>].`,
    );
  }

  const [specPath = "", label = "", ...titleParts] = parts;

  if (specPath === "" || label === "") {
    throw new VegaPaperError(
      `Invalid --panel value "${value}". Spec path and label must be non-empty.`,
    );
  }

  const title = titleParts.join(":");

  return {
    specPath,
    label,
    title: title === "" ? undefined : title,
  };
}

export function parseMultipanelLayout(value: string | undefined): MultipanelLayout {
  if (value === undefined || value === "hconcat") {
    return "hconcat";
  }

  if (value === "vconcat") {
    return "vconcat";
  }

  throw new VegaPaperError(
    `Invalid value "${value}" for --layout. Expected one of: hconcat, vconcat.`,
  );
}

function collectPanelValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

type MultipanelTemplateDeps = {
  writeOutput: (value: string) => void;
  runRender: (request: RenderRequest) => Promise<RenderResult>;
  writeSpec: (specOutputPath: string, spec: JsonObject) => Promise<void>;
  writeFigureMetaFile: (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
};

async function runMultipanelTemplate(
  options: TemplateCommandOptions,
  deps: MultipanelTemplateDeps,
): Promise<void> {
  const panelValues = options.panel ?? [];

  if (panelValues.length < 2) {
    throw new VegaPaperError("The multipanel template requires at least two --panel values.");
  }

  const layout = parseMultipanelLayout(options.layout);
  const specOutputPath = resolveTemplateOutputs(options);
  const outputDirectory = dirname(specOutputPath);
  const panels: MultipanelPanel[] = [];

  for (const value of panelValues) {
    const parsed = parsePanelOption(value);
    const panelSpec = await loadJsonSpec(parsed.specPath);

    if (detectSpecType(panelSpec) !== "vega-lite") {
      throw new VegaPaperError(
        `Multipanel panels must be Vega-Lite specs. Not Vega-Lite: ${parsed.specPath}`,
      );
    }

    panels.push({
      spec: rebaseDataUrl(panelSpec, dirname(parsed.specPath), outputDirectory),
      label: parsed.label,
      title: parsed.title,
    });
  }

  const spec = buildTemplateSpec({ template: "multipanel", panels, layout });

  try {
    await deps.writeSpec(specOutputPath, spec);
  } catch (error) {
    throw toSpecWriteError(specOutputPath, error);
  }

  deps.writeOutput(`Wrote ${specOutputPath}\n`);

  if (options.out === undefined) {
    return;
  }

  const renderRequest = buildRenderRequest({
    inputPath: specOutputPath,
    outputPath: options.out,
    format: options.format,
    scale: options.scale,
    themeName: options.theme,
  });
  const renderResult = await deps.runRender(renderRequest);

  deps.writeOutput(`Rendered ${renderResult.outputPath}\n`);

  const metaOutputPath = toSiblingMetaPath(options.out);
  const versions = await resolveFigureMetaVersions();
  const meta = buildTemplateFigureMeta({
    template: "multipanel",
    outputPath: options.out,
    specOutPath: specOutputPath,
    themeName: options.theme,
    format: renderRequest.format,
    scale: renderRequest.scale,
    versions,
    options: { panels: panelValues, layout },
  });

  try {
    await deps.writeFigureMetaFile(metaOutputPath, meta);
  } catch (error) {
    throw toMetaWriteError(metaOutputPath, error);
  }

  deps.writeOutput(`Wrote ${metaOutputPath}\n`);
}
```

Design notes: `resolveTemplateOutputs`, `toSpecWriteError`, and `toMetaWriteError` are Phase C's existing module-private helpers — reused, not duplicated, so the multipanel path produces identical output-destination and write-failure error messages. `RenderRequest`/`RenderResult` are already type-imported by Phase C's file; `MultipanelTemplateDeps` just names the subset of injected dependencies the run path needs.

4e. Widen Phase C's template figure meta for the input-less multipanel template. In `packages/cli/src/core/figure-meta.ts`:

```diff
-export type TemplateOptionsSnapshot = Record<string, string | number | boolean>;
+export type TemplateOptionsSnapshot = Record<string, string | number | boolean | string[]>;
```

```diff
 export type TemplateFigureMeta = {
   generatedBy: "vega-paper";
   command: "template";
   template: TemplateName;
-  input: string;
+  input?: string;
   output: string;
```

```diff
 export type BuildTemplateFigureMetaInput = {
   template: TemplateName;
-  inputPath: string;
+  inputPath?: string | undefined;
   outputPath: string;
```

And in `buildTemplateFigureMeta`, replace the unconditional `input` assignment in the object literal with a conditional one after construction:

```diff
   const meta: TemplateFigureMeta = {
     generatedBy: "vega-paper",
     command: "template",
     template: input.template,
-    input: input.inputPath,
     output: input.outputPath,
     specOut: input.specOutPath,
     createdAt: createdAt.toISOString(),
     vegaPaperVersion: versions.vegaPaperVersion,
     vegaVersion: versions.vegaVersion,
     vegaLiteVersion: versions.vegaLiteVersion,
     options: input.options,
   };
+
+  if (input.inputPath !== undefined) {
+    meta.input = input.inputPath;
+  }
```

Phase C's `figure-meta.test.ts` tests keep passing unchanged: they always pass `inputPath` (so `input` is still present in their expected objects) and only use scalar snapshot values (assignable to the widened `TemplateOptionsSnapshot`).

Run: `bun test packages/cli/test/figure-meta.test.ts`
Expected: PASS (0 fail).

- [ ] **Step 5: Run the parsing tests to verify they pass**

Run: `bun test packages/cli/test/template-multipanel.test.ts`
Expected: PASS (18 pass, 0 fail).

- [ ] **Step 6: Write the failing end-to-end command tests**

Append to `packages/cli/test/template-multipanel.test.ts` (add `import { mkdtemp, rm, writeFile } from "node:fs/promises";`, `import { tmpdir } from "node:os";`, `import { join } from "node:path";`, and `import { afterEach } from "bun:test";` merged into the existing `bun:test` import, at the top of the file):

```typescript
const REPO_ROOT = join(import.meta.dir, "../../..");
const CLI_ENTRY = join(REPO_ROOT, "packages/cli/src/index.ts");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createPanelWorkspace(): Promise<{
  workspace: string;
  panelA: string;
  panelB: string;
}> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-multipanel-"));
  temporaryDirectories.push(workspace);

  const panelsDirectory = join(workspace, "panels");
  await mkdir(panelsDirectory, { recursive: true });

  const panelA = join(panelsDirectory, "curve.vl.json");
  const panelB = join(panelsDirectory, "bars.vl.json");

  await writeFile(
    panelA,
    `${JSON.stringify(
      {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: { url: "curve.csv" },
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    panelB,
    `${JSON.stringify(
      {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: { url: "bars.csv" },
        mark: "bar",
        encoding: {
          x: { field: "component", type: "nominal" },
          y: { field: "score", type: "quantitative" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { workspace, panelA, panelB };
}

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", CLI_ENTRY, ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

describe("template multipanel command", () => {
  test("composes two spec files into a labeled hconcat spec with rebased data urls", async () => {
    const { workspace, panelA, panelB } = await createPanelWorkspace();
    const specOut = join(workspace, "figures", "combined.vl.json");

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a:Training`,
      "--panel",
      `${panelB}:b:Ablation`,
      "--layout",
      "hconcat",
      "--spec-out",
      specOut,
    ]);

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Wrote ${specOut}`);

    const spec = (await Bun.file(specOut).json()) as Record<string, unknown>;
    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");
    expect(panels).toHaveLength(2);
    expect(panels[0]?.title).toEqual({
      text: "(a) Training",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[0]?.data).toEqual({ url: "../panels/curve.csv" });
    expect(panels[1]?.data).toEqual({ url: "../panels/bars.csv" });
  });

  test("rejects a <data> positional argument", async () => {
    const { panelA, panelB, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "some-data.csv",
      "--panel",
      `${panelA}:a`,
      "--panel",
      `${panelB}:b`,
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not take a <data> argument");
  });

  test("rejects fewer than two --panel values", async () => {
    const { panelA, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requires at least two --panel values");
  });

  test("rejects a malformed --panel value", async () => {
    const { panelA, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--panel",
      "no-label-here",
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid --panel value "no-label-here"');
  });

  test("rejects an unknown --layout", async () => {
    const { panelA, panelB, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--panel",
      `${panelB}:b`,
      "--layout",
      "grid",
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid value "grid" for --layout');
  });
});
```

(Also merge `mkdir` into the `node:fs/promises` import.)

- [ ] **Step 7: Run the end-to-end tests**

Run: `bun test packages/cli/test/template-multipanel.test.ts`
Expected: PASS (23 pass, 0 fail). If the "rejects a <data> positional" or panel-count tests fail, fix `packages/cli/src/commands/template.ts` (Step 4c ordering: the multipanel branch must run before any `<data>` requirement) — do not weaken the tests.

- [ ] **Step 8: Add the `template:multipanel` script and generate the composed example**

In root `package.json`, add after the `render:multipanel` script from Task 2:

```json
    "template:multipanel": "bun run packages/cli/src/index.ts template multipanel --panel examples/training-curve/chart.vl.json:a:Training --panel examples/ablation-bar/chart.vl.json:b:Ablation --layout hconcat --spec-out examples/multipanel-paper-figure/chart-composed.vl.json"
```

Run: `bun run template:multipanel`
Expected output:

```text
Wrote examples/multipanel-paper-figure/chart-composed.vl.json
```

- [ ] **Step 9: Write the composed-example structure test**

Append inside `describe("examples", ...)` in `packages/cli/test/examples.test.ts` (after the Task 1 multipanel test):

```typescript
  test("multipanel-paper-figure composed chart references sibling example data", async () => {
    const spec = await readExampleSpec("examples/multipanel-paper-figure/chart-composed.vl.json");
    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(panels).toHaveLength(2);
    expect(panels[0]?.data).toEqual({ url: "../training-curve/data.csv" });
    expect(panels[1]?.data).toEqual({ url: "../ablation-bar/data.csv" });
    expect(panels[0]?.title).toEqual({
      text: "(a) Training",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[1]?.title).toEqual({
      text: "(b) Ablation",
      anchor: "start",
      fontWeight: "bold",
    });
  });
```

Run: `bun test packages/cli/test/examples.test.ts`
Expected: PASS. (If `panels[1]?.data` differs, inspect `examples/ablation-bar/chart.vl.json` — Phase B generated it with `--spec-out examples/ablation-bar/chart.vl.json` from `examples/ablation-bar/data.csv`, so its url is `data.csv` and rebases to `../ablation-bar/data.csv`. Fix the test's expected url only if Phase B's committed spec genuinely uses a different data filename.)

- [ ] **Step 10: Render smoke of the composed spec**

Run: `bun run packages/cli/src/index.ts render examples/multipanel-paper-figure/chart-composed.vl.json --theme paper-clean --format svg --out examples/multipanel-paper-figure/output.svg`
Expected output:

```text
Rendered examples/multipanel-paper-figure/output.svg
Wrote examples/multipanel-paper-figure/output.meta.json
```

Then: `rm examples/multipanel-paper-figure/output.meta.json`

- [ ] **Step 11: Lint-gate, typecheck, and commit**

Run: `bun run check`
Expected: clean exit 0.
Run: `bun run typecheck`
Expected: exit 0.

```bash
git add packages/cli/src/core/template.ts packages/cli/src/core/templates/multipanel.ts packages/cli/src/commands/template.ts packages/cli/src/core/figure-meta.ts packages/cli/test/template.test.ts packages/cli/test/template-command.test.ts packages/cli/test/template-multipanel.test.ts packages/cli/test/examples.test.ts package.json examples/multipanel-paper-figure/chart-composed.vl.json
git commit -m "feat: add multipanel template command composing existing specs"
```

---

### Task 6: Full-suite verification

**Files:** none created or modified (fix-forward only if a step fails).

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: 0 fail across all workspace test files (includes `packages/cli/test/*.test.ts` and `scripts/render-gallery.test.ts`).

- [ ] **Step 2: Typecheck and lint**

Run: `bun run typecheck && bun run check`
Expected: both exit 0.

- [ ] **Step 3: End-to-end render + template smoke via package scripts**

Run: `bun run render:multipanel && bun run template:multipanel`
Expected output:

```text
Rendered examples/multipanel-paper-figure/output.svg
Wrote examples/multipanel-paper-figure/output.meta.json
Wrote examples/multipanel-paper-figure/chart-composed.vl.json
```

Then: `rm examples/multipanel-paper-figure/output.meta.json`

Run: `git status --porcelain`
Expected: empty (regenerating `chart-composed.vl.json` is byte-identical to the committed file; `output.svg` is gitignored). If `chart-composed.vl.json` shows as modified, the template output is nondeterministic — debug before proceeding (use superpowers:systematic-debugging), do not commit the diff blindly.

- [ ] **Step 4: Commit (only if fixes were needed)**

If Steps 1-3 required code fixes, commit them:

```bash
git add -A
git commit -m "feat: fix multipanel integration issues found in full-suite verification"
```

Otherwise there is nothing to commit and Phase D is complete.
