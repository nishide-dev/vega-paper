export type RenderFormat = "svg";

export type RenderRequest = {
  inputPath: string;
  outputPath: string;
  format: RenderFormat;
  themeName?: string | undefined;
};

export type RenderResult = {
  outputPath: string;
  warnings: string[];
};

export async function renderChart(
  request: RenderRequest,
): Promise<RenderResult> {
  return {
    outputPath: request.outputPath,
    warnings: [],
  };
}
