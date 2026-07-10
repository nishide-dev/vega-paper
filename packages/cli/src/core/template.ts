import { VegaPaperError } from "./errors";
import type { JsonObject } from "./spec";
import { buildBenchmarkHeatmapSpec } from "./templates/benchmark-heatmap";
import { buildCalibrationCurveSpec } from "./templates/calibration-curve";
import { buildEcdfSpec } from "./templates/ecdf";
import { buildMultipanelSpec, type MultipanelRequest } from "./templates/multipanel";
import { buildParetoFrontierSpec } from "./templates/pareto-frontier";
import { buildScalingLawSpec } from "./templates/scaling-law";
import { buildViolinSpec } from "./templates/violin";

export const TEMPLATE_NAMES = [
  "benchmark-heatmap",
  "pareto-frontier",
  "scaling-law",
  "calibration-curve",
  "violin",
  "ecdf",
  "multipanel",
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

export type ViolinOptions = {
  xField: string;
  yField: string;
  bandwidth?: number | undefined;
};

export type EcdfOptions = {
  xField: string;
  colorField?: string | undefined;
  xScale?: TemplateAxisScale | undefined;
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

export type ViolinRequest = TemplateCommonRequest & {
  template: "violin";
  options: ViolinOptions;
};

export type EcdfRequest = TemplateCommonRequest & {
  template: "ecdf";
  options: EcdfOptions;
};

export type MultipanelTemplateRequest = { template: "multipanel" } & MultipanelRequest;

export type TemplateRequest =
  | BenchmarkHeatmapRequest
  | ParetoFrontierRequest
  | ScalingLawRequest
  | CalibrationCurveRequest
  | ViolinRequest
  | EcdfRequest
  | MultipanelTemplateRequest;

export function parseTemplateName(value: string): TemplateName {
  if ((TEMPLATE_NAMES as readonly string[]).includes(value)) {
    return value as TemplateName;
  }

  throw new VegaPaperError(
    `Unknown template "${value}". Expected one of: ${TEMPLATE_NAMES.join(", ")}.`,
  );
}

export function buildTemplateSpec(request: TemplateRequest): JsonObject {
  switch (request.template) {
    case "benchmark-heatmap":
      return buildBenchmarkHeatmapSpec(request);
    case "pareto-frontier":
      return buildParetoFrontierSpec(request);
    case "scaling-law":
      return buildScalingLawSpec(request);
    case "calibration-curve":
      return buildCalibrationCurveSpec(request);
    case "violin":
      return buildViolinSpec(request);
    case "ecdf":
      return buildEcdfSpec(request);
    case "multipanel":
      return buildMultipanelSpec(request);
  }
}
