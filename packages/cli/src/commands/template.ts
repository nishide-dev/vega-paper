import { dirname, extname } from "node:path";
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import {
  buildTemplateFigureMeta,
  type FigureMeta,
  resolveFigureMetaVersions,
  type TemplateOptionsSnapshot,
  toSiblingMetaPath,
  writeFigureMeta,
} from "../core/figure-meta";
import { parseCsv } from "../core/infer";
import { type RenderRequest, type RenderResult, renderChart } from "../core/render";
import { buildRenderRequest } from "../core/render-format";
import { detectSpecType, type JsonObject, loadJsonSpec } from "../core/spec";
import {
  type MultipanelLayout,
  type MultipanelPanel,
  rebaseDataUrl,
} from "../core/templates/multipanel";
import {
  buildTemplateSpec,
  parseTemplateName,
  TEMPLATE_NAMES,
  type TemplateAxisScale,
  type TemplateName,
  type TemplateRequest,
  type TemplateTable,
} from "../core/template";
import { toSiblingSpecPath, writeSpecFile } from "./infer";

type TemplateCommandOptions = {
  x?: string;
  y?: string;
  score?: string;
  label?: string;
  color?: string;
  size?: string;
  confidence?: string;
  accuracy?: string;
  count?: string;
  ece?: string;
  highlightBest?: boolean;
  xScale?: string;
  frontier?: string;
  fit?: string;
  title?: string;
  width?: string;
  height?: string;
  theme?: string;
  format?: string;
  scale?: string;
  out?: string;
  specOut?: string;
  panel?: string[];
  layout?: string;
};

type WriteOutput = (value: string) => void;
type RunRender = (request: RenderRequest) => Promise<RenderResult>;
type WriteSpec = (specOutputPath: string, spec: JsonObject) => Promise<void>;
type WriteFigureMetaFile = (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
type LoadTable = (inputPath: string) => Promise<TemplateTable>;

export function registerTemplateCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runRender: RunRender = renderChart,
  writeSpec: WriteSpec = writeSpecFile,
  writeFigureMetaFile: WriteFigureMetaFile = writeFigureMeta,
  loadTable: LoadTable = readTemplateCsv,
): void {
  program
    .command("template")
    .argument("<template-name>", `template name: ${TEMPLATE_NAMES.join(", ")}`)
    .argument("[data]", "CSV input path (not used by the multipanel template)")
    .description("Generate a structured ML paper figure spec from a named template")
    .option("--x <field>", "x encoding field")
    .option("--y <field>", "y encoding field")
    .option("--score <field>", "cell score field (benchmark-heatmap)")
    .option("--label <field>", "text label field")
    .option("--color <field>", "color encoding field")
    .option("--size <field>", "point size field (pareto-frontier)")
    .option("--confidence <field>", "per-bin confidence field (calibration-curve)")
    .option("--accuracy <field>", "per-bin accuracy field (calibration-curve)")
    .option("--count <field>", "per-bin sample count field (calibration-curve)")
    .option("--ece <number>", "expected calibration error annotation (calibration-curve)")
    .option("--highlight-best", "outline the best score per --x column (benchmark-heatmap)")
    .option("--x-scale <type>", "x axis scale: linear or log")
    .option("--frontier <mode>", "Pareto frontier mode: max-y-min-x")
    .option("--fit <method>", "fitted trend overlay: regression")
    .option(
      "--panel <value>",
      "multipanel panel as <spec-path>:<label>[:<title>] (repeatable)",
      collectPanelValues,
      [] as string[],
    )
    .option("--layout <layout>", "multipanel layout: hconcat or vconcat (default hconcat)")
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
    .action(
      async (
        templateNameValue: string,
        inputPath: string | undefined,
        options: TemplateCommandOptions,
      ) => {
        const template = parseTemplateName(templateNameValue);

        if (template === "multipanel") {
          if (inputPath !== undefined) {
            throw new VegaPaperError(
              "The multipanel template does not take a <data> argument. Pass panels with --panel <spec-path>:<label>[:<title>].",
            );
          }

          await runMultipanelTemplate(options, {
            writeOutput,
            runRender,
            writeSpec,
            writeFigureMetaFile,
          });
          return;
        }

        if (inputPath === undefined) {
          throw new VegaPaperError("Missing required argument <data>.");
        }

        if ((options.panel ?? []).length > 0 || options.layout !== undefined) {
          throw new VegaPaperError(
            'The "--panel" and "--layout" options are only valid with the multipanel template.',
          );
        }

        const specOutputPath = resolveTemplateOutputs(options);
        const table = await loadTable(inputPath);
        const request = buildTemplateRequest(template, inputPath, specOutputPath, options, table);
        const spec = buildTemplateSpec(request);

        try {
          await writeSpec(specOutputPath, spec);
        } catch (error) {
          throw toSpecWriteError(specOutputPath, error);
        }

        writeOutput(`Wrote ${specOutputPath}\n`);

        if (options.out === undefined) {
          return;
        }

        const renderRequest = buildRenderRequest({
          inputPath: specOutputPath,
          outputPath: options.out,
          format: options.format,
          scale: options.scale,
          themeName: options.theme,
        });
        const renderResult = await runRender(renderRequest);

        writeOutput(`Rendered ${renderResult.outputPath}\n`);

        const metaOutputPath = toSiblingMetaPath(options.out);
        const versions = await resolveFigureMetaVersions();
        const meta = buildTemplateFigureMeta({
          template,
          inputPath,
          outputPath: options.out,
          specOutPath: specOutputPath,
          themeName: options.theme,
          format: renderRequest.format,
          scale: renderRequest.scale,
          options: buildTemplateOptionsSnapshot(request),
          versions,
        });

        try {
          await writeFigureMetaFile(metaOutputPath, meta);
        } catch (error) {
          throw toMetaWriteError(metaOutputPath, error);
        }

        writeOutput(`Wrote ${metaOutputPath}\n`);
      },
    );
}

const TEMPLATE_OPTION_FLAGS = {
  x: "--x",
  y: "--y",
  score: "--score",
  label: "--label",
  color: "--color",
  size: "--size",
  confidence: "--confidence",
  accuracy: "--accuracy",
  count: "--count",
  ece: "--ece",
  highlightBest: "--highlight-best",
  xScale: "--x-scale",
  frontier: "--frontier",
  fit: "--fit",
} as const;

type TemplateOptionKey = keyof typeof TEMPLATE_OPTION_FLAGS;

const ALLOWED_OPTIONS_BY_TEMPLATE: Record<TemplateName, readonly TemplateOptionKey[]> = {
  "benchmark-heatmap": ["x", "y", "score", "label", "highlightBest"],
  "pareto-frontier": ["x", "y", "label", "color", "size", "xScale", "frontier"],
  "scaling-law": ["x", "y", "color", "xScale", "fit"],
  "calibration-curve": ["confidence", "accuracy", "count", "ece"],
  multipanel: [],
};

export function buildTemplateRequest(
  template: TemplateName,
  inputPath: string,
  specOutputPath: string,
  options: TemplateCommandOptions,
  table: TemplateTable,
): TemplateRequest {
  rejectUnsupportedOptions(template, options);

  const common = {
    inputPath,
    specOutputPath,
    table,
    title: options.title,
    width: parsePositiveDimension(options.width, "--width <number>"),
    height: parsePositiveDimension(options.height, "--height <number>"),
  };

  if (template === "benchmark-heatmap") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        scoreField: requireOption(options.score, "--score <field>"),
        labelField: options.label,
        highlightBest: options.highlightBest === true ? true : undefined,
      },
    };
  }

  if (template === "pareto-frontier") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        labelField: options.label,
        colorField: options.color,
        sizeField: options.size,
        xScale: parseAxisScale(options.xScale),
        frontier: parseFrontierMode(options.frontier),
      },
    };
  }

  if (template === "scaling-law") {
    return {
      ...common,
      template,
      options: {
        xField: requireOption(options.x, "--x <field>"),
        yField: requireOption(options.y, "--y <field>"),
        colorField: options.color,
        xScale: parseAxisScale(options.xScale),
        fit: parseFitMethod(options.fit),
      },
    };
  }

  if (template === "multipanel") {
    throw new VegaPaperError(
      "The multipanel template is handled separately and does not use CSV input.",
    );
  }

  return {
    ...common,
    template: "calibration-curve",
    options: {
      confidenceField: requireOption(options.confidence, "--confidence <field>"),
      accuracyField: requireOption(options.accuracy, "--accuracy <field>"),
      countField: options.count,
      ece: parseEce(options.ece),
    },
  };
}

export function buildTemplateOptionsSnapshot(request: TemplateRequest): TemplateOptionsSnapshot {
  const snapshot: TemplateOptionsSnapshot = {};

  switch (request.template) {
    case "benchmark-heatmap": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;
      snapshot.score = options.scoreField;

      if (options.labelField !== undefined) {
        snapshot.label = options.labelField;
      }

      if (options.highlightBest === true) {
        snapshot.highlightBest = true;
      }

      break;
    }
    case "pareto-frontier": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;

      if (options.labelField !== undefined) {
        snapshot.label = options.labelField;
      }

      if (options.colorField !== undefined) {
        snapshot.color = options.colorField;
      }

      if (options.sizeField !== undefined) {
        snapshot.size = options.sizeField;
      }

      if (options.xScale !== undefined) {
        snapshot.xScale = options.xScale;
      }

      if (options.frontier !== undefined) {
        snapshot.frontier = options.frontier;
      }

      break;
    }
    case "scaling-law": {
      const options = request.options;
      snapshot.x = options.xField;
      snapshot.y = options.yField;

      if (options.colorField !== undefined) {
        snapshot.color = options.colorField;
      }

      if (options.xScale !== undefined) {
        snapshot.xScale = options.xScale;
      }

      if (options.fit !== undefined) {
        snapshot.fit = options.fit;
      }

      break;
    }
    case "calibration-curve": {
      const options = request.options;
      snapshot.confidence = options.confidenceField;
      snapshot.accuracy = options.accuracyField;

      if (options.countField !== undefined) {
        snapshot.count = options.countField;
      }

      if (options.ece !== undefined) {
        snapshot.ece = options.ece;
      }

      break;
    }
  }

  return snapshot;
}

function rejectUnsupportedOptions(template: TemplateName, options: TemplateCommandOptions): void {
  const allowed = ALLOWED_OPTIONS_BY_TEMPLATE[template];

  for (const key of Object.keys(TEMPLATE_OPTION_FLAGS) as TemplateOptionKey[]) {
    if (options[key] !== undefined && !allowed.includes(key)) {
      throw new VegaPaperError(
        `The "${TEMPLATE_OPTION_FLAGS[key]}" option is not supported by template "${template}".`,
      );
    }
  }
}

function resolveTemplateOutputs(options: TemplateCommandOptions): string {
  const outputPath = options.out;
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

  return specOutputPath;
}

async function readTemplateCsv(inputPath: string): Promise<TemplateTable> {
  const extension = extname(inputPath).toLowerCase();

  if (extension !== ".csv") {
    throw new VegaPaperError(
      `Unsupported input format "${extension}". Template input must be a .csv file.`,
    );
  }

  const file = Bun.file(inputPath);

  if (!(await file.exists())) {
    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }

  try {
    return parseCsv(await file.text());
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }
}

function parseAxisScale(value: string | undefined): TemplateAxisScale | undefined {
  if (value === undefined || value === "linear" || value === "log") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --x-scale. Expected one of: linear, log.`);
}

function parseFrontierMode(value: string | undefined): "max-y-min-x" | undefined {
  if (value === undefined || value === "max-y-min-x") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --frontier. Expected: max-y-min-x.`);
}

function parseFitMethod(value: string | undefined): "regression" | undefined {
  if (value === undefined || value === "regression") {
    return value;
  }

  throw new VegaPaperError(`Invalid value "${value}" for --fit. Expected: regression.`);
}

function parseEce(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new VegaPaperError(
      `Invalid value "${value}" for --ece. Expected a finite non-negative number.`,
    );
  }

  return numericValue;
}

function requireOption(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") {
    throw new VegaPaperError(`Missing required option ${flag}.`);
  }

  return value;
}

function parsePositiveDimension(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new VegaPaperError(`Invalid value for ${flag}. Expected a positive finite number.`);
  }

  return numericValue;
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

export type ParsedPanelOption = {
  specPath: string;
  label: string;
  title?: string | undefined;
};

export function parsePanelOption(value: string): ParsedPanelOption {
  const parts = value.split(":");

  if (parts.length < 2) {
    throw new VegaPaperError(
      `Invalid --panel value "${value}". Expected <spec-path>:<label>[:<title>].`,
    );
  }

  const [specPath = "", label = "", ...titleParts] = parts;

  if (specPath === "" || label === "") {
    throw new VegaPaperError(
      `Invalid --panel value "${value}". Spec path and label must be non-empty.`,
    );
  }

  const title = titleParts.join(":");

  return {
    specPath,
    label,
    title: title === "" ? undefined : title,
  };
}

export function parseMultipanelLayout(value: string | undefined): MultipanelLayout {
  if (value === undefined || value === "hconcat") {
    return "hconcat";
  }

  if (value === "vconcat") {
    return "vconcat";
  }

  throw new VegaPaperError(
    `Invalid value "${value}" for --layout. Expected one of: hconcat, vconcat.`,
  );
}

function collectPanelValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

type MultipanelTemplateDeps = {
  writeOutput: (value: string) => void;
  runRender: (request: RenderRequest) => Promise<RenderResult>;
  writeSpec: (specOutputPath: string, spec: JsonObject) => Promise<void>;
  writeFigureMetaFile: (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
};

async function runMultipanelTemplate(
  options: TemplateCommandOptions,
  deps: MultipanelTemplateDeps,
): Promise<void> {
  const panelValues = options.panel ?? [];

  if (panelValues.length < 2) {
    throw new VegaPaperError("The multipanel template requires at least two --panel values.");
  }

  const layout = parseMultipanelLayout(options.layout);
  const specOutputPath = resolveTemplateOutputs(options);
  const outputDirectory = dirname(specOutputPath);
  const panels: MultipanelPanel[] = [];

  for (const value of panelValues) {
    const parsed = parsePanelOption(value);
    const panelSpec = await loadJsonSpec(parsed.specPath);

    if (detectSpecType(panelSpec) !== "vega-lite") {
      throw new VegaPaperError(
        `Multipanel panels must be Vega-Lite specs. Not Vega-Lite: ${parsed.specPath}`,
      );
    }

    panels.push({
      spec: rebaseDataUrl(panelSpec, dirname(parsed.specPath), outputDirectory),
      label: parsed.label,
      title: parsed.title,
    });
  }

  const spec = buildTemplateSpec({ template: "multipanel", panels, layout });

  try {
    await deps.writeSpec(specOutputPath, spec);
  } catch (error) {
    throw toSpecWriteError(specOutputPath, error);
  }

  deps.writeOutput(`Wrote ${specOutputPath}\n`);

  if (options.out === undefined) {
    return;
  }

  const renderRequest = buildRenderRequest({
    inputPath: specOutputPath,
    outputPath: options.out,
    format: options.format,
    scale: options.scale,
    themeName: options.theme,
  });
  const renderResult = await deps.runRender(renderRequest);

  deps.writeOutput(`Rendered ${renderResult.outputPath}\n`);

  const metaOutputPath = toSiblingMetaPath(options.out);
  const versions = await resolveFigureMetaVersions();
  const meta = buildTemplateFigureMeta({
    template: "multipanel",
    outputPath: options.out,
    specOutPath: specOutputPath,
    themeName: options.theme,
    format: renderRequest.format,
    scale: renderRequest.scale,
    versions,
    options: { panels: panelValues, layout },
  });

  try {
    await deps.writeFigureMetaFile(metaOutputPath, meta);
  } catch (error) {
    throw toMetaWriteError(metaOutputPath, error);
  }

  deps.writeOutput(`Wrote ${metaOutputPath}\n`);
}
