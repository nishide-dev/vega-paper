import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveThemeRef } from "../src/resolve-theme";

const workspace = join(import.meta.dir, ".tmp-resolve-theme");

describe("resolveThemeRef", () => {
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("resolves built-in theme by name", async () => {
    const theme = await resolveThemeRef("paper-clean");

    expect(theme.name).toBe("paper-clean");
  });

  test("resolves a theme file by relative path", async () => {
    const themePath = await writeThemeFile("lab.json", {
      config: { background: "white" },
    });
    const theme = await resolveThemeRef("lab.json", { cwd: workspace });

    expect(theme.name).toBe("lab");
    expect(theme.config).toEqual({ background: "white" });
    expect(themePath).toContain("lab.json");
  });

  test("prefers a theme file over a built-in when names collide", async () => {
    await writeThemeFile("paper-clean.json", {
      name: "paper-clean",
      config: { background: "pink" },
    });
    const theme = await resolveThemeRef("paper-clean.json", { cwd: workspace });

    expect(theme.config).toEqual({ background: "pink" });
  });

  test("rejects unknown theme references", async () => {
    await expect(resolveThemeRef("missing-theme", { cwd: workspace })).rejects.toThrow(
      'Unknown theme "missing-theme"',
    );
  });
});

async function writeThemeFile(filename: string, contents: unknown): Promise<string> {
  await mkdir(workspace, { recursive: true });
  const themePath = join(workspace, filename);
  await writeFile(themePath, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  return themePath;
}
