# Embedding Scatter Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `examples/embedding-scatter/` demonstrating `infer --chart scatter` for 2D embeddings (t-SNE/UMAP) with synthetic CSV and docs integration.

**Architecture:** Example-only slice — no CLI changes. Commit synthetic `data.csv`, run `infer:embedding-scatter` to produce `chart.vl.json`, document with README, wire into `infer:examples` and `examples.test.ts`.

**Tech Stack:** VegaPaper `infer`/`render`, Bun tests, existing example patterns

**Spec:** [docs/superpowers/specs/2026-06-05-vega-paper-embedding-scatter-example-design.md](../specs/2026-06-05-vega-paper-embedding-scatter-example-design.md)

---

## File map

| File | Action |
|------|--------|
| `examples/embedding-scatter/data.csv` | Create — synthetic clusters |
| `examples/embedding-scatter/chart.vl.json` | Create — via infer |
| `examples/embedding-scatter/README.md` | Create |
| `examples/README.md` | Modify — folder table |
| `skills/vega-paper/references/chart-selection.md` | Modify — examples table |
| `package.json` | Modify — `infer:embedding-scatter`, extend `infer:examples` |
| `packages/cli/test/examples.test.ts` | Modify — scatter smoke test |

---

### Task 1: Synthetic data CSV

**Files:**
- Create: `examples/embedding-scatter/data.csv`

- [ ] **Step 1: Create `data.csv` with header `x,y,label`**

Four clusters, ~25 points each (~100 rows). Example cluster centers (adjust for visual separation):

| label | center (x, y) |
|-------|----------------|
| `class_a` | (-2.0, -1.5) |
| `class_b` | (2.0, -1.0) |
| `class_c` | (-1.0, 2.0) |
| `class_d` | (2.5, 2.0) |

Per point: `center + random offset` in roughly ±0.6 on each axis (hand-edit or one-off Bun one-liner). Values rounded to 2–3 decimal places.

Minimal starter (expand to ~25 rows per class):

```csv
x,y,label
-2.1,-1.4,class_a
-1.8,-1.7,class_a
...
```

- [ ] **Step 2: Verify row count**

Run: `wc -l examples/embedding-scatter/data.csv`  
Expected: 101 lines (1 header + ~100 data rows)

- [ ] **Step 3: Commit**

```bash
git add examples/embedding-scatter/data.csv
git commit -m "feat(examples): add synthetic embedding scatter dataset"
```

---

### Task 2: Generate and commit spec

**Files:**
- Create: `examples/embedding-scatter/chart.vl.json`
- Modify: `package.json`

- [ ] **Step 1: Add script to `package.json`**

After `infer:boxplot-by-split` line, add:

```json
"infer:embedding-scatter": "bun run packages/cli/src/index.ts infer examples/embedding-scatter/data.csv --chart scatter --x x --y y --color label --title \"Embedding (2D)\" --width 360 --height 360 --spec-out examples/embedding-scatter/chart.vl.json",
```

Update `infer:examples` to append `&& bun run infer:embedding-scatter` at the end.

- [ ] **Step 2: Run infer**

Run: `bun run infer:embedding-scatter`  
Expected: writes `examples/embedding-scatter/chart.vl.json`

- [ ] **Step 3: Spot-check spec**

Run: `bun -e "const s=await Bun.file('examples/embedding-scatter/chart.vl.json').json(); console.log(s.mark, s.encoding?.color?.field)"`  
Expected: `point label` (mark may be string `"point"`)

- [ ] **Step 4: Commit**

```bash
git add package.json examples/embedding-scatter/chart.vl.json
git commit -m "feat(examples): add infer script and embedding scatter spec"
```

---

### Task 3: README and index docs

**Files:**
- Create: `examples/embedding-scatter/README.md`
- Modify: `examples/README.md`
- Modify: `skills/vega-paper/references/chart-selection.md`

- [ ] **Step 1: Create `examples/embedding-scatter/README.md`**

```markdown
# Embedding scatter (infer)

Synthetic 2D embedding points for ML paper figures (t-SNE, UMAP, PCA projection). CSV columns: `x`, `y`, `label`.

## Scatter with class color

```bash
vega-paper infer examples/embedding-scatter/data.csv \
  --chart scatter \
  --x x \
  --y y \
  --color label \
  --title "Embedding (2D)" \
  --width 360 \
  --height 360 \
  --spec-out examples/embedding-scatter/chart.vl.json
```

## Render

```bash
vega-paper render examples/embedding-scatter/chart.vl.json \
  --theme paper-clean \
  --format svg \
  --out examples/embedding-scatter/output.svg
```

## Lint

```bash
vega-paper lint examples/embedding-scatter/chart.vl.json --profile paper
```

## Use your own embeddings

Export a CSV with two numeric columns and a label column, then adjust field names:

```bash
vega-paper infer your-embeddings.csv \
  --chart scatter \
  --x umap_1 --y umap_2 --color label \
  --title "UMAP embedding" \
  --width 360 --height 360 \
  --spec-out figures/umap.vl.json
```

Very large point counts (10k+) may need downsampling before render.

Committed `chart.vl.json` is regenerated with `bun run infer:embedding-scatter` from the repo root. `output.svg` is local only.
```

- [ ] **Step 2: `examples/README.md` — add table row**

After boxplot row:

```markdown
| [embedding-scatter/](embedding-scatter/) | `infer` scatter; 2D embedding with `--color` |
```

- [ ] **Step 3: `chart-selection.md` — add to Examples table**

After boxplot row:

```markdown
| [embedding-scatter/](../../../examples/embedding-scatter/) | `scatter` | `--color` for class/cluster labels |
```

Remove or soften the line "There is no dedicated `examples/` folder for `bar`, `scatter`, or `area` yet" — scatter now has an example; bar/area still lack folders.

Replace with:

```markdown
There is no dedicated `examples/` folder for `bar` or `area` yet; `scatter` is covered by [embedding-scatter/](../../../examples/embedding-scatter/).
```

- [ ] **Step 4: Commit**

```bash
git add examples/embedding-scatter/README.md examples/README.md skills/vega-paper/references/chart-selection.md
git commit -m "docs(examples): document embedding scatter workflow"
```

---

### Task 4: Test and verify

**Files:**
- Modify: `packages/cli/test/examples.test.ts`

- [ ] **Step 1: Add test**

After boxplot tests:

```ts
  test("embedding-scatter chart is a point plot colored by label", async () => {
    const spec = await readExampleSpec("examples/embedding-scatter/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("point");
    expect(spec.encoding).toMatchObject({
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
      color: { field: "label", type: "nominal" },
    });
    expect(spec.width).toBe(360);
    expect(spec.height).toBe(360);
  });
```

- [ ] **Step 2: Run tests**

Run: `bun test packages/cli/test/examples.test.ts`  
Expected: PASS

- [ ] **Step 3: Optional render smoke**

Run: `vega-paper render examples/embedding-scatter/chart.vl.json --theme paper-clean --format svg --out /tmp/embedding-scatter.svg`  
Expected: SVG contains point marks (not empty axes)

- [ ] **Step 4: Full verify**

Run: `bun run check && bun test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/test/examples.test.ts
git commit -m "test(examples): assert embedding scatter spec shape"
```

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| `examples/embedding-scatter/` | 1–3 |
| Synthetic CSV x,y,label | 1 |
| infer scatter + color | 2 |
| README vega-paper commands | 3 |
| examples index + chart-selection | 3 |
| infer:embedding-scatter + infer:examples | 2 |
| examples.test.ts | 4 |
| No CLI changes | — |
| No gallery PNG | — (out of scope) |

## Out of scope

- `render:gallery` PNG
- Facet variant
- v0.1.5 release (unless requested separately)
