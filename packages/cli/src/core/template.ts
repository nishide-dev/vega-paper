import { VegaPaperError } from "./errors";

export const TEMPLATE_NAMES = [
  "benchmark-heatmap",
  "pareto-frontier",
  "scaling-law",
  "calibration-curve",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export type TemplateTable = {
  header: string[];
  rows: string[][];
};

export type TemplateAxisScale = "linear" | "log";

export type TemplateCommonRequest = {
  inputPath: string;
  specOutputPath: string;
  table: TemplateTable;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

export type BenchmarkHeatmapOptions = {
  xField: string;
  yField: string;
  scoreField: string;
  labelField?: string | undefined;
  highlightBest?: boolean | undefined;
};

export type ParetoFrontierOptions = {
  xField: string;
  yField: string;
  labelField?: string | undefined;
  colorField?: string | undefined;
  sizeField?: string | undefined;
  xScale?: TemplateAxisScale | undefined;
  frontier?: "max-y-min-x" | undefined;
};

export type ScalingLawOptions = {
  xField: string;
  yField: string;
  colorField?: string | undefined;
  xScale?: TemplateAxisScale | undefined;
  fit?: "regression" | undefined;
};

export type CalibrationCurveOptions = {
  confidenceField: string;
  accuracyField: string;
  countField?: string | undefined;
  ece?: number | undefined;
};

export type BenchmarkHeatmapRequest = TemplateCommonRequest & {
  template: "benchmark-heatmap";
  options: BenchmarkHeatmapOptions;
};

export type ParetoFrontierRequest = TemplateCommonRequest & {
  template: "pareto-frontier";
  options: ParetoFrontierOptions;
};

export type ScalingLawRequest = TemplateCommonRequest & {
  template: "scaling-law";
  options: ScalingLawOptions;
};

export type CalibrationCurveRequest = TemplateCommonRequest & {
  template: "calibration-curve";
  options: CalibrationCurveOptions;
};

export type TemplateRequest =
  | BenchmarkHeatmapRequest
  | ParetoFrontierRequest
  | ScalingLawRequest
  | CalibrationCurveRequest;

export function parseTemplateName(value: string): TemplateName {
  if ((TEMPLATE_NAMES as readonly string[]).includes(value)) {
    return value as TemplateName;
  }

  throw new VegaPaperError(
    `Unknown template "${value}". Expected one of: ${TEMPLATE_NAMES.join(", ")}.`,
  );
}
