import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renderWithExternalVegaCli } from "../backends/external-vega-cli";
import type { RenderFormat } from "./render-format";
import { applyThemeToSpec, detectSpecType, loadJsonSpec } from "./spec";
import { getCliTheme } from "./theme";

export type { RenderFormat } from "./render-format";

export type RenderRequest = {
  inputPath: string;
  outputPath: string;
  format: RenderFormat;
  scale?: number | undefined;
  themeName?: string | undefined;
};

export type RenderResult = {
  outputPath: string;
  warnings: string[];
};

export async function renderChart(request: RenderRequest): Promise<RenderResult> {
  const spec = await loadJsonSpec(request.inputPath);
  const specType = detectSpecType(spec);
  const theme = request.themeName ? await getCliTheme(request.themeName) : undefined;
  const renderedSpec = theme ? applyThemeToSpec(spec, theme.config) : spec;

  await mkdir(dirname(request.outputPath), { recursive: true });

  const specDirectory = dirname(resolve(request.inputPath));
  const tempSpecPath = join(
    specDirectory,
    `.vega-paper-render-${randomBytes(8).toString("hex")}.${specType === "vega-lite" ? "vl" : "vg"}.json`,
  );

  await writeFile(tempSpecPath, `${JSON.stringify(renderedSpec, null, 2)}\n`, "utf8");

  try {
    await renderWithExternalVegaCli({
      specType,
      inputPath: tempSpecPath,
      outputPath: request.outputPath,
      format: request.format,
      scale: request.scale,
    });
  } finally {
    await rm(tempSpecPath, { force: true });
  }

  return {
    outputPath: request.outputPath,
    warnings: [],
  };
}
