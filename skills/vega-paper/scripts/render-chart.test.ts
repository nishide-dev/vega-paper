import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { resolveCliEntry } from "./cli";
import { buildRenderChartCommand, parseRenderChartArgs, runRenderChart } from "./render-chart";

const REPO_ROOT = "/repo";

describe("buildRenderChartCommand", () => {
  test("uses default paper-clean theme and svg format", () => {
    expect(
      buildRenderChartCommand(REPO_ROOT, {
        specPath: "figures/f1.vl.json",
        outPath: "figures/f1.svg",
        theme: "paper-clean",
      }),
    ).toEqual([
      "bun",
      resolveCliEntry(REPO_ROOT),
      "render",
      "figures/f1.vl.json",
      "--theme",
      "paper-clean",
      "--format",
      "svg",
      "--out",
      "figures/f1.svg",
    ]);
  });

  test("passes custom theme", () => {
    expect(
      buildRenderChartCommand(REPO_ROOT, {
        specPath: "chart.vl.json",
        outPath: "out.svg",
        theme: "acl-clean",
      }),
    ).toEqual([
      "bun",
      resolveCliEntry(REPO_ROOT),
      "render",
      "chart.vl.json",
      "--theme",
      "acl-clean",
      "--format",
      "svg",
      "--out",
      "out.svg",
    ]);
  });
});

describe("parseRenderChartArgs", () => {
  test("parses required out path and defaults", () => {
    expect(parseRenderChartArgs(["chart.vl.json", "--out", "out.svg"])).toEqual({
      specPath: "chart.vl.json",
      outPath: "out.svg",
      theme: "paper-clean",
    });
  });

  test("parses custom theme", () => {
    expect(
      parseRenderChartArgs(["chart.vl.json", "--out", "out.svg", "--theme", "monochrome-print"]),
    ).toEqual({
      specPath: "chart.vl.json",
      outPath: "out.svg",
      theme: "monochrome-print",
    });
  });
});

describe("runRenderChart", () => {
  test("delegates exit code from spawned CLI", async () => {
    const calls: Array<{ command: string[]; cwd: string }> = [];

    const exitCode = await runRenderChart(
      {
        specPath: "chart.vl.json",
        outPath: "out.svg",
        theme: "paper-clean",
      },
      (command, options) => {
        calls.push({ command, cwd: options.cwd });
        return { exited: Promise.resolve(0) };
      },
      REPO_ROOT,
    );

    expect(exitCode).toBe(0);
    expect(calls[0]?.cwd).toBe(REPO_ROOT);
    expect(calls[0]?.command).toEqual(
      buildRenderChartCommand(REPO_ROOT, {
        specPath: "chart.vl.json",
        outPath: "out.svg",
        theme: "paper-clean",
      }),
    );
  });
});

describe("resolveCliEntry", () => {
  test("points at packages/cli entry from repo root", () => {
    expect(resolveCliEntry(REPO_ROOT)).toBe(join(REPO_ROOT, "packages/cli/src/index.ts"));
  });
});
