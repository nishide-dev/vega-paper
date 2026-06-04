import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

  const tempDirectory = await mkdtemp(join(tmpdir(), "vega-paper-"));
  const tempSpecPath = join(
    tempDirectory,
    specType === "vega-lite" ? "spec.vl.json" : "spec.vg.json",
  );

  await writeFile(tempSpecPath, `${JSON.stringify(renderedSpec, null, 2)}\n`, "utf8");

  await renderWithExternalVegaCli({
    specType,
    inputPath: tempSpecPath,
    outputPath: request.outputPath,
    format: request.format,
    scale: request.scale,
  });

  return {
    outputPath: request.outputPath,
    warnings: [],
  };
}
