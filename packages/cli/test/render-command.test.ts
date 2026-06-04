import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerRenderCommand } from "../src/commands/render";
import type { RenderRequest, RenderResult } from "../src/core/render";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("render command", () => {
  test("writes sibling figure meta after a successful render", async () => {
    const workspace = await createWorkspace();
    const inputPath = "chart.vl.json";
    const outputPath = join(workspace, "figures", "f1.svg");
    const metaOutputPath = join(workspace, "figures", "f1.meta.json");
    const renderCalls: RenderRequest[] = [];

    const { stdout } = await runRenderCommand(["render", inputPath, "--out", outputPath], {
      render: async (request) => {
        renderCalls.push(request);
        return { outputPath: request.outputPath, warnings: [] };
      },
    });

    const meta = (await readMeta(metaOutputPath)) as Record<string, unknown>;

    expect(renderCalls).toEqual([
      {
        inputPath,
        outputPath,
        format: "svg",
        scale: 1,
        themeName: undefined,
      },
    ]);
    expect(stdout).toContain(`Rendered ${outputPath}`);
    expect(stdout).toContain(`Wrote ${metaOutputPath}`);
    expect(meta.command).toBe("render");
    expect(meta.input).toBe(inputPath);
    expect(meta.output).toBe(outputPath);
    expect(meta.specOut).toBeUndefined();
    expect(meta.infer).toBeUndefined();
    expect(meta.format).toBe("svg");
  });

  test("includes theme in figure meta when --theme is provided", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figure.svg");
    const metaOutputPath = join(workspace, "figure.meta.json");

    await runRenderCommand(
      ["render", "chart.vl.json", "--theme", "paper-clean", "--out", outputPath],
      {
        render: async (request) => ({ outputPath: request.outputPath, warnings: [] }),
      },
    );

    const meta = (await readMeta(metaOutputPath)) as { theme?: string };
    expect(meta.theme).toBe("paper-clean");
  });

  test("does not write figure meta when render fails", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figure.svg");
    const metaOutputPath = join(workspace, "figure.meta.json");

    await expect(
      runRenderCommand(["render", "chart.vl.json", "--out", outputPath], {
        render: async () => {
          throw new Error("render failed");
        },
      }),
    ).rejects.toThrow("render failed");

    await expect(access(metaOutputPath)).rejects.toThrow();
  });
});

type RenderCommandHarness = {
  render?: (request: RenderRequest) => Promise<RenderResult>;
  writeFigureMeta?: (metaOutputPath: string, meta: unknown) => Promise<void>;
};

async function runRenderCommand(
  args: string[],
  harness: RenderCommandHarness = {},
): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerRenderCommand(
    program,
    (value) => {
      stdout += value;
    },
    harness.render,
    harness.writeFigureMeta,
  );

  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-render-command-"));
  temporaryDirectories.push(workspace);
  return workspace;
}

async function readMeta(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
