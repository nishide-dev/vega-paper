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

export type LintRequest = {
  inputPath: string;
};
