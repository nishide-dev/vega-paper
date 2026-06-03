import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, parse } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  inferVegaLiteSpec,
  type InferChartType,
  type InferRequest,
  type InferResult,
  type VegaLiteFieldType,
} from "../core/infer";
import { lintSpec, type LintResult } from "../core/lint";
import { getLintProfile } from "../core/lint-profiles";
import { renderChart, type RenderRequest, type RenderResult } from "../core/render";
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
  out?: string;
  specOut?: string;
  lintProfile?: string;
  strict?: boolean;
  xType?: string;
  yType?: string;
  colorType?: string;
  inlineData?: boolean;
};

type WriteOutput = (value: string) => void;
type RunInfer = (request: InferRequest) => Promise<InferResult>;
type RunLint = (
  inputPath: string,
  profileName: string | undefined,
) => Promise<LintResult>;
type RunRender = (request: RenderRequest) => Promise<RenderResult>;
type SetExitCode = (exitCode: 0 | 1) => void;
type WriteSpec = (specOutputPath: string, spec: InferResult["spec"]) => Promise<void>;

export function registerInferCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runInfer: RunInfer = inferVegaLiteSpec,
  runRender: RunRender = renderChart,
  writeSpec: WriteSpec = writeSpecFile,
  runLint: RunLint = (inputPath, profileName) =>
    lintSpec({ inputPath, profileName }),
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
): void {
  program
    .command("infer")
    .argument("<input>", "CSV or JSON input path")
    .description("Generate a Vega-Lite spec from CSV or JSON and optionally render SVG")
    .option("--chart <type>", "chart type: line, bar, scatter, or area")
    .option("--x <field>", "x encoding field")
    .option("--y <field>", "y encoding field")
    .option("--color <field>", "color encoding field")
    .option("--title <text>", "chart title")
    .option("--width <number>", "chart width")
    .option("--height <number>", "chart height")
    .option("--theme <name>", "theme name, used only when rendering")
    .option("--out <path>", "SVG output path")
    .option("--spec-out <path>", "Vega-Lite spec output path")
    .option("--x-type <type>", "override inferred type for x encoding")
    .option("--y-type <type>", "override inferred type for y encoding")
    .option("--color-type <type>", "override color encoding type")
    .option("--inline-data", "embed parsed data in the generated spec as data.values")
    .option("--lint-profile <name>", "lint profile: paper, web, or acl")
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
        const renderResult = await runRender({
          inputPath: request.specOutputPath,
          outputPath: options.out,
          format: "svg",
          themeName: options.theme,
        });

        writeOutput(`Rendered ${renderResult.outputPath}\n`);
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

  if (outputPath !== undefined && extname(outputPath).toLowerCase() !== ".svg") {
    throw new VegaPaperError(
      `Unsupported output path "${outputPath}". This MVP supports only .svg outputs.`,
    );
  }

  const xType = parseFieldType(options.xType, "--x-type");
  const yType = parseFieldType(options.yType, "--y-type");
  const colorType = parseFieldType(options.colorType, "--color-type");

  if (colorType !== undefined && options.color === undefined) {
    throw new VegaPaperError('The "--color-type" option requires "--color <field>".');
  }

  return {
    inputPath,
    chart: parseInferChartType(options.chart),
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
  };
}

async function writeSpecFile(
  specOutputPath: string,
  spec: InferResult["spec"],
): Promise<void> {
  await mkdir(dirname(specOutputPath), { recursive: true });
  await writeFile(specOutputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
}

function parseInferChartType(chart: string | undefined): InferChartType {
  const value = requireOption(chart, "--chart <type>");

  if (value === "line" || value === "bar" || value === "scatter" || value === "area") {
    return value;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${value}". Expected one of: line, bar, scatter, area.`,
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
