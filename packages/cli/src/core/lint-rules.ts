import type { LintDomain, LintIssue } from "./lint";
import type { LintProfile } from "./lint-profiles";
import type { JsonObject, SpecType } from "./spec";

export type LintRuleContext = {
  inputPath: string;
  spec: JsonObject;
  specType: SpecType;
  profile: LintProfile;
  domain?: LintDomain | undefined;
  externalDataRows?: JsonObject[] | undefined;
};

export type LintRule = (context: LintRuleContext) => LintIssue[];

type VegaLiteUnitSpec = {
  spec: JsonObject;
  path: string;
};

export const paperLintRules: LintRule[] = [
  checkTitleLength,
  checkAxisTitles,
  checkSizePresence,
  checkSizeRange,
  checkInlineDataSize,
  checkLegendCategoryCount,
  checkFontSizes,
  checkBarYAxisZero,
  checkGrayscaleUnsafeColors,
  checkColorOnlySeriesDistinction,
];

export function runLintRules(context: LintRuleContext): LintIssue[] {
  return paperLintRules.flatMap((rule) => rule(context));
}

function checkTitleLength({ spec, profile }: LintRuleContext): LintIssue[] {
  const titleText = getTitleText(spec.title);

  if (!titleText || titleText.length <= profile.titleMaxLength) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: `Title is longer than ${profile.titleMaxLength} characters.`,
      suggestion: "Shorten the title or move detail into the caption.",
    },
  ];
}

function checkAxisTitles({ spec, specType }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    const encoding = getObject(unit.spec, "encoding");

    for (const channelName of ["x", "y"] as const) {
      const channel = encoding ? getObject(encoding, channelName) : undefined;

      if (!channel || typeof channel.field !== "string") {
        continue;
      }

      if (hasExplicitTitle(channel)) {
        continue;
      }

      issues.push({
        severity: "warning",
        ruleId: "axis-title-missing",
        path: joinJsonPath(unit.path, `encoding.${channelName}`),
        message: `${channelName.toUpperCase()} axis is missing a title.`,
        suggestion: `Add encoding.${channelName}.title.`,
      });
    }
  }

  return issues;
}

function checkSizePresence({ spec }: LintRuleContext): LintIssue[] {
  const missing = ["width", "height"].filter((key) => spec[key] === undefined);

  if (missing.length === 0) {
    return [];
  }

  const missingKey = missing[0] as string;
  const message =
    missing.length === 2
      ? "Width and height are missing."
      : `${capitalize(missingKey)} is missing.`;

  return [
    {
      severity: "warning",
      ruleId: "size-missing",
      path: "$",
      message,
      suggestion: "Set explicit width and height for reproducible paper figures.",
    },
  ];
}

function checkSizeRange({ spec, profile }: LintRuleContext): LintIssue[] {
  const issues: LintIssue[] = [];
  const width = getNumber(spec, "width");
  const height = getNumber(spec, "height");

  if (width !== undefined && (width < profile.widthRange.min || width > profile.widthRange.max)) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.width",
      message: `Width ${width} is outside the ${profile.name} range ${profile.widthRange.min}-${profile.widthRange.max}.`,
      suggestion: "Choose a width that fits the target output.",
    });
  }

  if (
    height !== undefined &&
    (height < profile.heightRange.min || height > profile.heightRange.max)
  ) {
    issues.push({
      severity: "warning",
      ruleId: "size-out-of-range",
      path: "$.height",
      message: `Height ${height} is outside the ${profile.name} range ${profile.heightRange.min}-${profile.heightRange.max}.`,
      suggestion: "Choose a height that keeps labels readable without wasting space.",
    });
  }

  return issues;
}

function checkInlineDataSize({ spec, profile }: LintRuleContext): LintIssue[] {
  const values = getInlineDataValues(spec);

  if (!values || values.length <= profile.maxInlineRows) {
    return [];
  }

  return [
    {
      severity: "warning",
      ruleId: "inline-data-large",
      path: "$.data.values",
      message: `Inline data has ${values.length} rows.`,
      suggestion: "Use external data or pre-aggregate before rendering.",
    },
  ];
}

function checkLegendCategoryCount({ spec, specType, profile }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    const encoding = getObject(unit.spec, "encoding");
    const color = encoding ? getObject(encoding, "color") : undefined;
    const field = typeof color?.field === "string" ? color.field : undefined;
    const values = getLegendCategoryValues(unit.spec, rootValues);

    if (!field || !values) {
      continue;
    }

    const categories = new Set<string>();

    for (const row of values) {
      if (!isPlainObject(row)) {
        continue;
      }

      const value = row[field];

      if (typeof value === "string" || typeof value === "number") {
        categories.add(String(value));
      }
    }

    if (categories.size <= profile.maxColorCategories) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: joinJsonPath(unit.path, "encoding.color"),
      message: `Color field "${field}" has ${categories.size} categories.`,
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  }

  return issues;
}

function checkFontSizes({ spec, profile }: LintRuleContext): LintIssue[] {
  const checks = [
    "$.config.axis.labelFontSize",
    "$.config.axis.titleFontSize",
    "$.config.legend.labelFontSize",
    "$.config.legend.titleFontSize",
  ];

  return checks.flatMap((path) => {
    const value = getPathNumber(spec, path);

    if (value === undefined || value >= profile.minFontSize) {
      return [];
    }

    return [
      {
        severity: "warning",
        ruleId: "font-size-small",
        path,
        message: `Font size ${value} is smaller than ${profile.minFontSize}.`,
        suggestion: `Use font sizes of at least ${profile.minFontSize} for ${profile.name} figures.`,
      },
    ];
  });
}

function checkBarYAxisZero({ spec, specType }: LintRuleContext): LintIssue[] {
  if (specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (!isBarMark(unit.spec.mark)) {
      continue;
    }

    const encoding = getObject(unit.spec, "encoding");
    const y = encoding ? getObject(encoding, "y") : undefined;

    if (y?.type !== "quantitative") {
      continue;
    }

    const scale = getObject(y, "scale");

    if (scale?.zero === true) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: joinJsonPath(unit.path, "encoding.y.scale"),
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    });
  }

  return issues;
}

function checkGrayscaleUnsafeColors({ spec, profile }: LintRuleContext): LintIssue[] {
  if (!profile.grayscaleSafe) {
    return [];
  }

  const issues: LintIssue[] = [];

  for (const { path, color } of collectExplicitColors(spec)) {
    if (isGrayscaleColor(color)) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "grayscale-unsafe-color",
      path,
      message: `Color "${color}" is not grayscale-safe.`,
      suggestion:
        "Use gray values, add strokeDash/shape encodings, or render with monochrome-print.",
    });
  }

  return issues;
}

function checkColorOnlySeriesDistinction({
  spec,
  specType,
  profile,
}: LintRuleContext): LintIssue[] {
  if (!profile.grayscaleSafe || specType !== "vega-lite") {
    return [];
  }

  const issues: LintIssue[] = [];
  const rootValues = getInlineDataValues(spec);

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (!isLineMark(unit.spec.mark) && !isBarMark(unit.spec.mark)) {
      continue;
    }

    const encoding = getObject(unit.spec, "encoding");
    const color = encoding ? getObject(encoding, "color") : undefined;
    const field = typeof color?.field === "string" ? color.field : undefined;

    if (!field) {
      continue;
    }

    if (hasSeriesDistinctionBeyondColor(encoding)) {
      continue;
    }

    const values = getLegendCategoryValues(unit.spec, rootValues);

    if (!values || countDistinctFieldValues(values, field) < 2) {
      continue;
    }

    issues.push({
      severity: "warning",
      ruleId: "color-only-series",
      path: joinJsonPath(unit.path, "encoding.color"),
      message: `Series differ only by color field "${field}".`,
      suggestion:
        "Add strokeDash or shape encoding, facet, or use monochrome-print with fewer series.",
    });
  }

  return issues;
}

type ExplicitColor = {
  path: string;
  color: string;
};

function collectExplicitColors(spec: JsonObject): ExplicitColor[] {
  const colors: ExplicitColor[] = [];
  const config = getObject(spec, "config");
  const range = config ? getObject(config, "range") : undefined;
  const categoryRange = range?.category;

  if (Array.isArray(categoryRange)) {
    for (const [index, value] of categoryRange.entries()) {
      if (typeof value === "string") {
        colors.push({ path: `$.config.range.category[${index}]`, color: value });
      }
    }
  }

  for (const unit of collectVegaLiteUnitSpecs(spec)) {
    if (isPlainObject(unit.spec.mark) && typeof unit.spec.mark.color === "string") {
      colors.push({
        path: joinJsonPath(unit.path, "mark.color"),
        color: unit.spec.mark.color,
      });
    }

    const encoding = getObject(unit.spec, "encoding");
    const color = encoding ? getObject(encoding, "color") : undefined;

    if (typeof color?.value === "string") {
      colors.push({
        path: joinJsonPath(unit.path, "encoding.color.value"),
        color: color.value,
      });
    }
  }

  return colors;
}

function hasSeriesDistinctionBeyondColor(encoding: JsonObject | undefined): boolean {
  if (!encoding) {
    return false;
  }

  for (const channelName of ["strokeDash", "shape", "strokeWidth", "opacity"] as const) {
    const channel = getObject(encoding, channelName);

    if (channel && typeof channel.field === "string") {
      return true;
    }
  }

  return false;
}

function countDistinctFieldValues(values: unknown[], field: string): number {
  const categories = new Set<string>();

  for (const row of values) {
    if (!isPlainObject(row)) {
      continue;
    }

    const value = row[field];

    if (typeof value === "string" || typeof value === "number") {
      categories.add(String(value));
    }
  }

  return categories.size;
}

function isGrayscaleColor(color: string): boolean {
  const rgb = parseRgbComponents(color);

  if (!rgb) {
    return true;
  }

  const maxDiff = Math.max(
    Math.abs(rgb.r - rgb.g),
    Math.abs(rgb.g - rgb.b),
    Math.abs(rgb.r - rgb.b),
  );

  return maxDiff <= 16;
}

function parseRgbComponents(color: string): { r: number; g: number; b: number } | undefined {
  const trimmed = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(trimmed);

  if (shortHex) {
    const [r, g, b] = shortHex[1] as string;

    return {
      r: Number.parseInt(`${r}${r}`, 16),
      g: Number.parseInt(`${g}${g}`, 16),
      b: Number.parseInt(`${b}${b}`, 16),
    };
  }

  const longHex = /^#([0-9a-f]{6})$/i.exec(trimmed);

  if (longHex) {
    const hex = longHex[1] as string;

    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(trimmed);

  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    };
  }

  return undefined;
}

function isLineMark(mark: unknown): boolean {
  if (mark === "line") {
    return true;
  }

  return isPlainObject(mark) && mark.type === "line";
}

function getInlineDataValues(spec: JsonObject): unknown[] | undefined {
  const data = getObject(spec, "data");
  return Array.isArray(data?.values) ? data.values : undefined;
}

function hasDataDefinition(spec: JsonObject): boolean {
  return spec.data !== undefined;
}

function getLegendCategoryValues(
  unitSpec: JsonObject,
  rootValues: unknown[] | undefined,
): unknown[] | undefined {
  const unitValues = getInlineDataValues(unitSpec);

  if (unitValues) {
    return unitValues;
  }

  return hasDataDefinition(unitSpec) ? undefined : rootValues;
}

function collectVegaLiteUnitSpecs(rootSpec: JsonObject): VegaLiteUnitSpec[] {
  const units: VegaLiteUnitSpec[] = [];
  const visit = (spec: JsonObject, path: string) => {
    if (isVegaLiteUnitSpec(spec)) {
      units.push({ spec, path });
    }

    visitArrayChildren(spec, "layer", path, visit);
    visitObjectChild(spec, "spec", path, visit);
    visitArrayChildren(spec, "concat", path, visit);
    visitArrayChildren(spec, "hconcat", path, visit);
    visitArrayChildren(spec, "vconcat", path, visit);
  };

  visit(rootSpec, "$");
  return units;
}

function visitArrayChildren(
  spec: JsonObject,
  key: string,
  parentPath: string,
  visit: (spec: JsonObject, path: string) => void,
): void {
  const value = spec[key];

  if (!Array.isArray(value)) {
    return;
  }

  for (const [index, child] of value.entries()) {
    if (isPlainObject(child)) {
      visit(child, `${parentPath}.${key}[${index}]`);
    }
  }
}

function visitObjectChild(
  spec: JsonObject,
  key: string,
  parentPath: string,
  visit: (spec: JsonObject, path: string) => void,
): void {
  const child = getObject(spec, key);

  if (child) {
    visit(child, joinJsonPath(parentPath, key));
  }
}

function isVegaLiteUnitSpec(spec: JsonObject): boolean {
  return isPlainObject(spec.encoding) || spec.mark !== undefined;
}

function joinJsonPath(parentPath: string, childPath: string): string {
  return parentPath === "$" ? `$.${childPath}` : `${parentPath}.${childPath}`;
}

function getObject(value: JsonObject, key: string): JsonObject | undefined {
  const child = value[key];
  return isPlainObject(child) ? child : undefined;
}

function getNumber(value: JsonObject, key: string): number | undefined {
  return typeof value[key] === "number" ? value[key] : undefined;
}

function getPathNumber(spec: JsonObject, path: string): number | undefined {
  const segments = path.replace(/^\$\./, "").split(".");
  let current: unknown = spec;

  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return typeof current === "number" ? current : undefined;
}

function getTitleText(title: unknown): string | undefined {
  if (typeof title === "string") {
    return title;
  }

  if (Array.isArray(title) && title.every((part) => typeof part === "string")) {
    return title.join(" ");
  }

  if (isPlainObject(title)) {
    return getTitleText(title.text);
  }

  return undefined;
}

function hasExplicitTitle(channel: JsonObject): boolean {
  const channelTitle = getTitleText(channel.title);

  if (channelTitle !== undefined && channelTitle.trim() !== "") {
    return true;
  }

  const axis = getObject(channel, "axis");
  const axisTitle = axis ? getTitleText(axis.title) : undefined;

  return axisTitle !== undefined && axisTitle.trim() !== "";
}

function isBarMark(mark: unknown): boolean {
  if (mark === "bar") {
    return true;
  }

  return isPlainObject(mark) && mark.type === "bar";
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
