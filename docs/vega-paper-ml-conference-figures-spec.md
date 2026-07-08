# VegaPaper ML Conference Figure Recipes Spec

Status: Draft  
Date: 2026-07-08  
Repository: `nishide-dev/vega-paper`  
Owner: `nishide-dev`

## 1. Summary

This specification defines the next set of VegaPaper updates for producing figures that commonly appear in machine-learning conference papers such as NeurIPS, ICML, ICLR, ACL, EMNLP, COLM, and related venues.

VegaPaper remains a researcher-facing figure-generation tool, not a machine-learning research contribution by itself. The goal is to make it easier for researchers to turn experiment outputs into publication-ready static figures using Vega/Vega-Lite, with consistent styling, linting, export formats, and reproducibility metadata.

The focus of this spec is therefore:

- ML paper figure recipes, not generic chart support.
- Deterministic CLI workflows, not free-form visual editing.
- Publication-ready static figures, not dashboards.
- Vega-Lite-first generation, with Vega fallback only where Vega-Lite becomes too restrictive.
- Examples and templates that look like figures a researcher would actually include in an ML paper.

## 2. Background and Current State

VegaPaper currently provides a CLI for creating publication-ready figures from CSV/JSON using Vega-Lite. The implemented workflow includes:

- `infer`: build a Vega-Lite spec from tabular data and chart options.
- `render`: render a spec to SVG, PNG, or PDF with a selected theme.
- `lint`: check figure specs against paper-oriented profiles.
- `themes`: list and inspect built-in or custom themes.
- `doctor`: verify rendering toolchain dependencies.

Current `infer` chart types:

- `line`
- `bar`
- `scatter`
- `area`
- `heatmap`
- `boxplot`

Current ML-relevant examples:

- `examples/training-curve/`
- `examples/confusion-matrix/`
- `examples/faceted-training/`
- `examples/boxplot/`
- `examples/embedding-scatter/`
- `examples/theme-samples/`
- `examples/custom-theme/`

The existing examples already cover a meaningful subset of ML paper figure needs, but the repository lacks a coherent ML-paper figure recipe layer. The current examples are individual demonstrations rather than a coverage-oriented catalog of common ML paper figures.

## 3. Vega / Vega-Lite Capability Survey

Vega-Lite already supports many figure primitives needed for ML conference papers:

| Figure need | Vega-Lite support level | VegaPaper status |
|---|---:|---|
| Line chart | High | Supported by `infer`; example exists |
| Multi-series line chart | High | Supported via `--color`; example exists |
| Confidence/error bands | High | Needs VegaPaper correction and better example |
| Bar chart | High | `infer` support exists; dedicated ML example missing |
| Grouped bar chart | High | Needs recipe/template |
| Histogram/density | High | Not supported by `infer`; template/example missing |
| Scatter/bubble plot | High | Basic scatter supported; richer recipes missing |
| Heatmap/table heatmap | High | Basic heatmap supported; score-table recipe missing |
| Heatmap with labels | High | Template/example missing |
| Boxplot | High | Supported; example exists |
| Faceting/small multiples | High | Basic `--facet` support exists; paper multipanel recipe missing |
| Repeat/concat multipanel figures | High | Template/example missing |
| Annotation/label overlays | High | Template/example missing |
| Regression/trend lines | High | Template/example missing |
| Likert/diverging stacked bars | High | Template/example missing |

Vega itself provides lower-level examples useful for figure types that are less natural in Vega-Lite:

| Figure need | Vega support level | VegaPaper status |
|---|---:|---|
| Violin plot | High | Vega fallback/template needed |
| Beeswarm plot | High | Vega fallback/template needed |
| Contour plot | High | Vega fallback/template needed |
| Parallel coordinates | High | Vega/Vega-Lite fallback/template needed |
| Network/tree diagrams | High | Out of current ML figure core scope |

Conclusion: the main gap is not Vega/Vega-Lite expressiveness. The gap is VegaPaper-level packaging: recipes, examples, templates, CLI options, lint rules, and docs that target ML paper figures directly.

## 4. Goals

### 4.1 Product Goals

1. Make VegaPaper feel immediately useful to ML researchers preparing conference figures.
2. Cover the most common experiment-section figure types from ML papers.
3. Preserve deterministic, reproducible artifact generation.
4. Keep the CLI constrained enough for reliable AI-agent use.
5. Provide examples that double as copy-paste recipes.
6. Avoid turning `infer` into an unbounded natural-language chart generator.

### 4.2 Figure Coverage Goals

The first complete ML figure catalog should cover:

1. Learning curves with shaded uncertainty.
2. Ablation grouped bars.
3. Benchmark leaderboard bars.
4. Model × task score heatmaps.
5. Embedding scatter plots.
6. Pareto frontier / trade-off scatter plots.
7. Scaling-law curves.
8. Distribution over seeds/runs.
9. Calibration / reliability diagrams.
10. Multi-panel paper figures.

### 4.3 Documentation Goals

Documentation should answer:

- Which figure should I use for my ML result?
- Can `vega-paper infer` generate it directly?
- If not, is there a template?
- What CSV schema is expected?
- Which lint profile and theme should I use?
- What artifacts should I commit with my paper?

## 5. Non-Goals

This spec does not propose:

- A new visualization grammar.
- A new ML evaluation methodology.
- An experiment tracking dashboard.
- Interactive visualization as a primary output.
- GUI editing.
- Full natural-language-to-chart generation.
- Replacing Vega, Vega-Lite, Altair, Matplotlib, TensorBoard, W&B, or MLflow.
- Guaranteeing that every possible ML paper figure can be generated from only three fields.

## 6. Design Principles

### 6.1 ML Paper Figure First

Every new recipe should correspond to a figure type that commonly appears in ML conference papers. Generic chart coverage is secondary.

Bad framing:

> Add histograms because Vega-Lite supports histograms.

Good framing:

> Add run-distribution histograms because ML papers often compare variation across seeds, tasks, or annotators.

### 6.2 Infer for Simple, Template for Structured

Use `infer` for charts that can be reliably specified by chart type and encodings. Use templates for structured figures that require layers, labels, baselines, annotations, computed fields, or multi-view layout.

| Use `infer` when | Use a template when |
|---|---|
| Chart has one primary mark | Chart needs multiple layers |
| Encoding can be described by `x`, `y`, `color`, `facet` | Figure needs baselines, labels, references, or annotations |
| CSV schema is simple | CSV schema has semantic roles beyond basic channels |
| Output is one view | Output is multi-panel or paper-layout aware |

### 6.3 Vega-Lite First, Vega Fallback

Prefer Vega-Lite when it can express the figure cleanly. Use raw Vega only for cases where Vega-Lite is awkward or insufficient, such as beeswarm, custom violin, dense contour, or highly customized layout.

### 6.4 Static Paper Output First

Default output should remain paper-ready static artifacts:

- `.vl.json` or `.vg.json`
- `.svg`
- `.pdf` when requested
- `.png` for README/slides
- `.meta.json`

Interactive examples may exist later, but they are not part of this spec.

### 6.5 Reproducibility by Default

Every rendered figure should remain reproducible from:

- source data,
- generated or template spec,
- CLI command,
- theme,
- Vega/Vega-Lite versions,
- output format,
- lint profile where applicable.

## 7. Proposed Feature Set

## 7.1 Correct Shaded Error Band Support

### Problem

The current `--error-band` path maps a symmetric error field to `encoding.yError` on a `line` mark. That produces error semantics, but not the shaded uncertainty band that ML researchers usually expect for learning curves.

### Desired Behavior

`--error-band` should generate a layered Vega-Lite spec consisting of:

1. an error band layer,
2. a line layer,
3. optional point markers if requested in a future extension.

### CLI

Current CLI should remain valid:

```bash
vega-paper infer examples/training-curve/data-with-error.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --error-band f1_se \
  --title "Training F1 with standard error" \
  --spec-out examples/training-curve/chart-error-band.vl.json
```

### Generated Spec Shape

For pre-aggregated center + symmetric error:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "url": "data-with-error.csv" },
  "width": 360,
  "height": 240,
  "layer": [
    {
      "mark": { "type": "errorband", "extent": "stderr", "opacity": 0.25 },
      "encoding": {
        "x": { "field": "epoch", "type": "quantitative" },
        "y": { "field": "f1", "type": "quantitative" },
        "yError": { "field": "f1_se", "type": "quantitative" },
        "color": { "field": "model", "type": "nominal" }
      }
    },
    {
      "mark": "line",
      "encoding": {
        "x": { "field": "epoch", "type": "quantitative" },
        "y": { "field": "f1", "type": "quantitative" },
        "color": { "field": "model", "type": "nominal" }
      }
    }
  ],
  "title": "Training F1 with standard error"
}
```

### Non-Line Charts

`--error-band` is currently accepted for `line`, `bar`, `scatter`, and `area` (only `heatmap`, `boxplot`, and `--aggregate` are rejected). The shaded-band fix applies to `--chart line` only:

- `line`: generate the layered `errorband` + `line` spec above.
- `bar`, `scatter`, `area`: keep the existing `yError` encoding unchanged in this fix. Whether these should later emit `errorbar` layers is deferred (see Open Questions).

### Future CLI Extension

Add explicit uncertainty semantics:

```bash
--error-band <field>
--error-band-type stderr|stdev|ci|iqr|custom
--error-band-low <field>
--error-band-high <field>
```

Interpretation:

| Option | Meaning |
|---|---|
| `--error-band field` | Symmetric uncertainty around `--y` |
| `--error-band-type stderr` | Default for ML learning curves |
| `--error-band-type stdev` | Band represents standard deviation |
| `--error-band-type ci` | Band represents confidence interval |
| `--error-band-low` / `--error-band-high` | Precomputed lower/upper fields |

### Acceptance Criteria

- `--error-band` produces a shaded band, not only `yError` on a line.
- Existing commands continue to work.
- `chart-error-band.vl.json` is regenerated.
- Gallery preview clearly shows a band.
- Docs explain the difference between error bars and error bands.
- Tests assert the generated spec uses `layer` and an `errorband` mark.

## 7.2 Add `examples/ablation-bar/`

### Purpose

Show component ablation or model-variant comparison, a frequent ML paper figure type.

### Data Schema

`data.csv`:

```csv
method,component,score,stderr
baseline,none,81.2,0.4
ours,no retrieval,83.1,0.3
ours,no reranking,84.0,0.2
ours,full,85.6,0.2
```

Alternative grouped schema:

```csv
dataset,method,score,stderr
MMLU,baseline,68.2,0.6
MMLU,ours,72.4,0.5
GSM8K,baseline,56.1,1.0
GSM8K,ours,61.8,0.9
```

### Example Commands

Simple ablation:

```bash
vega-paper infer examples/ablation-bar/data.csv \
  --chart bar \
  --x component \
  --y score \
  --color method \
  --title "Ablation study" \
  --width 420 \
  --height 240 \
  --spec-out examples/ablation-bar/chart.vl.json
```

Grouped benchmark bar:

```bash
vega-paper infer examples/ablation-bar/grouped.csv \
  --chart bar \
  --x dataset \
  --y score \
  --color method \
  --title "Accuracy by dataset" \
  --width 420 \
  --height 240 \
  --spec-out examples/ablation-bar/chart-grouped.vl.json
```

### Template Extension

A template should support:

- grouped bars,
- horizontal bars,
- sorted bars,
- value labels,
- optional error bars,
- optional baseline rule,
- optional highlight for best method.

### Acceptance Criteria

- Dedicated example folder exists.
- README explains ablation vs leaderboard use.
- Gallery image is committed.
- `chart-selection.md` no longer says bar has no dedicated example.

## 7.3 Add `examples/benchmark-heatmap/`

### Purpose

Show model × task or model × dataset score tables, common in ML and NLP papers.

### Data Schema

```csv
model,task,score
Baseline,MMLU,68.2
Baseline,GSM8K,56.1
Ours,MMLU,72.4
Ours,GSM8K,61.8
```

Optional fields:

```csv
model,task,score,rank,is_best
Ours,MMLU,72.4,1,true
```

### Desired Output

A heatmap with:

- rows = models,
- columns = tasks,
- color = score,
- text label = formatted score,
- optional bold/outline/highlight for best score per task,
- optional row/column sorting.

### Infer Path

Basic heatmap already works:

```bash
vega-paper infer examples/benchmark-heatmap/data.csv \
  --chart heatmap \
  --x task \
  --y model \
  --color score \
  --title "Benchmark results" \
  --width 420 \
  --height 240 \
  --spec-out examples/benchmark-heatmap/chart.vl.json
```

### Template Path

Add a template for text labels:

```bash
vega-paper template benchmark-heatmap examples/benchmark-heatmap/data.csv \
  --x task \
  --y model \
  --score score \
  --label score \
  --highlight-best \
  --theme paper-clean \
  --out examples/benchmark-heatmap/output.svg
```

### Acceptance Criteria

- Basic `infer` heatmap example exists.
- Labeled heatmap template exists or hand-written Vega-Lite spec is committed.
- README explains when to prefer heatmap over table.
- Example works for at least 4 models × 5 tasks.

## 7.4 Add `examples/pareto-frontier/`

### Purpose

Show trade-offs between quality and compute/resource metrics.

Common ML paper use cases:

- accuracy vs latency,
- score vs parameter count,
- loss vs FLOPs,
- quality vs cost,
- throughput vs memory.

### Data Schema

```csv
model,family,score,latency_ms,params_b
TinyLM,baseline,68.1,12,1.3
BaseLM,baseline,72.4,28,7.0
Ours-S,ours,73.0,18,3.0
Ours-L,ours,77.2,42,13.0
```

### Desired Output

- scatter or bubble plot,
- x = resource metric,
- y = score,
- color = family,
- size = parameter count where useful,
- label = model,
- optional Pareto frontier line,
- optional log scale on x,
- optional baseline reference region.

### Initial Implementation

Start as a template, not an `infer` chart type.

```bash
vega-paper template pareto-frontier examples/pareto-frontier/data.csv \
  --x latency_ms \
  --y score \
  --label model \
  --color family \
  --size params_b \
  --x-scale log \
  --frontier max-y-min-x \
  --theme paper-clean \
  --out examples/pareto-frontier/output.svg
```

### Acceptance Criteria

- Example folder includes raw CSV and spec/template output.
- README explains trade-off interpretation.
- Labels are readable for small example data.
- Lint warns if too many labels are requested.

## 7.5 Add `examples/scaling-law/`

### Purpose

Support scaling-law and compute-performance figures common in foundation-model papers.

### Data Schema

```csv
family,params_b,tokens_b,flops,loss,accuracy
baseline,1.3,300,1.2e20,2.81,61.2
baseline,7.0,1000,2.8e21,2.34,68.1
ours,3.0,500,7.0e20,2.42,69.3
ours,13.0,1200,5.4e21,2.11,74.8
```

### Desired Output

- log-scaled x-axis,
- loss or score on y-axis,
- multiple model families,
- optional fitted trend/regression line,
- optional annotation for regime changes,
- optional inverse y-axis for loss-style metrics should be explicitly controlled, not automatic.

### Initial CLI

Basic line path:

```bash
vega-paper infer examples/scaling-law/data.csv \
  --chart line \
  --x flops \
  --y loss \
  --color family \
  --title "Scaling behavior" \
  --width 420 \
  --height 260 \
  --spec-out examples/scaling-law/chart.vl.json
```

Template path:

```bash
vega-paper template scaling-law examples/scaling-law/data.csv \
  --x flops \
  --y loss \
  --color family \
  --x-scale log \
  --fit regression \
  --theme paper-clean \
  --out examples/scaling-law/output.svg
```

### Acceptance Criteria

- Example uses log scale.
- README explains score-vs-loss conventions.
- Template supports at least `--x-scale log`.
- Template output remains readable in a single-column paper width.

## 7.6 Add `examples/calibration-curve/`

### Purpose

Support reliability diagrams for classification, confidence estimation, and LLM calibration work.

### Data Schema

```csv
bin,confidence,accuracy,count
0,0.05,0.02,120
1,0.15,0.11,240
2,0.25,0.21,310
```

### Desired Output

- line or bar for accuracy by confidence bin,
- diagonal reference line,
- optional histogram/count subplot,
- optional ECE annotation,
- optional confidence interval band.

### Template CLI

```bash
vega-paper template calibration-curve examples/calibration-curve/data.csv \
  --confidence confidence \
  --accuracy accuracy \
  --count count \
  --ece 0.041 \
  --theme paper-clean \
  --out examples/calibration-curve/output.svg
```

### Acceptance Criteria

- Output includes diagonal `y=x` reference.
- Optional count panel can be enabled later.
- README explains expected pre-binning.
- Template does not compute calibration metrics in the first version.

## 7.7 Add `examples/run-distribution/`

### Purpose

Show variability over seeds, datasets, or runs.

Current `boxplot` example already addresses part of this. Extend with at least one of:

- histogram,
- density plot,
- strip plot,
- boxplot + raw points overlay.

### Data Schema

```csv
method,seed,score
baseline,1,80.1
baseline,2,79.4
ours,1,83.2
ours,2,84.0
```

### Implementation Options

Phase 1:

- Use existing boxplot support.
- Add `chart-with-points.vl.json` as hand-written Vega-Lite layered spec.

Phase 2:

- Add `--chart histogram` and possibly `--chart density` to `infer`.

### Acceptance Criteria

- Existing `boxplot` docs are reframed as seed/run distribution.
- At least one layered distribution example is committed.
- Docs explain when to prefer boxplot, histogram, or raw-point overlay.

## 7.8 Add `examples/multipanel-paper-figure/`

### Purpose

Support figure layouts such as Figure 2(a), Figure 2(b), Figure 2(c), which are common in conference papers.

### Desired Output

- horizontal or vertical concatenation,
- panel labels `(a)`, `(b)`, `(c)`,
- shared theme,
- optionally shared legend,
- short panel titles,
- dimensions appropriate for single-column or double-column layouts.

### Initial Approach

Start as hand-written Vega-Lite examples, not `infer`.

Potential panels:

1. learning curve,
2. ablation bar,
3. Pareto scatter.

### Future Template CLI

```bash
vega-paper template multipanel \
  --panel examples/training-curve/chart.vl.json:a:"Training" \
  --panel examples/ablation-bar/chart.vl.json:b:"Ablation" \
  --layout hconcat \
  --theme paper-clean \
  --out examples/multipanel-paper-figure/output.svg
```

### Acceptance Criteria

- Example produces a visually coherent multi-panel figure.
- README explains when to use facet vs concat vs separate files.
- Lint profile guidance includes single-column and double-column recommendations.

## 8. New Template System

## 8.1 Rationale

Some ML paper figures require more structure than `infer` should absorb. A template command avoids overloading `infer` while keeping workflows reproducible.

## 8.2 Proposed Command

```bash
vega-paper template <template-name> <data> [options]
```

Initial template names:

- `benchmark-heatmap`
- `pareto-frontier`
- `scaling-law`
- `calibration-curve`
- `multipanel`
- `leaderboard-bar` (covers the ablation/leaderboard bar template extension described in 7.2)

## 8.3 Template Output

A template command should write:

- a Vega-Lite or Vega spec,
- rendered output if `--out` is passed,
- a `.meta.json` sidecar,
- stdout lines matching existing `infer`/`render` style.

Example:

```text
Wrote examples/pareto-frontier/chart.vl.json
Wrote examples/pareto-frontier/output.svg
Wrote examples/pareto-frontier/output.meta.json
```

## 8.4 Template Metadata

Extend figure meta with:

```json
{
  "generatedBy": "vega-paper",
  "command": "template",
  "template": "pareto-frontier",
  "input": "examples/pareto-frontier/data.csv",
  "output": "examples/pareto-frontier/output.svg",
  "specOut": "examples/pareto-frontier/chart.vl.json",
  "theme": "paper-clean",
  "createdAt": "2026-07-08T00:00:00.000Z",
  "vegaVersion": "...",
  "vegaLiteVersion": "...",
  "options": {
    "x": "latency_ms",
    "y": "score",
    "label": "model",
    "color": "family"
  }
}
```

## 8.5 Template vs Infer Decision Table

| Figure type | `infer` | `template` | Raw Vega fallback |
|---|---:|---:|---:|
| Basic line | Yes | No | No |
| Learning curve with shaded band | Yes | Optional | No |
| Basic bar | Yes | No | No |
| Grouped ablation bar with labels/errors | Optional | Yes | No |
| Score heatmap | Yes | Yes for labels/best highlight | No |
| Embedding scatter | Yes | Optional for labels/contours | No |
| Pareto frontier | No | Yes | Maybe |
| Scaling law | Basic only | Yes | No |
| Calibration curve | No | Yes | No |
| Boxplot | Yes | Optional | No |
| Violin/beeswarm | No | Maybe | Yes |
| Multipanel figure | No | Yes | Maybe |

## 9. Documentation Updates

## 9.1 Replace or Extend Chart Selection

Current `chart-selection.md` should be extended from a generic chart guide into an ML paper figure guide.

New structure:

```markdown
# ML paper figure selection for VegaPaper

## Quick decision guide
## Direct infer recipes
## Template recipes
## Vega fallback recipes
## Common ML paper figure types
## Venue and layout notes
## Common mistakes
```

## 9.2 New Reference: `ml-paper-figure-recipes.md`

Create:

```text
skills/vega-paper/references/ml-paper-figure-recipes.md
```

Content:

- Learning curve recipe.
- Ablation bar recipe.
- Benchmark heatmap recipe.
- Embedding scatter recipe.
- Pareto frontier recipe.
- Scaling law recipe.
- Calibration curve recipe.
- Seed/run distribution recipe.
- Multi-panel recipe.

Each recipe should include:

- When to use.
- Expected CSV columns.
- Recommended CLI command.
- Recommended dimensions.
- Recommended lint profile.
- Common mistakes.
- Whether it is `infer`, `template`, or hand-written spec.

## 9.3 README Gallery Update

Current README gallery should be split into two sections:

1. Theme previews.
2. ML paper figure recipes.

The ML recipe gallery should include at least:

- learning curve with band,
- ablation bar,
- benchmark heatmap,
- embedding scatter,
- Pareto frontier,
- scaling law,
- calibration curve,
- run distribution,
- multi-panel paper figure.

## 9.4 Paper Style Guide Corrections

Update stale SVG-only language. Current behavior supports SVG, PNG, and PDF. The style guide should say:

- Use SVG as canonical editable/vector artifact where possible.
- Use PDF for LaTeX venues that prefer or require PDF figures.
- Use PNG for README, slides, and raster previews.
- Commit `.vl.json`/`.vg.json`, rendered vector output, source data or data-generation script, and `.meta.json`.

## 10. Lint Updates

## 10.1 New ML-Figure Lint Rules

Proposed warning rules:

| Rule ID | Applies to | Meaning | Suggested fix |
|---|---|---|---|
| `ml-too-many-series` | line/bar/scatter | Too many methods/series for a paper figure | Filter, facet, or group methods |
| `ml-missing-uncertainty` | learning curves / benchmark bars | Multiple seeds/runs are present but no uncertainty shown | Add error band/error bars or explain aggregation |
| `ml-crowded-labels` | labeled scatter/heatmap/bar | Too many text labels | Reduce labels or use top-k labels |
| `ml-missing-baseline` | ablation/leaderboard | Baseline field exists but no reference/highlight | Add baseline rule or label |
| `ml-unordered-ablation` | ablation bars | Components are alphabetically sorted by default | Add explicit sort/order column |
| `ml-log-scale-candidate` | scaling/Pareto | x spans multiple orders of magnitude | Consider `--x-scale log` |
| `ml-panel-label-missing` | multipanel | Multi-view figure lacks panel labels | Add `(a)`, `(b)`, `(c)` labels |

## 10.2 Profiles

Do not add a separate `ml` lint profile initially. Keep existing profiles:

- `paper`
- `acl`
- `print`
- `web`

Add ML-specific rules as optional warnings under `paper` and `acl`, or gate them behind:

```bash
--lint-domain ml
```

Potential syntax:

```bash
vega-paper lint chart.vl.json --profile paper --domain ml
```

This avoids making default lint too opinionated for non-ML charts.

## 10.3 Data Availability Constraint

`lint` currently analyzes the spec only. Specs generated by `infer` reference data via `data.url`, so lint sees no rows; inline `data.values` is only present in hand-written specs. This constrains the rule table in 10.1:

- Spec-only rules (implementable now): `ml-panel-label-missing`, `ml-crowded-labels` (when labels are encoded), `ml-missing-baseline` (when the spec encodes a baseline field but no rule layer).
- Data-dependent rules (`ml-too-many-series`, `ml-missing-uncertainty`, `ml-log-scale-candidate`, `ml-unordered-ablation`) require lint to resolve `data.url` relative to the spec file, or a new `--data` option. This data-loading capability must land before or with these rules.

Phase E should implement spec-only rules first and gate data-dependent rules on lint data loading.

## 11. Example Directory Layout

Proposed final structure for ML recipe examples. Existing non-recipe directories (`basic-line/`, `confusion-matrix/`, `theme-samples/`, `custom-theme/`) remain unchanged and are omitted below. `examples/boxplot/` is kept as-is; `run-distribution/` is a new example that builds on it and cross-links rather than replacing it.

```text
examples/
  ablation-bar/
    README.md
    data.csv
    grouped.csv
    chart.vl.json
    chart-grouped.vl.json

  benchmark-heatmap/
    README.md
    data.csv
    chart.vl.json
    chart-labeled.vl.json

  calibration-curve/
    README.md
    data.csv
    chart.vl.json

  embedding-scatter/
    README.md
    data.csv
    chart.vl.json

  faceted-training/
    README.md
    data.csv
    chart.vl.json

  multipanel-paper-figure/
    README.md
    data.csv
    chart.vl.json

  pareto-frontier/
    README.md
    data.csv
    chart.vl.json

  run-distribution/
    README.md
    data.csv
    chart-boxplot.vl.json
    chart-points.vl.json

  scaling-law/
    README.md
    data.csv
    chart.vl.json

  training-curve/
    README.md
    data.csv
    runs.csv
    data-with-error.csv
    chart.vl.json
    chart-aggregate.vl.json
    chart-error-band.vl.json
```

## 12. Implementation Plan

## Phase A: Correctness and Documentation

1. Fix `--error-band` to generate shaded band layers.
2. Regenerate training curve specs and gallery images.
3. Update tests for error-band spec shape.
4. Update `paper-style-guide.md` to reflect SVG/PNG/PDF support.
5. Update `chart-selection.md` to remove stale note about missing bar/area examples once examples are added.

## Phase B: Basic ML Figure Examples

1. Add `examples/ablation-bar/`.
2. Add `examples/benchmark-heatmap/`.
3. Add `examples/run-distribution/`.
4. Update examples README gallery.
5. Add gallery PNGs.

## Phase C: Structured ML Templates

1. Add initial `template` command skeleton.
2. Add `benchmark-heatmap` template.
3. Add `pareto-frontier` template.
4. Add `scaling-law` template.
5. Add `calibration-curve` template.
6. Add template metadata support.

## Phase D: Multi-Panel and Advanced Recipes

1. Add `multipanel-paper-figure` example.
2. Add shared sizing/layout guidance.
3. Add panel label conventions.
4. Add optional `multipanel` template.

## Phase E: ML-Aware Linting

1. Add `--domain ml` option or equivalent.
2. Implement spec-only rules first: `ml-panel-label-missing`, `ml-crowded-labels`.
3. Add lint data loading (resolve `data.url` or `--data` option; see 10.3).
4. Implement data-dependent rules: `ml-too-many-series`, `ml-log-scale-candidate`.
5. Document warnings and fixes.

## 13. Testing Requirements

### Unit Tests

- `infer` produces layered `errorband` specs.
- `--error-band` rejects unsupported chart types as before.
- Template option parsing validates required fields.
- Template metadata includes `command: "template"` and template name.
- Lint domain options parse correctly.

### Integration Tests

- Each example README command runs successfully.
- `bun run infer:examples` regenerates all infer-based examples.
- `bun run render:gallery` includes new gallery assets.
- `vega-paper lint` passes or emits documented warnings.
- `doctor` remains unchanged.

### Visual Regression / Snapshot Tests

At minimum:

- Assert committed PNG gallery files exist.
- Assert generated specs contain expected top-level structures.
- Optional future: pixel/image diff with tolerance for gallery outputs.

## 14. Acceptance Criteria for This Spec

The work described here is complete when:

1. VegaPaper can generate a shaded learning curve with uncertainty.
2. The examples catalog covers at least six common ML paper figure types beyond theme previews.
3. README and examples README show ML paper figure recipe galleries.
4. A researcher can copy-paste commands for learning curve, ablation, heatmap, embedding scatter, and run distribution figures.
5. At least one structured template exists for a figure that would be awkward as basic `infer`.
6. Docs clearly separate `infer`, `template`, and hand-written Vega-Lite/Vega workflows.
7. Figure metadata continues to be written for rendered outputs.
8. Paper-style documentation no longer contradicts current SVG/PNG/PDF support.

## 15. Open Questions

1. Should `template` be a new top-level command or a submode of `infer`?
2. Should uncertainty support use `--error-band-type` immediately, or defer until after the shaded-band fix?
3. Should `histogram` and `density` become first-class `infer` chart types?
4. How much semantic computation should templates perform, such as Pareto frontier calculation or ECE calculation?
5. Should ML-specific lint rules be default under `paper`, or opt-in via `--domain ml`?
6. Should examples use synthetic data only, or include small real benchmark-like public datasets?
7. Should multipanel composition operate on existing specs, raw data, or both?
8. Should `--error-band` on `bar`/`scatter`/`area` eventually emit layered `errorbar` marks, keep plain `yError`, or be rejected?
9. Should lint learn to load `data.url` CSVs by default, or only via an explicit `--data` option?

## 16. Recommended First Pull Request

The first PR should be small and high-impact:

Title:

```text
Fix shaded error bands and add ablation bar example
```

Scope:

1. Change `--error-band` generation from line + `yError` to layered `errorband` + `line`.
2. Update tests.
3. Regenerate `examples/training-curve/chart-error-band.vl.json`.
4. Add `examples/ablation-bar/`.
5. Update `examples/README.md` and gallery.
6. Update `chart-selection.md`.

Why first:

- It fixes a semantic mismatch in an existing feature.
- It adds the most obvious missing ML paper figure example.
- It improves the README story without introducing the full template system yet.

## 17. Reference Links

- Vega-Lite Example Gallery: https://vega.github.io/vega-lite/examples/
- Vega Example Gallery: https://vega.github.io/vega/examples/
- Vega-Lite Error Band Documentation: https://vega.github.io/vega-lite/docs/errorband.html
