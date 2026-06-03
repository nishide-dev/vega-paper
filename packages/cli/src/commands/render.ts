import { extname } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import { type RenderRequest, renderChart } from "../core/render";

type RenderCommandOptions = {
  format?: string;
  out?: string;
  theme?: string;
};

export function normalizeRenderOptions(
  inputPath: string,
  options: RenderCommandOptions,
): RenderRequest {
  const outputPath = options.out;

  if (!outputPath) {
    throw new VegaPaperError("Missing --out <path>. SVG output must be written to a file.");
  }

  const format = options.format ?? inferFormatFromOutputPath(outputPath);

  if (!format) {
    throw new VegaPaperError(
      'Missing or ambiguous --format <format>. Use "--format svg" or an .svg output path.',
    );
  }

  if (format !== "svg") {
    throw new VegaPaperError(`Unsupported format "${format}". This MVP supports only "svg".`);
  }

  return {
    inputPath,
    outputPath,
    format,
    themeName: options.theme,
  };
}

export function registerRenderCommand(program: Command): void {
  program
    .command("render")
    .argument("<spec>", "Vega or Vega-Lite JSON input path")
    .option("--format <format>", "output format")
    .option("--out <path>", "output file path")
    .option("--theme <name>", "theme name")
    .action(async (inputPath: string, options: RenderCommandOptions) => {
      const request = normalizeRenderOptions(inputPath, options);
      const result = await renderChart(request);

      console.log(`Rendered ${result.outputPath}`);
    });
}

function inferFormatFromOutputPath(outputPath: string): "svg" | undefined {
  return extname(outputPath).toLowerCase() === ".svg" ? "svg" : undefined;
}
