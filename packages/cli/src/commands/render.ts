import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  buildRenderFigureMeta,
  type FigureMeta,
  resolveFigureMetaVersions,
  toSiblingMetaPath,
  writeFigureMeta,
} from "../core/figure-meta";
import { type RenderRequest, type RenderResult, renderChart } from "../core/render";
import { buildRenderRequest } from "../core/render-format";

type RenderCommandOptions = {
  format?: string;
  out?: string;
  theme?: string;
  scale?: string;
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
    throw new VegaPaperError("Missing --out <path>. Output must be written to a file.");
  }

  return buildRenderRequest({
    inputPath,
    outputPath,
    format: options.format,
    scale: options.scale,
    themeName: options.theme,
  });
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
    .option("--format <format>", "output format: svg, png, or pdf")
    .option("--out <path>", "output file path")
    .option("--scale <factor>", "resolution scale for png or pdf (default 1)")
    .option("--theme <name|path>", "built-in theme name or path to theme JSON")
    .action(async (inputPath: string, options: RenderCommandOptions) => {
      const request = normalizeRenderOptions(inputPath, options);
      const result = await runRender(request);

      writeOutput(`Rendered ${result.outputPath}\n`);

      const metaOutputPath = toSiblingMetaPath(request.outputPath);
      const versions = await resolveFigureMetaVersions();
      const meta = buildRenderFigureMeta({
        inputPath,
        outputPath: request.outputPath,
        themeName: request.themeName,
        format: request.format,
        scale: request.scale,
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

function toMetaWriteError(metaOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write figure meta to ${metaOutputPath}.`);
}
