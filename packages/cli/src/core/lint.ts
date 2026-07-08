import { VegaPaperError } from "./errors";
import { getLintProfile } from "./lint-profiles";
import { runLintRules } from "./lint-rules";
import { detectSpecType, loadJsonSpec } from "./spec";

export type LintSeverity = "error" | "warning";

export type LintIssue = {
  severity: LintSeverity;
  ruleId: string;
  path: string;
  message: string;
  suggestion?: string;
};

export type LintResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
};

export type LintDomain = "ml";

const LINT_DOMAINS: LintDomain[] = ["ml"];

export function parseLintDomain(value: string): LintDomain {
  if ((LINT_DOMAINS as string[]).includes(value)) {
    return value as LintDomain;
  }

  throw new VegaPaperError(
    `Unknown lint domain "${value}". Expected one of: ${LINT_DOMAINS.join(", ")}.`,
  );
}

export type LintRequest = {
  inputPath: string;
  profileName?: string | undefined;
  domain?: LintDomain | undefined;
};

export async function lintSpec(request: LintRequest): Promise<LintResult> {
  const profile = getLintProfile(request.profileName);
  let spec: Awaited<ReturnType<typeof loadJsonSpec>>;

  try {
    spec = await loadJsonSpec(request.inputPath);
  } catch (error) {
    if (error instanceof VegaPaperError) {
      return createLintResult([
        {
          severity: "error",
          ruleId: "spec-unreadable",
          path: "$",
          message: `Could not read ${request.inputPath}: ${error.message}`,
          suggestion: "Provide a readable JSON object file.",
        },
      ]);
    }

    throw error;
  }

  let specType: ReturnType<typeof detectSpecType>;

  try {
    specType = detectSpecType(spec);
  } catch (error) {
    if (error instanceof VegaPaperError) {
      return createLintResult([
        {
          severity: "error",
          ruleId: "spec-unknown-type",
          path: "$",
          message: "Could not determine whether the input is Vega-Lite or Vega.",
          suggestion:
            "Add a Vega/Vega-Lite $schema or recognizable mark/encoding or marks/scales fields.",
        },
      ]);
    }

    throw error;
  }

  return createLintResult(
    runLintRules({
      inputPath: request.inputPath,
      spec,
      specType,
      profile,
      domain: request.domain,
    }),
  );
}

export function createLintResult(issues: LintIssue[]): LintResult {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}
