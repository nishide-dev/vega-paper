import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderWithExternalVegaCli, resolveVegaCliBinary } from "../src/backends/external-vega-cli";

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
      'Missing Vega CLI binary "vl2svg". Install vega-paper via install.sh or ensure vl2svg is on PATH.',
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
    ).rejects.toThrow('Vega CLI binary "vg2svg" failed with exit code 2.\nbad spec');
  });

  test("resolves Vega-Lite binary from Bun's package store layout", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      await createExecutable(
        join(workspace, "node_modules", ".bun", "node_modules", "vega-lite", "bin", "vl2svg"),
        "#!/bin/sh\nexit 0\n",
      );

      await renderWithExternalVegaCli({
        specType: "vega-lite",
        inputPath: "spec.vl.json",
        outputPath: "chart.svg",
        format: "svg",
      });
    });
  });

  test("resolves Vega-Lite binary from Bun's versioned package store layout", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      await createExecutable(
        join(
          workspace,
          "node_modules",
          ".bun",
          "vega-lite@6.4.3+hash",
          "node_modules",
          "vega-lite",
          "bin",
          "vl2svg",
        ),
        "#!/bin/sh\nexit 0\n",
      );

      await renderWithExternalVegaCli({
        specType: "vega-lite",
        inputPath: "spec.vl.json",
        outputPath: "chart.svg",
        format: "svg",
      });
    });
  });

  test("resolves local node_modules bin before Bun package-store bins", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const localBinary = join(workspace, "node_modules", ".bin", "vl2svg");
      await createExecutable(localBinary, "#!/bin/sh\nexit 0\n");
      await createExecutable(
        join(workspace, "node_modules", ".bun", "node_modules", "vega-lite", "bin", "vl2svg"),
        "#!/bin/sh\nexit 0\n",
      );

      expect(await resolveVegaCliBinary("vl2svg")).toBe(localBinary);
    });
  });

  test("returns undefined when a Vega CLI binary is not resolvable", async () => {
    await withTemporaryWorkspace(async () => {
      expect(await resolveVegaCliBinary("vl2svg")).toBeUndefined();
    });
  });

  test("resolves Vega-Lite binary from install bin before cwd node_modules", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const originalHome = process.env.VEGA_PAPER_HOME;
      process.env.VEGA_PAPER_HOME = join(workspace, "home");

      try {
        const installBinary = join(workspace, "home", "node_modules", ".bin", "vl2svg");
        const cwdBinary = join(workspace, "node_modules", ".bin", "vl2svg");
        await createExecutable(installBinary, "#!/bin/sh\nexit 0\n");
        await createExecutable(cwdBinary, "#!/bin/sh\nexit 1\n");

        expect(await resolveVegaCliBinary("vl2svg")).toBe(installBinary);
      } finally {
        if (originalHome === undefined) {
          delete process.env.VEGA_PAPER_HOME;
        } else {
          process.env.VEGA_PAPER_HOME = originalHome;
        }
      }
    });
  });
});

async function withTemporaryWorkspace<T>(callback: (workspace: string) => Promise<T>): Promise<T> {
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
