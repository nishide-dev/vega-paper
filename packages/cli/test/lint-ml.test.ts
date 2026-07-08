import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerLintCommand } from "../src/commands/lint";
import type { LintDomain, LintResult } from "../src/core/lint";
import { lintSpec, parseLintDomain } from "../src/core/lint";
import { loadLintDataRows } from "../src/core/lint-data";
import { getLintProfile, type LintProfileName } from "../src/core/lint-profiles";
import { runLintRules } from "../src/core/lint-rules";
import type { JsonObject } from "../src/core/spec";

describe("parseLintDomain", () => {
  test("accepts ml", () => {
    expect(parseLintDomain("ml")).toBe("ml");
  });

  test("throws a CLI error for unknown domains", () => {
    expect(() => parseLintDomain("web")).toThrow('Unknown lint domain "web". Expected one of: ml.');
  });
});

describe("lint command --domain", () => {
  test("passes domain to the lint runner", async () => {
    let receivedDomain: LintDomain | undefined;

    const output = await runLintCommandWithRunner(
      ["lint", "chart.vl.json", "--profile", "paper", "--domain", "ml"],
      async (_inputPath, _profileName, domain) => {
        receivedDomain = domain;
        return cleanLintResult();
      },
    );

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
    expect(receivedDomain).toBe("ml");
  });

  test("passes undefined domain when --domain is omitted", async () => {
    let receivedDomain: LintDomain | undefined = "ml";

    await runLintCommandWithRunner(["lint", "chart.vl.json"], async (_input, _profile, domain) => {
      receivedDomain = domain;
      return cleanLintResult();
    });

    expect(receivedDomain).toBeUndefined();
  });

  test("propagates unknown domain errors", async () => {
    try {
      await runLintCommandWithRunner(["lint", "chart.vl.json", "--domain", "nlp"], async () =>
        cleanLintResult(),
      );
      throw new Error("Expected command to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Unknown lint domain "nlp". Expected one of: ml.');
    }
  });
});

describe("lintSpec with domain", () => {
  test("domain ml does not change results for a clean single-view spec", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec());

      const defaultResult = await lintSpec({ inputPath });
      const mlResult = await lintSpec({ inputPath, domain: "ml" });

      expect(defaultResult.issues).toEqual([]);
      expect(mlResult).toEqual(defaultResult);
    });
  });
});

describe("ml-panel-label-missing", () => {
  test("warns for each unlabeled panel in a 2-panel hconcat", () => {
    const spec = multiPanelSpec("hconcat", ["Training", "Ablation"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([
      {
        severity: "warning",
        ruleId: "ml-panel-label-missing",
        path: "$.hconcat[0].title",
        message: 'Panel 1 in "hconcat" has no "(a)"-style label in its title.',
        suggestion:
          'Prefix each panel title with "(a)", "(b)", ... so captions can reference panels.',
      },
      {
        severity: "warning",
        ruleId: "ml-panel-label-missing",
        path: "$.hconcat[1].title",
        message: 'Panel 2 in "hconcat" has no "(a)"-style label in its title.',
        suggestion:
          'Prefix each panel title with "(a)", "(b)", ... so captions can reference panels.',
      },
    ]);
  });

  test("accepts panels with (a)-style labels", () => {
    const spec = multiPanelSpec("hconcat", ["(a) Training", "(b) Ablation"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([]);
  });

  test("warns only for the unlabeled panel", () => {
    const spec = multiPanelSpec("vconcat", ["(a) Training", "Ablation"]);

    expect(
      mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing").map(
        (issue) => issue.path,
      ),
    ).toEqual(["$.vconcat[1].title"]);
  });

  test("warns for panels without any title", () => {
    const spec = multiPanelSpec("concat", [undefined, undefined]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toHaveLength(2);
  });

  test("does not warn for a single panel", () => {
    const spec = multiPanelSpec("hconcat", ["Training"]);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-panel-label-missing")).toEqual([]);
  });

  test("does not run without domain ml", () => {
    const spec = multiPanelSpec("hconcat", ["Training", "Ablation"]);

    expect(mlIssues(runMlRules(spec), "ml-panel-label-missing")).toEqual([]);
  });
});

describe("ml-crowded-labels", () => {
  test("warns when a text mark labels more rows than the paper threshold", () => {
    const spec = textLabelSpec(21);

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([
      {
        severity: "warning",
        ruleId: "ml-crowded-labels",
        path: "$.layer[1].encoding.text",
        message: "Text mark labels 21 rows; more than 20 labels crowd a paper figure.",
        suggestion: "Label only top-k points, aggregate the data, or drop the text layer.",
      },
    ]);
  });

  test("does not warn at the threshold boundary", () => {
    expect(mlIssues(runMlRules(textLabelSpec(20), { domain: "ml" }), "ml-crowded-labels")).toEqual(
      [],
    );
  });

  test("uses profile-specific text label thresholds", () => {
    const spec = textLabelSpec(16);

    expect(
      mlIssues(runMlRules(spec, { domain: "ml", profileName: "acl" }), "ml-crowded-labels"),
    ).toHaveLength(1);
    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([]);
  });

  test("ignores text channels on non-text marks", () => {
    const spec = textLabelSpec(21);
    const layer = spec.layer as JsonObject[];
    (layer[1] as JsonObject).mark = "point";

    expect(mlIssues(runMlRules(spec, { domain: "ml" }), "ml-crowded-labels")).toEqual([]);
  });

  test("does not run without domain ml", () => {
    expect(mlIssues(runMlRules(textLabelSpec(21)), "ml-crowded-labels")).toEqual([]);
  });
});

describe("loadLintDataRows", () => {
  test("loads CSV rows relative to the spec file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await writeFile(
        join(workspacePath, "data.csv"),
        "model,score\nbaseline,71.2\nours,74.8\n",
        "utf8",
      );

      const rows = await loadLintDataRows({ data: { url: "data.csv" } }, specPath);

      expect(rows).toEqual([
        { model: "baseline", score: "71.2" },
        { model: "ours", score: "74.8" },
      ]);
    });
  });

  test("resolves subdirectory urls relative to the spec file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await mkdir(join(workspacePath, "data"), { recursive: true });
      await writeFile(join(workspacePath, "data", "rows.csv"), "model,score\nours,74.8\n", "utf8");

      const rows = await loadLintDataRows({ data: { url: "data/rows.csv" } }, specPath);

      expect(rows).toEqual([{ model: "ours", score: "74.8" }]);
    });
  });

  test("returns undefined for a missing CSV file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");

      expect(await loadLintDataRows({ data: { url: "missing.csv" } }, specPath)).toBeUndefined();
    });
  });

  test("returns undefined for an unparsable CSV file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");
      await writeFile(join(workspacePath, "data.csv"), "", "utf8");

      expect(await loadLintDataRows({ data: { url: "data.csv" } }, specPath)).toBeUndefined();
    });
  });

  test("ignores non-csv, remote, and inline data definitions", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const specPath = join(workspacePath, "chart.vl.json");

      expect(await loadLintDataRows({ data: { url: "data.json" } }, specPath)).toBeUndefined();
      expect(
        await loadLintDataRows({ data: { url: "https://example.com/data.csv" } }, specPath),
      ).toBeUndefined();
      expect(await loadLintDataRows({ data: { values: [] } }, specPath)).toBeUndefined();
      expect(await loadLintDataRows({}, specPath)).toBeUndefined();
    });
  });
});

describe("lintSpec data loading degrades gracefully", () => {
  test("missing data.url file produces no errors under domain ml", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec({ data: { url: "missing.csv" } }));

      const result = await lintSpec({ inputPath, domain: "ml" });

      expect(result.errorCount).toBe(0);
      expect(result.issues.map((issue) => issue.ruleId)).not.toContain("spec-unreadable");
    });
  });
});

// --- helpers -------------------------------------------------------------

function runMlRules(
  spec: JsonObject,
  options: {
    profileName?: LintProfileName;
    domain?: LintDomain;
    externalDataRows?: JsonObject[];
  } = {},
) {
  return runLintRules({
    inputPath: "chart.vl.json",
    spec,
    specType: "vega-lite",
    profile: getLintProfile(options.profileName ?? "paper"),
    domain: options.domain,
    externalDataRows: options.externalDataRows,
  });
}

function mlIssues(issues: ReturnType<typeof runMlRules>, ruleId: string) {
  return issues.filter((issue) => issue.ruleId === ruleId);
}

function cleanVegaLiteSpec(overrides: JsonObject = {}): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title: "Accuracy by epoch",
    width: 360,
    height: 240,
    data: {
      values: [
        { epoch: 1, accuracy: 0.62, model: "baseline" },
        { epoch: 2, accuracy: 0.68, model: "baseline" },
      ],
    },
    mark: "line",
    encoding: {
      x: { field: "epoch", type: "quantitative", title: "Epoch" },
      y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      color: { field: "model", type: "nominal", title: "Model" },
    },
    ...overrides,
  };
}

function multiPanelSpec(
  key: "hconcat" | "vconcat" | "concat",
  titles: (string | undefined)[],
): JsonObject {
  const spec = cleanVegaLiteSpec({
    [key]: titles.map((title) => ({
      ...(title === undefined ? {} : { title }),
      mark: "line",
      encoding: {
        x: { field: "epoch", type: "quantitative", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      },
    })),
  });
  delete spec.mark;
  delete spec.encoding;
  return spec;
}

function textLabelSpec(rowCount: number): JsonObject {
  const spec = cleanVegaLiteSpec({
    data: {
      values: Array.from({ length: rowCount }, (_, index) => ({
        latency: index + 1,
        score: index / 100,
        model: `model-${index}`,
      })),
    },
    layer: [
      {
        mark: "point",
        encoding: {
          x: { field: "latency", type: "quantitative", title: "Latency" },
          y: { field: "score", type: "quantitative", title: "Score" },
        },
      },
      {
        mark: { type: "text", dy: -8 },
        encoding: {
          x: { field: "latency", type: "quantitative", title: "Latency" },
          y: { field: "score", type: "quantitative", title: "Score" },
          text: { field: "model", type: "nominal" },
        },
      },
    ],
  });
  delete spec.mark;
  delete spec.encoding;
  return spec;
}

async function withTemporaryWorkspace(callback: (workspacePath: string) => Promise<void>) {
  const workspacePath = await mkdtemp(join(tmpdir(), "vega-paper-lint-ml-test-"));

  try {
    await callback(workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), "utf8");
}

function cleanLintResult(): LintResult {
  return { ok: true, errorCount: 0, warningCount: 0, issues: [] };
}

async function runLintCommandWithRunner(
  args: string[],
  runLint: (
    inputPath: string,
    profileName: string | undefined,
    domain: LintDomain | undefined,
  ) => Promise<LintResult>,
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  let stdout = "";
  let exitCode: 0 | 1 | undefined;
  const program = new Command();

  program.exitOverride();

  registerLintCommand(
    program,
    (value) => {
      stdout += value;
    },
    runLint,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}
