import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderWithExternalVegaCli } from "../src/backends/external-vega-cli";

describe("renderWithExternalVegaCli", () => {
  test("reports a missing Vega-Lite CLI binary", async () => {
    await expect(
      withTemporaryWorkspace(async () => {
        await renderWithExternalVegaCli({
          specType: "vega-lite",
          inputPath: "spec.vl.json",
          outputPath: "chart.svg",
          format: "svg",
        });
      }),
    ).rejects.toThrow(
      'Missing Vega CLI binary "vl2svg". Run "bun install" in this workspace and ensure node_modules/.bin is available.',
    );
  });

  test("includes stderr when the Vega CLI binary exits non-zero", async () => {
    await expect(
      withTemporaryWorkspace(async (workspace) => {
        await createExecutable(
          join(workspace, "node_modules", ".bin", "vg2svg"),
          "#!/bin/sh\necho bad spec >&2\nexit 2\n",
        );

        await renderWithExternalVegaCli({
          specType: "vega",
          inputPath: "spec.vg.json",
          outputPath: "chart.svg",
          format: "svg",
        });
      }),
    ).rejects.toThrow(
      'Vega CLI binary "vg2svg" failed with exit code 2.\nbad spec',
    );
  });
});

async function withTemporaryWorkspace<T>(
  callback: (workspace: string) => Promise<T>,
): Promise<T> {
  const previousCwd = process.cwd();
  const previousPath = process.env.PATH;
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-cli-test-"));

  process.chdir(workspace);
  process.env.PATH = "";

  try {
    return await callback(workspace);
  } finally {
    process.chdir(previousCwd);
    process.env.PATH = previousPath;
  }
}

async function createExecutable(path: string, contents: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, contents, { encoding: "utf8", mode: 0o755 });
}
