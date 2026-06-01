import { access, mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
    if (!(await hasLocalVl2Svg())) {
      console.warn(
        "Skipping render integration test because node_modules/.bin/vl2svg is unavailable.",
      );
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
});

async function hasLocalVl2Svg(): Promise<boolean> {
  try {
    await access("node_modules/.bin/vl2svg");
    return true;
  } catch {
    return false;
  }
}
