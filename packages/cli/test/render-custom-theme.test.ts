import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { applyThemeToSpec, loadJsonSpec } from "../src/core/spec";
import { getCliTheme } from "../src/core/theme";

const workspace = join(import.meta.dir, ".tmp-render-custom-theme");

describe("custom theme rendering", () => {
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("merges a custom theme file into a Vega-Lite spec", async () => {
    await mkdir(workspace, { recursive: true });
    const themePath = join(workspace, "lab.json");
    await writeFile(
      themePath,
      `${JSON.stringify({
        name: "lab-pink",
        config: { background: "pink", font: "Georgia, serif" },
      })}\n`,
      "utf8",
    );

    const theme = await getCliTheme("lab.json", { cwd: workspace });
    const spec = await loadJsonSpec("examples/basic-line/chart.vl.json");
    const merged = applyThemeToSpec(spec, theme.config) as {
      config: { background?: string; font?: string };
    };

    expect(theme.name).toBe("lab-pink");
    expect(merged.config.background).toBe("pink");
    expect(merged.config.font).toBe("Georgia, serif");
  });

  test("throws VegaPaperError for invalid theme files", async () => {
    await mkdir(workspace, { recursive: true });
    const themePath = join(workspace, "broken.json");
    await writeFile(themePath, '{ "config": {} }\n', "utf8");

    await expect(getCliTheme("broken.json", { cwd: workspace })).rejects.toThrow(
      "Invalid theme file",
    );
  });
});
