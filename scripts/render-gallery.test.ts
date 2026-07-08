import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { listThemes } from "../packages/themes/src/index.ts";

const GALLERY = "docs/assets/gallery";

const EXAMPLE_PREVIEWS = [
  "basic-line",
  "training-curve",
  "training-curve-error-band",
  "confusion-matrix",
  "faceted-training",
  "boxplot",
  "embedding-scatter",
  "ablation-bar",
  "benchmark-heatmap",
  "run-distribution",
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
