import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  buildFigureMeta,
  type FigureMeta,
  resolveFigureMetaVersions,
  toSiblingMetaPath,
  writeFigureMeta,
} from "../core/figure-meta";
import {
  type InferAggregateMethod,
  type InferChartType,
  type InferRequest,
  type InferResult,
  inferVegaLiteSpec,
  type VegaLiteFieldType,
} from "../core/infer";
import { type LintResult, lintSpec } from "../core/lint";
import { getLintProfile } from "../core/lint-profiles";
import { type RenderRequest, type RenderResult, renderChart } from "../core/render";
import { buildRenderRequest } from "../core/render-format";
import { formatHumanLintResult, getLintExitCode } from "./lint";

type InferCommandOptions = {
  chart?: string;
  x?: string;
  y?: string;
  color?: string;
  title?: string;
  width?: string;
  height?: string;
  theme?: string;
  format?: string;
  scale?: string;
  out?: string;
  specOut?: string;
  lintProfile?: string;
  strict?: boolean;
  xType?: string;
  yType?: string;
  colorType?: string;
  inlineData?: boolean;
  facet?: string;
  aggregate?: string;
  errorBand?: string;
};

type WriteOutput = (value: string) => void;
type RunInfer = (request: InferRequest) => Promise<InferResult>;
type RunLint = (inputPath: string, profileName: string | undefined) => Promise<LintResult>;
type RunRender = (request: RenderRequest) => Promise<RenderResult>;
type SetExitCode = (exitCode: 0 | 1) => void;
type WriteSpec = (specOutputPath: string, spec: InferResult["spec"]) => Promise<void>;
type WriteFigureMeta = (metaOutputPath: string, meta: FigureMeta) => Promise<void>;

export function registerInferCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runInfer: RunInfer = inferVegaLiteSpec,
  runRender: RunRender = renderChart,
  writeSpec: WriteSpec = writeSpecFile,
  runLint: RunLint = (inputPath, profileName) => lintSpec({ inputPath, profileName }),
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
  writeFigureMetaFile: WriteFigureMeta = writeFigureMeta,
): void {
  program
    .command("infer")
    .argument("<input>", "CSV or JSON input path")
    .description("Generate a Vega-Lite spec from CSV or JSON and optionally render output")
    .option("--chart <type>", "chart type: line, bar, scatter, area, heatmap, or boxplot")
    .option("--x <field>", "x encoding field")
    .option("--y <field>", "y encoding field")
    .option("--color <field>", "color encoding field")
    .option("--facet <field>", "split chart into small multiples by field")
    .option(
      "--aggregate <method>",
      "aggregate measure before plotting: mean, median, sum, count, min, or max",
    )
    .option("--error-band <field>", "symmetric error magnitude for y (maps to encoding.yError)")
    .option("--title <text>", "chart title")
    .option("--width <number>", "chart width")
    .option("--height <number>", "chart height")
    .option(
      "--theme <name|path>",
      "built-in theme name or path to theme JSON, used only when rendering",
    )
    .option("--format <format>", "output format when rendering: svg, png, or pdf")
    .option("--scale <factor>", "resolution scale for png or pdf (default 1)")
    .option("--out <path>", "rendered output path (.svg, .png, or .pdf)")
    .option("--spec-out <path>", "Vega-Lite spec output path")
    .option("--x-type <type>", "override inferred type for x encoding")
    .option("--y-type <type>", "override inferred type for y encoding")
    .option("--color-type <type>", "override color encoding type")
    .option("--inline-data", "embed parsed data in the generated spec as data.values")
    .option("--lint-profile <name>", "lint profile: paper, web, acl, or print")
    .option("--strict", "exit with code 1 when warnings are present when linting")
    .action(async (inputPath: string, options: InferCommandOptions) => {
      if (options.lintProfile !== undefined) {
        getLintProfile(options.lintProfile);
      }

      const request = normalizeInferOptions(inputPath, options);
      const result = await runInfer(request);

      try {
        await writeSpec(request.specOutputPath, result.spec);
      } catch (error) {
        throw toSpecWriteError(request.specOutputPath, error);
      }

      writeOutput(`Wrote ${request.specOutputPath}\n`);

      if (options.lintProfile !== undefined) {
        const lintResult = await runLint(request.specOutputPath, options.lintProfile);
        const lintExitCode = getLintExitCode(lintResult, Boolean(options.strict));

        if (lintResult.issues.length === 0) {
          writeOutput("No lint issues found.\n");
        } else {
          writeOutput(formatHumanLintResult(lintResult));
        }

        if (lintExitCode !== 0) {
          setExitCode(lintExitCode);
          return;
        }
      }

      if (options.out !== undefined) {
        const renderRequest = buildRenderRequest({
          inputPath: request.specOutputPath,
          outputPath: options.out,
          format: options.format,
          scale: options.scale,
          themeName: options.theme,
        });
        const renderResult = await runRender(renderRequest);

        writeOutput(`Rendered ${renderResult.outputPath}\n`);

        const metaOutputPath = toSiblingMetaPath(options.out);
        const versions = await resolveFigureMetaVersions();
        const meta = buildFigureMeta({
          inputPath,
          outputPath: options.out,
          specOutPath: options.specOut ?? toSiblingSpecPath(options.out),
          chart: request.chart,
          options,
          renderOutput: {
            format: renderRequest.format,
            scale: renderRequest.scale,
          },
          versions,
        });

        try {
          await writeFigureMetaFile(metaOutputPath, meta);
        } catch (error) {
          throw toMetaWriteError(metaOutputPath, error);
        }

        writeOutput(`Wrote ${metaOutputPath}\n`);
      }
    });
}

export function normalizeInferOptions(
  inputPath: string,
  options: InferCommandOptions,
): InferRequest {
  const outputPath = options.out;

  if (options.strict && options.lintProfile === undefined) {
    throw new VegaPaperError('The "--strict" option requires "--lint-profile <name>".');
  }

  const specOutputPath =
    options.specOut ?? (outputPath === undefined ? undefined : toSiblingSpecPath(outputPath));

  if (specOutputPath === undefined) {
    throw new VegaPaperError(
      'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".',
    );
  }

  if (options.theme !== undefined && outputPath === undefined) {
    throw new VegaPaperError('The "--theme" option requires "--out <path>".');
  }

  if (outputPath !== undefined) {
    try {
      buildRenderRequest({
        inputPath: "placeholder.vl.json",
        outputPath,
        format: options.format,
        scale: options.scale,
      });
    } catch (error) {
      if (error instanceof VegaPaperError) {
        throw error;
      }

      throw new VegaPaperError(
        error instanceof Error ? error.message : "Invalid render output options.",
      );
    }
  }

  const xType = parseFieldType(options.xType, "--x-type");
  const yType = parseFieldType(options.yType, "--y-type");
  const colorType = parseFieldType(options.colorType, "--color-type");

  if (colorType !== undefined && options.color === undefined) {
    throw new VegaPaperError('The "--color-type" option requires "--color <field>".');
  }

  if (
    options.facet !== undefined &&
    options.color !== undefined &&
    options.facet === options.color
  ) {
    throw new VegaPaperError('The "--facet" and "--color" options must use different fields.');
  }

  const chart = parseInferChartType(options.chart);
  const aggregateMethod = parseInferAggregateMethod(options.aggregate);

  if (chart === "boxplot" && aggregateMethod !== undefined) {
    throw new VegaPaperError('The "--aggregate" option cannot be used with --chart boxplot.');
  }

  if (options.errorBand !== undefined && aggregateMethod !== undefined) {
    throw new VegaPaperError('The "--error-band" option cannot be used with --aggregate.');
  }

  validateHeatmapOptions(chart, options);
  validateBoxplotOptions(chart, options);
  validateErrorBandOptions(chart, options);

  return {
    inputPath,
    chart,
    xField: requireOption(options.x, "--x <field>"),
    yField: requireOption(options.y, "--y <field>"),
    colorField: options.color,
    title: options.title,
    width: parsePositiveDimension(options.width, "--width <number>"),
    height: parsePositiveDimension(options.height, "--height <number>"),
    specOutputPath,
    xType,
    yType,
    colorType,
    inlineData: options.inlineData === true ? true : undefined,
    facetField: options.facet,
    aggregateMethod,
    errorBandField: options.errorBand,
  };
}

async function writeSpecFile(specOutputPath: string, spec: InferResult["spec"]): Promise<void> {
  await mkdir(dirname(specOutputPath), { recursive: true });
  await writeFile(specOutputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
}

function parseInferChartType(chart: string | undefined): InferChartType {
  const value = requireOption(chart, "--chart <type>");

  if (
    value === "line" ||
    value === "bar" ||
    value === "scatter" ||
    value === "area" ||
    value === "heatmap" ||
    value === "boxplot"
  ) {
    return value;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${value}". Expected one of: line, bar, scatter, area, heatmap, boxplot.`,
  );
}

function validateBoxplotOptions(chart: InferChartType, options: InferCommandOptions): void {
  if (chart !== "boxplot") {
    return;
  }

  const x = requireOption(options.x, "--x <field>");
  const y = requireOption(options.y, "--y <field>");

  if (x === y) {
    throw new VegaPaperError("Boxplot requires distinct --x and --y fields.");
  }

  const color = options.color;

  if (color !== undefined) {
    if (x === color || y === color) {
      throw new VegaPaperError("Boxplot requires distinct --x, --y, and --color fields.");
    }

    if (options.facet !== undefined) {
      if (options.facet === x || options.facet === y || options.facet === color) {
        throw new VegaPaperError(
          'The "--facet" field must differ from --x, --y, and --color on boxplot charts.',
        );
      }
    }

    return;
  }

  if (options.facet !== undefined && (options.facet === x || options.facet === y)) {
    throw new VegaPaperError('The "--facet" field must differ from --x and --y on boxplot charts.');
  }
}

function validateErrorBandOptions(chart: InferChartType, options: InferCommandOptions): void {
  const errorBand = options.errorBand;

  if (errorBand === undefined) {
    return;
  }

  if (chart === "heatmap") {
    throw new VegaPaperError('The "--error-band" option cannot be used with --chart heatmap.');
  }

  if (chart === "boxplot") {
    throw new VegaPaperError('The "--error-band" option cannot be used with --chart boxplot.');
  }

  const x = requireOption(options.x, "--x <field>");
  const y = requireOption(options.y, "--y <field>");
  const color = options.color;

  if (errorBand === x || errorBand === y) {
    throw new VegaPaperError(
      color === undefined
        ? 'The "--error-band" field must differ from --x and --y.'
        : 'The "--error-band" field must differ from --x, --y, and --color.',
    );
  }

  if (color !== undefined && errorBand === color) {
    throw new VegaPaperError('The "--error-band" field must differ from --x, --y, and --color.');
  }

  if (options.facet === undefined) {
    return;
  }

  if (color !== undefined) {
    if (
      options.facet === x ||
      options.facet === y ||
      options.facet === color ||
      options.facet === errorBand
    ) {
      throw new VegaPaperError(
        'The "--facet" field must differ from --x, --y, --color, and --error-band.',
      );
    }

    return;
  }

  if (options.facet === x || options.facet === y || options.facet === errorBand) {
    throw new VegaPaperError('The "--facet" field must differ from --x, --y, and --error-band.');
  }
}

function validateHeatmapOptions(chart: InferChartType, options: InferCommandOptions): void {
  if (chart !== "heatmap") {
    return;
  }

  if (options.color === undefined) {
    throw new VegaPaperError('The "--color" option is required when --chart heatmap is used.');
  }

  const x = requireOption(options.x, "--x <field>");
  const y = requireOption(options.y, "--y <field>");
  const color = options.color;

  if (x === y || x === color || y === color) {
    throw new VegaPaperError("Heatmap requires distinct --x, --y, and --color fields.");
  }

  if (options.facet !== undefined) {
    if (options.facet === x || options.facet === y || options.facet === color) {
      throw new VegaPaperError(
        'The "--facet" field must differ from --x, --y, and --color on heatmap charts.',
      );
    }
  }
}

const VALID_AGGREGATE_METHODS = ["mean", "median", "sum", "count", "min", "max"] as const;

function parseInferAggregateMethod(value: string | undefined): InferAggregateMethod | undefined {
  if (value === undefined) {
    return undefined;
  }

  if ((VALID_AGGREGATE_METHODS as readonly string[]).includes(value)) {
    return value as InferAggregateMethod;
  }

  throw new VegaPaperError(
    `Invalid value "${value}" for --aggregate. Expected one of: ${VALID_AGGREGATE_METHODS.join(", ")}.`,
  );
}

function requireOption(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") {
    throw new VegaPaperError(`Missing required option ${flag}.`);
  }

  return value;
}

function parsePositiveDimension(
  value: string | undefined,
  flag: "--width <number>" | "--height <number>",
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new VegaPaperError(`Invalid value for ${flag}. Expected a positive finite number.`);
  }

  return numericValue;
}

const VALID_FIELD_TYPES = ["quantitative", "nominal", "ordinal", "temporal"] as const;

function parseFieldType(
  value: string | undefined,
  flag: "--x-type" | "--y-type" | "--color-type",
): VegaLiteFieldType | undefined {
  if (value === undefined) return undefined;
  if ((VALID_FIELD_TYPES as readonly string[]).includes(value)) {
    return value as VegaLiteFieldType;
  }
  throw new VegaPaperError(
    `Invalid value "${value}" for ${flag}. Expected one of: quantitative, nominal, ordinal, temporal.`,
  );
}

function toSiblingSpecPath(outputPath: string): string {
  const parsedPath = parse(outputPath);
  return join(parsedPath.dir, `${parsedPath.name}.vl.json`);
}

function toSpecWriteError(specOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write generated spec to ${specOutputPath}.`);
}

function toMetaWriteError(metaOutputPath: string, error: unknown): VegaPaperError {
  if (error instanceof VegaPaperError) {
    return error;
  }

  return new VegaPaperError(`Could not write figure meta to ${metaOutputPath}.`);
}
