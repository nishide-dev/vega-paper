import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { access, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { renderChart } from "../src/core/render";

const outputPath = "examples/basic-line/output.svg";

describe("render integration", () => {
  beforeEach(async () => {
    await rm(outputPath, { force: true });
    await mkdir(dirname(outputPath), { recursive: true });
  });

  afterEach(async () => {
    await rm(outputPath, { force: true });
  });

  test("renders the basic Vega-Lite example to SVG", async () => {
    if (!(await hasVegaLiteSvgBinary())) {
      console.warn("Skipping render integration: no vl2svg binary is installed.");
      return;
    }

    await renderChart({
      inputPath: "examples/basic-line/chart.vl.json",
      outputPath,
      format: "svg",
      themeName: "paper-clean",
    });

    const svg = await readFile(outputPath, "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  test("renders specs with relative data.url using the source spec directory", async () => {
    const boxplotOutputPath = "examples/boxplot/output.svg";

    if (!(await hasVegaLiteSvgBinary())) {
      console.warn("Skipping render integration: no vl2svg binary is installed.");
      return;
    }

    await rm(boxplotOutputPath, { force: true });
    await mkdir(dirname(boxplotOutputPath), { recursive: true });

    try {
      await renderChart({
        inputPath: "examples/boxplot/chart.vl.json",
        outputPath: boxplotOutputPath,
        format: "svg",
        themeName: "paper-clean",
      });

      const svg = await readFile(boxplotOutputPath, "utf8");
      expect(svg).not.toContain("0 values");
      expect(svg).toContain("role-mark");
    } finally {
      await rm(boxplotOutputPath, { force: true });
    }
  });
});

async function hasVegaLiteSvgBinary(): Promise<boolean> {
  const candidates = [
    join("node_modules", ".bin", "vl2svg"),
    join("node_modules", ".bun", "node_modules", "vega-lite", "bin", "vl2svg"),
  ];

  try {
    const entries = await readdir(join("node_modules", ".bun"));
    candidates.push(
      ...entries
        .filter((entry) => entry.startsWith("vega-lite@"))
        .map((entry) =>
          join("node_modules", ".bun", entry, "node_modules", "vega-lite", "bin", "vl2svg"),
        ),
    );
  } catch {
    // No Bun package store means this integration test cannot render locally.
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Try the next supported install layout.
    }
  }

  return false;
}
