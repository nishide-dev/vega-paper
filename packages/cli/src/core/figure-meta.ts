import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { VegaPaperError } from "./errors";
import type { InferAggregateMethod, InferChartType, VegaLiteFieldType } from "./infer";

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

export type FigureMeta = {
  generatedBy: "vega-paper";
  input: string;
  output: string;
  specOut: string;
  createdAt: string;
  vegaVersion: string;
  vegaLiteVersion: string;
  theme?: string;
  infer: FigureMetaInferSnapshot;
};

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

export type BuildFigureMetaInput = {
  inputPath: string;
  outputPath: string;
  specOutPath: string;
  chart: InferChartType;
  options: FigureMetaInferOptions;
  createdAt?: Date;
  versions?: VegaDependencyVersions;
};

export type VegaDependencyVersions = {
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

export function buildFigureMeta(input: BuildFigureMetaInput): FigureMeta {
  const createdAt = input.createdAt ?? new Date();
  const versions = input.versions;

  if (versions === undefined) {
    throw new VegaPaperError("Figure meta requires Vega dependency versions.");
  }

  const meta: FigureMeta = {
    generatedBy: "vega-paper",
    input: input.inputPath,
    output: input.outputPath,
    specOut: input.specOutPath,
    createdAt: createdAt.toISOString(),
    vegaVersion: versions.vegaVersion,
    vegaLiteVersion: versions.vegaLiteVersion,
    infer: buildInferSnapshot(input.chart, input.options),
  };

  if (input.options.theme !== undefined) {
    meta.theme = input.options.theme;
  }

  return meta;
}

export async function resolveVegaDependencyVersions(): Promise<VegaDependencyVersions> {
  const cliPackageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

  return {
    vegaVersion: await readPackageVersion(join(cliPackageRoot, "node_modules", "vega"), "vega"),
    vegaLiteVersion: await readPackageVersion(
      join(cliPackageRoot, "node_modules", "vega-lite"),
      "vega-lite",
    ),
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
