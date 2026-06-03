import { extname } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  buildRenderFigureMeta,
  type FigureMeta,
  resolveVegaDependencyVersions,
  toSiblingMetaPath,
  writeFigureMeta,
} from "../core/figure-meta";
import { type RenderRequest, type RenderResult, renderChart } from "../core/render";

type RenderCommandOptions = {
  format?: string;
  out?: string;
  theme?: string;
};

type WriteOutput = (value: string) => void;
type RunRender = (request: RenderRequest) => Promise<RenderResult>;
type WriteFigureMeta = (metaOutputPath: string, meta: FigureMeta) => Promise<void>;

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

export function registerRenderCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runRender: RunRender = renderChart,
  writeFigureMetaFile: WriteFigureMeta = writeFigureMeta,
): void {
  program
    .command("render")
    .argument("<spec>", "Vega or Vega-Lite JSON input path")
    .option("--format <format>", "output format")
    .option("--out <path>", "output file path")
    .option("--theme <name>", "theme name")
    .action(async (inputPath: string, options: RenderCommandOptions) => {
      const request = normalizeRenderOptions(inputPath, options);
      const result = await runRender(request);

      writeOutput(`Rendered ${result.outputPath}\n`);

      const metaOutputPath = toSiblingMetaPath(request.outputPath);
      const versions = await resolveVegaDependencyVersions();
      const meta = buildRenderFigureMeta({
        inputPath,
        outputPath: request.outputPath,
        themeName: request.themeName,
        versions,
      });

      try {
        await writeFigureMetaFile(metaOutputPath, meta);
      } catch (error) {
        throw toMetaWriteError(metaOutputPath, error);
      }

      writeOutput(`Wrote ${metaOutputPath}\n`);
    });
}

function inferFormatFromOutputPath(outputPath: string): "svg" | undefined {
  return extname(outputPath).toLowerCase() === ".svg" ? "svg" : undefined;
}

function toMetaWriteError(metaOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write figure meta to ${metaOutputPath}.`);
}
