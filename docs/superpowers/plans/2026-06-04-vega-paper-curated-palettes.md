# Curated Design Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad hoc built-in series colors with four attributed curated palettes (Carbon, FT, Catppuccin Latte/Mocha) and expose palette metadata via themes CLI.

**Architecture:** Add a palette registry under `packages/themes/src/palettes/` with typed attribution metadata. Built-in theme files import palette colors at definition time and declare `paletteId`. CLI `themes show` prints palette source; docs and regenerated `theme-samples` serve as the visual baseline for v0.2.0.

**Tech Stack:** Bun, TypeScript, `@vega-paper/themes`, existing CLI `themes` command.

**Spec:** [docs/superpowers/specs/2026-06-04-vega-paper-curated-palettes-design.md](../specs/2026-06-04-vega-paper-curated-palettes-design.md)

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/themes/src/palettes/types.ts` | Create | `VegaPaperPalette`, attribution types |
| `packages/themes/src/palettes/carbon-categorical.ts` | Create | Carbon 6-color definition |
| `packages/themes/src/palettes/ft-line-web.ts` | Create | FT lineWeb 6-color definition |
| `packages/themes/src/palettes/catppuccin-latte.ts` | Create | Catppuccin Latte accents |
| `packages/themes/src/palettes/catppuccin-mocha.ts` | Create | Catppuccin Mocha accents |
| `packages/themes/src/palettes/registry.ts` | Create | `listPalettes`, `getPalette` |
| `packages/themes/src/palettes/apply-palette.ts` | Create | `categoryRange(paletteId)` helper |
| `packages/themes/test/palettes.test.ts` | Create | Snapshot hex + registry errors |
| `packages/themes/src/registry.ts` | Modify | Add optional `paletteId` to `VegaPaperTheme` |
| `packages/themes/src/paper-clean.ts` … `poster-dark.ts` | Modify | Wire palette colors + `paletteId` |
| `packages/themes/src/monochrome-print.ts` | Unchanged | Grayscale series |
| `packages/themes/test/themes.test.ts` | Modify | Update expected first category hex |
| `packages/themes/src/index.ts` | Modify | Export palette API |
| `packages/cli/src/commands/themes.ts` | Modify | Show palette attribution in `themes show` |
| `packages/cli/test/themes-command.test.ts` | Modify | Assert palette fields in output |
| `docs/palettes.md` | Create | Palette catalog + theme mapping |
| `skills/vega-paper/references/theme-catalog.md` | Modify | Palette source column |
| `examples/theme-samples/*.svg` | Regenerate | Visual baseline |
| `docs/roadmap.md` | Modify | Mark 4c Done when complete |
| `docs/releases/v0.2.0.md` | Create | Release notes stub |

---

### Task 1: Palette types and registry

**Files:**
- Create: `packages/themes/src/palettes/types.ts`
- Create: `packages/themes/src/palettes/carbon-categorical.ts`
- Create: `packages/themes/src/palettes/ft-line-web.ts`
- Create: `packages/themes/src/palettes/catppuccin-latte.ts`
- Create: `packages/themes/src/palettes/catppuccin-mocha.ts`
- Create: `packages/themes/src/palettes/registry.ts`
- Create: `packages/themes/src/palettes/apply-palette.ts`
- Create: `packages/themes/test/palettes.test.ts`

- [ ] **Step 1: Write failing palette registry tests**

```ts
// packages/themes/test/palettes.test.ts
import { describe, expect, test } from "bun:test";
import { getPalette, listPalettes } from "../src/palettes/registry";

describe("palette registry", () => {
  test("lists four palettes in stable order", () => {
    expect(listPalettes().map((palette) => palette.id)).toEqual([
      "carbon-categorical",
      "ft-line-web",
      "catppuccin-latte",
      "catppuccin-mocha",
    ]);
  });

  test("carbon-categorical colors match spec", () => {
    expect(getPalette("carbon-categorical").colors).toEqual([
      "#6929C4",
      "#1192E8",
      "#005D5D",
      "#9F1853",
      "#FA4D56",
      "#198038",
    ]);
  });

  test("ft-line-web colors match spec", () => {
    expect(getPalette("ft-line-web").colors).toEqual([
      "#0F5499",
      "#EB5E8D",
      "#70DCE6",
      "#9DBF57",
      "#208FCE",
      "#7F062E",
    ]);
  });

  test("catppuccin-latte colors match spec", () => {
    expect(getPalette("catppuccin-latte").colors).toEqual([
      "#1E66F5",
      "#179299",
      "#FE640B",
      "#8839EF",
      "#40A02B",
      "#D20F39",
    ]);
  });

  test("catppuccin-mocha colors match spec", () => {
    expect(getPalette("catppuccin-mocha").colors).toEqual([
      "#89B4FA",
      "#94E2D5",
      "#FAB387",
      "#CBA6F7",
      "#A6E3A1",
      "#F38BA8",
    ]);
  });

  test("rejects unknown palette id", () => {
    expect(() => getPalette("missing-palette")).toThrow('Unknown palette "missing-palette"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/themes/test/palettes.test.ts`  
Expected: FAIL — module `../src/palettes/registry` not found

- [ ] **Step 3: Implement palette modules**

```ts
// packages/themes/src/palettes/types.ts
export type PaletteSourceKind = "product-media" | "curated-design";

export type PaletteAttribution = {
  name: string;
  url: string;
  license?: string;
};

export type VegaPaperPalette = {
  id: string;
  displayName: string;
  sourceKind: PaletteSourceKind;
  attribution: PaletteAttribution;
  colors: [string, string, string, string, string, string];
  selectionNotes: string;
};
```

```ts
// packages/themes/src/palettes/carbon-categorical.ts
import type { VegaPaperPalette } from "./types";

export const carbonCategorical: VegaPaperPalette = {
  id: "carbon-categorical",
  displayName: "Carbon Categorical",
  sourceKind: "product-media",
  attribution: {
    name: "IBM Carbon Design System",
    url: "https://carbondesignsystem.com/data-visualization/color-palettes/",
  },
  colors: ["#6929C4", "#1192E8", "#005D5D", "#9F1853", "#FA4D56", "#198038"],
  selectionNotes:
    "First six colors of Carbon categorical sequence (Purple 70 through Green 60; skips Red 90).",
};
```

Implement `ft-line-web.ts`, `catppuccin-latte.ts`, `catppuccin-mocha.ts` with the exact hex values from the spec and attribution URLs documented there.

```ts
// packages/themes/src/palettes/registry.ts
import { carbonCategorical } from "./carbon-categorical";
import { catppuccinLatte } from "./catppuccin-latte";
import { catppuccinMocha } from "./catppuccin-mocha";
import { ftLineWeb } from "./ft-line-web";
import type { VegaPaperPalette } from "./types";

const palettes = [carbonCategorical, ftLineWeb, catppuccinLatte, catppuccinMocha] as const;

export function listPalettes(): VegaPaperPalette[] {
  return palettes.map(clonePalette);
}

export function getPalette(id: string): VegaPaperPalette {
  const palette = palettes.find((candidate) => candidate.id === id);
  if (!palette) {
    throw new Error(`Unknown palette "${id}"`);
  }
  return clonePalette(palette);
}

function clonePalette(palette: VegaPaperPalette): VegaPaperPalette {
  return structuredClone(palette);
}
```

```ts
// packages/themes/src/palettes/apply-palette.ts
import { getPalette } from "./registry";

export function categoryRangeFromPalette(paletteId: string): string[] {
  return [...getPalette(paletteId).colors];
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/themes/test/palettes.test.ts`  
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/themes/src/palettes packages/themes/test/palettes.test.ts
git commit -m "feat(themes): add curated palette registry with Carbon, FT, and Catppuccin"
```

---

### Task 2: Wire palettes into built-in themes

**Files:**
- Modify: `packages/themes/src/registry.ts`
- Modify: `packages/themes/src/paper-clean.ts`
- Modify: `packages/themes/src/acl-clean.ts`
- Modify: `packages/themes/src/neurips-clean.ts`
- Modify: `packages/themes/src/nature-soft.ts`
- Modify: `packages/themes/src/shadcn-light.ts`
- Modify: `packages/themes/src/shadcn-dark.ts`
- Modify: `packages/themes/src/poster-dark.ts`
- Modify: `packages/themes/test/themes.test.ts`
- Modify: `packages/themes/src/index.ts`

- [ ] **Step 1: Extend VegaPaperTheme and update failing test expectation**

In `registry.ts`, add optional field:

```ts
import type { PaletteAttribution } from "./palettes/types";

export interface VegaPaperTheme {
  name: string;
  displayName: string;
  description: string;
  target: VegaPaperThemeTarget;
  mode: VegaPaperThemeMode;
  paletteId?: string;
  paletteAttribution?: PaletteAttribution;
  config: Record<string, unknown>;
}
```

Update `themes.test.ts` mutation test — first category color for `paper-clean` becomes `#6929C4`:

```ts
expect(freshTheme.config.range.category[0]).toBe("#6929C4");
```

Add test:

```ts
test("paper-clean references carbon-categorical palette", () => {
  const theme = getTheme("paper-clean");
  expect(theme.paletteId).toBe("carbon-categorical");
  expect(theme.paletteAttribution?.name).toContain("Carbon");
});
```

- [ ] **Step 2: Update theme files**

Example for `paper-clean.ts`:

```ts
import { categoryRangeFromPalette } from "./palettes/apply-palette";
import { getPalette } from "./palettes/registry";
import type { VegaPaperTheme } from "./registry";

const palette = getPalette("carbon-categorical");

export const paperClean: VegaPaperTheme = {
  name: "paper-clean",
  displayName: "Paper Clean",
  description: "General publication-ready theme with restrained grids and readable labels.",
  target: "paper",
  mode: "light",
  paletteId: palette.id,
  paletteAttribution: palette.attribution,
  config: {
    // ... existing axis/view/font keys unchanged ...
    range: {
      category: categoryRangeFromPalette("carbon-categorical"),
    },
  },
};
```

Apply mapping from spec:

| Theme file | `paletteId` |
|------------|-------------|
| `paper-clean.ts`, `acl-clean.ts` | `carbon-categorical` |
| `neurips-clean.ts`, `nature-soft.ts` | `ft-line-web` |
| `shadcn-light.ts` | `catppuccin-latte` |
| `shadcn-dark.ts`, `poster-dark.ts` | `catppuccin-mocha` |

Do **not** change `monochrome-print.ts`.

- [ ] **Step 3: Export palette API from index**

```ts
export type { PaletteAttribution, PaletteSourceKind, VegaPaperPalette } from "./palettes/types";
export { getPalette, listPalettes } from "./palettes/registry";
```

- [ ] **Step 4: Run theme tests**

Run: `bun test packages/themes/test/themes.test.ts packages/themes/test/palettes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/themes/src packages/themes/test/themes.test.ts
git commit -m "feat(themes): wire built-in themes to curated palette registry"
```

---

### Task 3: CLI `themes show` palette attribution

**Files:**
- Modify: `packages/cli/src/commands/themes.ts`
- Modify: `packages/cli/test/themes-command.test.ts`

- [ ] **Step 1: Write failing test**

```ts
test("shows palette attribution for built-in themes", async () => {
  const output = await runThemesCommand(["themes", "show", "paper-clean"]);
  expect(output.stdout).toContain("paletteId: carbon-categorical");
  expect(output.stdout).toContain("paletteSource:");
  expect(output.stdout).toContain("IBM Carbon");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/cli/test/themes-command.test.ts`  
Expected: FAIL — output missing `paletteId`

- [ ] **Step 3: Update themes show text output**

In `themes.ts` `show` action, after `description` line:

```ts
const lines = [
  `name: ${theme.name}`,
  `displayName: ${theme.displayName}`,
  `target: ${theme.target}`,
  `mode: ${theme.mode}`,
  `description: ${theme.description}`,
];

if (theme.paletteId) {
  lines.push(`paletteId: ${theme.paletteId}`);
}
if (theme.paletteAttribution) {
  lines.push(
    `paletteSource: ${theme.paletteAttribution.name} (${theme.paletteAttribution.url})`,
  );
}

lines.push("config:", JSON.stringify(theme.config, null, 2), "");
writeOutput(lines.join("\n"));
```

JSON output already includes full theme object via `toPrettyJson(theme)` — no change needed.

- [ ] **Step 4: Run CLI theme tests**

Run: `bun test packages/cli/test/themes-command.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/themes.ts packages/cli/test/themes-command.test.ts
git commit -m "feat(cli): show palette attribution in themes show"
```

---

### Task 4: Documentation and theme samples

**Files:**
- Create: `docs/palettes.md`
- Modify: `skills/vega-paper/references/theme-catalog.md`
- Modify: `examples/theme-samples/README.md` (if present)
- Regenerate: `examples/theme-samples/*.svg`

- [ ] **Step 1: Create `docs/palettes.md`**

Include:

- One section per palette (`carbon-categorical`, `ft-line-web`, `catppuccin-latte`, `catppuccin-mocha`) with hex table, attribution link, `sourceKind`, selection notes.
- Theme mapping table from spec.
- Link to `examples/theme-samples/` for side-by-side SVG comparison.
- Note that `monochrome-print` is intentionally excluded.

- [ ] **Step 2: Update theme-catalog.md**

Add column **Palette** to built-in themes table:

| name | Palette |
|------|---------|
| `paper-clean` | `carbon-categorical` |
| … | … |

Add footnote linking to `docs/palettes.md`.

- [ ] **Step 3: Regenerate theme samples**

Run: `bun run render:theme-samples`  
Expected: all eight SVGs + meta sidecars updated under `examples/theme-samples/`

- [ ] **Step 4: Commit**

```bash
git add docs/palettes.md skills/vega-paper/references/theme-catalog.md examples/theme-samples
git commit -m "docs: add palette catalog and refresh theme sample SVGs"
```

---

### Task 5: Release notes and roadmap

**Files:**
- Create: `docs/releases/v0.2.0.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Create release notes stub**

```markdown
# vega-paper v0.2.0

Built-in theme **series colors** now use curated palettes with documented sources (IBM Carbon, Financial Times lineWeb, Catppuccin Latte/Mocha). Theme names are unchanged; rendered SVG colors will differ from v0.1.x.

See [docs/palettes.md](../palettes.md) for palette attribution and theme mapping.
```

- [ ] **Step 2: Mark Phase 4c Done in roadmap**

Update phase table: `4c | Curated design palettes | **Done**`

- [ ] **Step 3: Commit**

```bash
git add docs/releases/v0.2.0.md docs/roadmap.md
git commit -m "docs: add v0.2.0 release notes and mark Phase 4c done"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run full check**

Run: `bun run check && bun run typecheck && bun test packages/themes packages/cli/test/themes-command.test.ts`

Expected: all pass

- [ ] **Step 2: Manual smoke (record in PR description)**

```bash
bun run packages/cli/src/index.ts themes show paper-clean
bun run packages/cli/src/index.ts render examples/training-curve/chart.vl.json \
  --theme paper-clean --format svg --out /tmp/f1-paper-clean.svg
bun run packages/cli/src/index.ts render examples/training-curve/chart.vl.json \
  --theme shadcn-light --format svg --out /tmp/f1-shadcn-light.svg
```

Confirm six-series colors look distinct; open `/tmp/*.svg` or diff against old theme-samples.

- [ ] **Step 3: Final commit if any drift**

Only if verification produced uncommitted fixes.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Palette registry with attribution | Task 1 |
| Theme → palette mapping | Task 2 |
| `themes show` surfaces palette | Task 3 |
| `docs/palettes.md` | Task 4 |
| `theme-catalog.md` update | Task 4 |
| Regenerate `theme-samples` | Task 4 |
| Registry snapshot tests | Task 1 |
| v0.2.0 release notes | Task 5 |
| Roadmap 4c Done | Task 5 |
| No infer/MCP changes | — (out of scope) |
| `monochrome-print` unchanged | Task 2 |

## Out of scope for this plan

- Git tag `v0.2.0` and GitHub Release (separate release workflow after merge)
- `--preset paper|web` (Phase 4d)
- Figure meta `paletteId` field (future)
