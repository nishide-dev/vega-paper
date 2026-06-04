import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadThemeFromFile } from "../src/load-theme-file";

const workspace = join(import.meta.dir, ".tmp-load-theme");

describe("loadThemeFromFile", () => {
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("loads a minimal theme with inferred metadata", async () => {
    const themePath = await writeTheme("minimal.json", {
      config: { background: "white" },
    });
    const theme = await loadThemeFromFile(themePath);

    expect(theme.name).toBe("minimal");
    expect(theme.displayName).toBe("minimal");
    expect(theme.description).toBe("");
    expect(theme.target).toBe("paper");
    expect(theme.mode).toBe("light");
    expect(theme.config).toEqual({ background: "white" });
  });

  test("loads a full theme file", async () => {
    const themePath = await writeTheme("lab.json", {
      name: "lab-compact",
      displayName: "Lab Compact",
      description: "Lab report figures",
      target: "paper",
      mode: "light",
      config: { font: "Helvetica" },
    });
    const theme = await loadThemeFromFile(themePath);

    expect(theme.name).toBe("lab-compact");
    expect(theme.displayName).toBe("Lab Compact");
    expect(theme.description).toBe("Lab report figures");
    expect(theme.config).toEqual({ font: "Helvetica" });
  });

  test("rejects empty config", async () => {
    const themePath = await writeTheme("empty.json", { config: {} });

    await expect(loadThemeFromFile(themePath)).rejects.toThrow(
      '"config" must include at least one styling key',
    );
  });

  test("rejects unknown top-level keys", async () => {
    const themePath = await writeTheme("bad.json", {
      extra: true,
      config: { background: "white" },
    });

    await expect(loadThemeFromFile(themePath)).rejects.toThrow("unknown keys: extra");
  });

  test("rejects invalid target", async () => {
    const themePath = await writeTheme("bad-target.json", {
      target: "magazine",
      config: { background: "white" },
    });

    await expect(loadThemeFromFile(themePath)).rejects.toThrow('"target" must be one of');
  });

  test("rejects invalid name slug", async () => {
    const themePath = await writeTheme("bad-name.json", {
      name: "Lab Theme",
      config: { background: "white" },
    });

    await expect(loadThemeFromFile(themePath)).rejects.toThrow("name");
  });
});

async function writeTheme(filename: string, contents: unknown): Promise<string> {
  await mkdir(workspace, { recursive: true });
  const themePath = join(workspace, filename);
  await writeFile(themePath, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  return themePath;
}
