import { extname } from "node:path";
import { VegaPaperError } from "./errors";

export const MAX_RENDER_SCALE = 32;

export type RenderFormat = "svg" | "png" | "pdf";

const FORMAT_EXTENSIONS: Record<RenderFormat, string> = {
  svg: ".svg",
  png: ".png",
  pdf: ".pdf",
};

export function inferFormatFromOutputPath(outputPath: string): RenderFormat | undefined {
  const extension = extname(outputPath).toLowerCase();

  for (const [format, expectedExtension] of Object.entries(FORMAT_EXTENSIONS) as Array<
    [RenderFormat, string]
  >) {
    if (extension === expectedExtension) {
      return format;
    }
  }

  return undefined;
}

export function parseRenderFormat(value: string | undefined): RenderFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "svg" || value === "png" || value === "pdf") {
    return value;
  }

  return undefined;
}

export function assertFormatMatchesExtension(format: RenderFormat, outputPath: string): void {
  const inferred = inferFormatFromOutputPath(outputPath);

  if (inferred === undefined) {
    throw new VegaPaperError(
      `Output path "${outputPath}" must end with ${FORMAT_EXTENSIONS[format]} when using --format ${format}.`,
    );
  }

  if (inferred !== format) {
    throw new VegaPaperError(
      `--format ${format} does not match output extension "${extname(outputPath)}".`,
    );
  }
}

export function parseScale(value: string | undefined, format: RenderFormat): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (format === "svg") {
    throw new VegaPaperError('The "--scale" option applies only to png or pdf output.');
  }

  const scale = Number(value);

  if (!Number.isFinite(scale) || scale <= 0) {
    throw new VegaPaperError('The "--scale" option must be a positive number.');
  }

  if (scale > MAX_RENDER_SCALE) {
    throw new VegaPaperError(`The "--scale" option must be at most ${MAX_RENDER_SCALE}.`);
  }

  return scale;
}

export function resolveRenderScale(scale: number | undefined): number {
  return scale ?? 1;
}

export type BuildRenderRequestInput = {
  inputPath: string;
  outputPath: string;
  format?: string | undefined;
  scale?: string | undefined;
  themeName?: string | undefined;
};

export type BuiltRenderRequest = {
  inputPath: string;
  outputPath: string;
  format: RenderFormat;
  scale: number;
  themeName?: string | undefined;
};

export function buildRenderRequest(input: BuildRenderRequestInput): BuiltRenderRequest {
  const outputPath = input.outputPath;
  const explicitFormat = parseRenderFormat(input.format);
  const inferredFormat = inferFormatFromOutputPath(outputPath);
  const format = explicitFormat ?? inferredFormat;

  if (!format) {
    throw new VegaPaperError(
      "Missing or ambiguous --format <format>. Use svg, png, or pdf, or an .svg/.png/.pdf --out path.",
    );
  }

  if (explicitFormat !== undefined) {
    assertFormatMatchesExtension(explicitFormat, outputPath);
  }

  const parsedScale = parseScale(input.scale, format);

  return {
    inputPath: input.inputPath,
    outputPath,
    format,
    scale: resolveRenderScale(parsedScale),
    themeName: input.themeName,
  };
}
