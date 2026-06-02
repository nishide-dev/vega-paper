import { VegaPaperError } from "./errors";

export type LintProfileName = "paper" | "web" | "acl";

export type LintProfile = {
  name: LintProfileName;
  titleMaxLength: number;
  widthRange: { min: number; max: number };
  heightRange: { min: number; max: number };
  maxInlineRows: number;
  maxColorCategories: number;
  minFontSize: number;
};

export const DEFAULT_LINT_PROFILE_NAME: LintProfileName = "paper";

const LINT_PROFILE_ORDER: LintProfileName[] = ["paper", "web", "acl"];

export const LINT_PROFILES: Record<LintProfileName, LintProfile> = {
  paper: {
    name: "paper",
    titleMaxLength: 90,
    widthRange: { min: 180, max: 720 },
    heightRange: { min: 120, max: 540 },
    maxInlineRows: 500,
    maxColorCategories: 12,
    minFontSize: 8,
  },
  web: {
    name: "web",
    titleMaxLength: 120,
    widthRange: { min: 240, max: 1200 },
    heightRange: { min: 160, max: 800 },
    maxInlineRows: 1000,
    maxColorCategories: 20,
    minFontSize: 10,
  },
  acl: {
    name: "acl",
    titleMaxLength: 70,
    widthRange: { min: 240, max: 480 },
    heightRange: { min: 160, max: 360 },
    maxInlineRows: 300,
    maxColorCategories: 8,
    minFontSize: 9,
  },
};

export function getLintProfile(
  profileName: string | undefined = DEFAULT_LINT_PROFILE_NAME,
): LintProfile {
  if (isLintProfileName(profileName)) {
    return LINT_PROFILES[profileName];
  }

  throw new VegaPaperError(
    `Unknown lint profile "${profileName}". Expected one of: ${listLintProfileNames().join(", ")}.`,
  );
}

export function listLintProfileNames(): LintProfileName[] {
  return [...LINT_PROFILE_ORDER];
}

function isLintProfileName(value: string): value is LintProfileName {
  return Object.prototype.hasOwnProperty.call(LINT_PROFILES, value);
}
