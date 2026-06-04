import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { VegaPaperError } from "./errors";
import type { InferAggregateMethod, InferChartType, VegaLiteFieldType } from "./infer";
import {
  resolveCliNodeModulesDirectory,
  resolveCliPackageRootFromMeta,
  resolveVegaPaperHome,
} from "./install-root";

export type FigureMetaInferSnapshot = {
  chart: InferChartType;
  x: string;
  y: string;
  color?: string;
  facet?: string;
  aggregate?: InferAggregateMethod;
  errorBand?: string;
  inlineData?: true;
  xType?: VegaLiteFieldType;
  yType?: VegaLiteFieldType;
  colorType?: VegaLiteFieldType;
  title?: string;
  width?: number;
  height?: number;
};

export type InferFigureMeta = {
  generatedBy: "vega-paper";
  command: "infer";
  input: string;
  output: string;
  specOut: string;
  createdAt: string;
  vegaPaperVersion: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
  infer: FigureMetaInferSnapshot;
};

export type RenderFigureMeta = {
  generatedBy: "vega-paper";
  command: "render";
  input: string;
  output: string;
  createdAt: string;
  vegaPaperVersion: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
};

export type FigureMeta = InferFigureMeta | RenderFigureMeta;

export type FigureMetaInferOptions = {
  chart?: string;
  x?: string;
  y?: string;
  color?: string;
  title?: string;
  width?: string;
  height?: string;
  theme?: string;
  xType?: string;
  yType?: string;
  colorType?: string;
  inlineData?: boolean;
  facet?: string;
  aggregate?: string;
  errorBand?: string;
};

export type BuildRenderFigureMetaInput = {
  inputPath: string;
  outputPath: string;
  themeName?: string | undefined;
  createdAt?: Date;
  versions?: FigureMetaVersions;
};

export type BuildFigureMetaInput = {
  inputPath: string;
  outputPath: string;
  specOutPath: string;
  chart: InferChartType;
  options: FigureMetaInferOptions;
  createdAt?: Date;
  versions?: FigureMetaVersions;
};

export type FigureMetaVersions = {
  vegaPaperVersion: string;
  vegaVersion: string;
  vegaLiteVersion: string;
};

const VALID_AGGREGATE_METHODS = ["mean", "median", "sum", "count", "min", "max"] as const;

export function toSiblingMetaPath(outputPath: string): string {
  const parsedPath = parse(outputPath);
  return join(parsedPath.dir, `${parsedPath.name}.meta.json`);
}

export function buildInferSnapshot(
  chart: InferChartType,
  options: FigureMetaInferOptions,
): FigureMetaInferSnapshot {
  const snapshot: FigureMetaInferSnapshot = {
    chart,
    x: requireOption(options.x, "--x <field>"),
    y: requireOption(options.y, "--y <field>"),
  };

  if (options.color !== undefined) {
    snapshot.color = options.color;
  }

  if (options.facet !== undefined) {
    snapshot.facet = options.facet;
  }

  if (options.aggregate !== undefined) {
    snapshot.aggregate = parseAggregateMethod(options.aggregate);
  }

  if (options.errorBand !== undefined) {
    snapshot.errorBand = options.errorBand;
  }

  if (options.inlineData === true) {
    snapshot.inlineData = true;
  }

  if (options.xType !== undefined) {
    snapshot.xType = parseFieldType(options.xType);
  }

  if (options.yType !== undefined) {
    snapshot.yType = parseFieldType(options.yType);
  }

  if (options.colorType !== undefined) {
    snapshot.colorType = parseFieldType(options.colorType);
  }

  if (options.title !== undefined) {
    snapshot.title = options.title;
  }

  if (options.width !== undefined) {
    snapshot.width = parsePositiveDimension(options.width);
  }

  if (options.height !== undefined) {
    snapshot.height = parsePositiveDimension(options.height);
  }

  return snapshot;
}

export function buildFigureMeta(input: BuildFigureMetaInput): InferFigureMeta {
  const createdAt = input.createdAt ?? new Date();
  const versions = input.versions;

  if (versions === undefined) {
    throw new VegaPaperError("Figure meta requires version metadata.");
  }

  const meta: InferFigureMeta = {
    generatedBy: "vega-paper",
    command: "infer",
    input: input.inputPath,
    output: input.outputPath,
    specOut: input.specOutPath,
    createdAt: createdAt.toISOString(),
    vegaPaperVersion: versions.vegaPaperVersion,
    vegaVersion: versions.vegaVersion,
    vegaLiteVersion: versions.vegaLiteVersion,
    infer: buildInferSnapshot(input.chart, input.options),
  };

  if (input.options.theme !== undefined) {
    meta.theme = input.options.theme;
  }

  return meta;
}

export function buildRenderFigureMeta(input: BuildRenderFigureMetaInput): RenderFigureMeta {
  const createdAt = input.createdAt ?? new Date();
  const versions = input.versions;

  if (versions === undefined) {
    throw new VegaPaperError("Figure meta requires version metadata.");
  }

  const meta: RenderFigureMeta = {
    generatedBy: "vega-paper",
    command: "render",
    input: input.inputPath,
    output: input.outputPath,
    createdAt: createdAt.toISOString(),
    vegaPaperVersion: versions.vegaPaperVersion,
    vegaVersion: versions.vegaVersion,
    vegaLiteVersion: versions.vegaLiteVersion,
  };

  if (input.themeName !== undefined) {
    meta.theme = input.themeName;
  }

  return meta;
}

export async function resolveFigureMetaVersions(): Promise<FigureMetaVersions> {
  const home = resolveVegaPaperHome();
  const cliPackageRoot = resolveCliPackageRootFromMeta(import.meta.url);
  const nodeModules = await resolveCliNodeModulesDirectory();

  let vegaPaperVersion: string;
  if (home) {
    try {
      const version = (await readFile(join(home, "VERSION"), "utf8")).trim();
      if (version.length === 0) {
        throw new Error("empty VERSION");
      }
      vegaPaperVersion = version;
    } catch {
      vegaPaperVersion = await readPackageVersion(cliPackageRoot, "vega-paper");
    }
  } else {
    vegaPaperVersion = await readPackageVersion(cliPackageRoot, "vega-paper");
  }

  return {
    vegaPaperVersion,
    vegaVersion: await readPackageVersion(join(nodeModules, "vega"), "vega"),
    vegaLiteVersion: await readPackageVersion(join(nodeModules, "vega-lite"), "vega-lite"),
  };
}

export async function writeFigureMeta(metaOutputPath: string, meta: FigureMeta): Promise<void> {
  try {
    await mkdir(dirname(metaOutputPath), { recursive: true });
    await writeFile(metaOutputPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`Could not write figure meta to ${metaOutputPath}.`);
  }
}

async function readPackageVersion(packageDirectory: string, packageName: string): Promise<string> {
  try {
    const packageJson = JSON.parse(
      await readFile(join(packageDirectory, "package.json"), "utf8"),
    ) as { version?: string };

    if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
      throw new VegaPaperError(`Could not read version from installed "${packageName}" package.`);
    }

    return packageJson.version;
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`Could not read version from installed "${packageName}" package.`);
  }
}

function parseAggregateMethod(value: string): InferAggregateMethod {
  if ((VALID_AGGREGATE_METHODS as readonly string[]).includes(value)) {
    return value as InferAggregateMethod;
  }

  throw new VegaPaperError(
    `Invalid value "${value}" for --aggregate. Expected one of: ${VALID_AGGREGATE_METHODS.join(", ")}.`,
  );
}

const VALID_FIELD_TYPES = ["quantitative", "nominal", "ordinal", "temporal"] as const;

function parseFieldType(value: string): VegaLiteFieldType {
  if ((VALID_FIELD_TYPES as readonly string[]).includes(value)) {
    return value as VegaLiteFieldType;
  }

  throw new VegaPaperError(
    `Invalid value "${value}" for field type override. Expected one of: quantitative, nominal, ordinal, temporal.`,
  );
}

function requireOption(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") {
    throw new VegaPaperError(`Missing required option ${flag}.`);
  }

  return value;
}

function parsePositiveDimension(value: string): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new VegaPaperError("Invalid positive dimension in figure meta snapshot.");
  }

  return numericValue;
}
