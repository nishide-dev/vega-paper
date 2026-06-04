# README Figure Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit PNG figure previews under `docs/assets/gallery/` and embed theme + example grids in README files.

**Architecture:** Add `scripts/render-gallery.ts` mirroring `render-theme-samples.ts` but outputting PNG at scale 2 into `docs/assets/gallery/`. Update root and examples README with relative `<img>` paths. Local `output.svg` / theme-samples gitignore unchanged.

**Tech Stack:** Bun, existing `vega-paper render --format png`, `listThemes()` from `@vega-paper/themes`.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-readme-gallery-design.md](../specs/2026-06-04-vega-paper-readme-gallery-design.md)

---

## File map

| File | Action |
|------|--------|
| `scripts/render-gallery.ts` | Create — batch PNG renderer |
| `scripts/render-gallery.test.ts` | Create — manifest / path smoke test |
| `package.json` | Modify — add `render:gallery` script |
| `docs/assets/gallery/themes/*.png` | Create — 8 files |
| `docs/assets/gallery/examples/*.png` | Create — 6 files |
| `README.md` | Modify — theme preview section |
| `examples/README.md` | Modify — example gallery section |
| `examples/theme-samples/README.md` | Modify — point to committed gallery |
| `docs/palettes.md` | Modify — link to gallery |
| `docs/roadmap.md` | Modify — mark 4d Done |

---

### Task 1: `render-gallery` script

**Files:**
- Create: `scripts/render-gallery.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/render-gallery.ts`**

```ts
#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { listThemes } from "../packages/themes/src/index.ts";

const CLI = ["bun", "run", "packages/cli/src/index.ts"];
const SCALE = "2";
const GALLERY = "docs/assets/gallery";

type GalleryJob = {
  spec: string;
  theme: string;
  out: string;
};

const exampleJobs: GalleryJob[] = [
  {
    spec: "examples/basic-line/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/basic-line.png`,
  },
  {
    spec: "examples/training-curve/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/training-curve.png`,
  },
  {
    spec: "examples/confusion-matrix/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/confusion-matrix.png`,
  },
  {
    spec: "examples/faceted-training/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/faceted-training.png`,
  },
  {
    spec: "examples/boxplot/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/boxplot.png`,
  },
  {
    spec: "examples/custom-theme/chart.vl.json",
    theme: "examples/custom-theme/theme.json",
    out: `${GALLERY}/examples/custom-theme.png`,
  },
];

async function renderJob(job: GalleryJob): Promise<void> {
  await mkdir(dirname(job.out), { recursive: true });
  console.log(`Rendering ${job.theme} -> ${job.out}`);

  const proc = Bun.spawn(
    [
      ...CLI,
      "render",
      job.spec,
      "--theme",
      job.theme,
      "--format",
      "png",
      "--scale",
      SCALE,
      "--out",
      job.out,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );

  if ((await proc.exited) !== 0) {
    throw new Error(`Render failed: ${job.out}`);
  }
}

const themeJobs: GalleryJob[] = listThemes().map((theme) => ({
  spec: "examples/basic-line/chart.vl.json",
  theme: theme.name,
  out: `${GALLERY}/themes/${theme.name}.png`,
}));

for (const job of [...themeJobs, ...exampleJobs]) {
  await renderJob(job);
}
```

- [ ] **Step 2: Add npm script to `package.json`**

After `"render:theme-samples"` line, add:

```json
"render:gallery": "bun scripts/render-gallery.ts",
```

- [ ] **Step 3: Run script (requires Vega PNG toolchain / doctor passing)**

Run: `bun run render:gallery`  
Expected: 14 PNG files under `docs/assets/gallery/`

- [ ] **Step 4: Commit**

```bash
git add scripts/render-gallery.ts package.json docs/assets/gallery
git commit -m "feat: add render-gallery script and commit README preview PNGs"
```

---

### Task 2: Gallery manifest test

**Files:**
- Create: `scripts/render-gallery.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { listThemes } from "../packages/themes/src/index.ts";

const GALLERY = "docs/assets/gallery";

const EXAMPLE_PREVIEWS = [
  "basic-line",
  "training-curve",
  "confusion-matrix",
  "faceted-training",
  "boxplot",
  "custom-theme",
];

describe("readme gallery assets", () => {
  test("theme PNGs exist for every built-in theme", () => {
    for (const theme of listThemes()) {
      expect(existsSync(`${GALLERY}/themes/${theme.name}.png`)).toBe(true);
    }
  });

  test("example PNGs exist", () => {
    for (const name of EXAMPLE_PREVIEWS) {
      expect(existsSync(`${GALLERY}/examples/${name}.png`)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test**

Run: `bun test scripts/render-gallery.test.ts`  
Expected: PASS (14 files)

- [ ] **Step 3: Commit**

```bash
git add scripts/render-gallery.test.ts
git commit -m "test: assert committed README gallery PNGs exist"
```

---

### Task 3: README and docs

**Files:**
- Modify: `README.md`
- Modify: `examples/README.md`
- Modify: `examples/theme-samples/README.md`
- Modify: `docs/palettes.md`

- [ ] **Step 1: Root `README.md` — add after Quick start section**

```markdown
## Figure previews

Same [basic-line](examples/basic-line/chart.vl.json) spec with every built-in theme (`--format png --scale 2`). Palette sources: [docs/palettes.md](docs/palettes.md).

| | | | |
|:---:|:---:|:---:|:---:|
| ![paper-clean](docs/assets/gallery/themes/paper-clean.png) | ![acl-clean](docs/assets/gallery/themes/acl-clean.png) | ![neurips-clean](docs/assets/gallery/themes/neurips-clean.png) | ![nature-soft](docs/assets/gallery/themes/nature-soft.png) |
| `paper-clean` | `acl-clean` | `neurips-clean` | `nature-soft` |
| ![shadcn-light](docs/assets/gallery/themes/shadcn-light.png) | ![shadcn-dark](docs/assets/gallery/themes/shadcn-dark.png) | ![monochrome-print](docs/assets/gallery/themes/monochrome-print.png) | ![poster-dark](docs/assets/gallery/themes/poster-dark.png) |
| `shadcn-light` | `shadcn-dark` | `monochrome-print` | `poster-dark` |

Regenerate: `bun run render:gallery`
```

- [ ] **Step 2: `examples/README.md` — add Gallery section after folder table**

```markdown
## Gallery

Committed PNG previews (`paper-clean` unless noted). Theme comparison: [root README](../README.md#figure-previews).

| Example | Preview |
|---------|---------|
| [basic-line/](basic-line/) | ![basic-line](../docs/assets/gallery/examples/basic-line.png) |
| [training-curve/](training-curve/) | ![training-curve](../docs/assets/gallery/examples/training-curve.png) |
| [confusion-matrix/](confusion-matrix/) | ![confusion-matrix](../docs/assets/gallery/examples/confusion-matrix.png) |
| [faceted-training/](faceted-training/) | ![faceted-training](../docs/assets/gallery/examples/faceted-training.png) |
| [boxplot/](boxplot/) | ![boxplot](../docs/assets/gallery/examples/boxplot.png) |
| [custom-theme/](custom-theme/) | ![custom-theme](../docs/assets/gallery/examples/custom-theme.png) |

Regenerate: `bun run render:gallery`
```

- [ ] **Step 3: `examples/theme-samples/README.md` — replace intro paragraph**

Committed theme PNGs for README live under [`docs/assets/gallery/themes/`](../../docs/assets/gallery/themes/). This folder is for **local SVG** comparison via `bun run render:theme-samples` (gitignored).

- [ ] **Step 4: `docs/palettes.md` — add after first paragraph**

Visual comparison: see the [theme grid in the root README](../README.md#figure-previews) or PNG files under [`docs/assets/gallery/themes/`](./assets/gallery/themes/).

- [ ] **Step 5: Commit**

```bash
git add README.md examples/README.md examples/theme-samples/README.md docs/palettes.md
git commit -m "docs: embed figure gallery in README and examples index"
```

---

### Task 4: Roadmap and verify

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark Phase 4d Done in roadmap table and section**

- [ ] **Step 2: Full verify**

Run: `bun run check && bun run typecheck && bun test scripts/render-gallery.test.ts`

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark Phase 4d README gallery done"
```

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| PNG under `docs/assets/gallery/` | Task 1 |
| 8 theme + 6 example PNGs | Task 1 |
| `render:gallery` script | Task 1 |
| Root README theme grid | Task 3 |
| examples README gallery | Task 3 |
| theme-samples README update | Task 3 |
| palettes.md link | Task 3 |
| gitignore unchanged for output.svg | — (no change) |
| Optional existence test | Task 2 |

## Out of scope

- CI gallery diff gate (Phase 4d-2)
- v0.1.4 release tag (separate release when requested)
