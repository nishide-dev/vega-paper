import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { registerThemesCommand } from "../src/commands/themes";
import { VegaPaperError } from "../src/core/errors";

describe("themes command", () => {
  test("prints theme list as a table", async () => {
    const output = await runThemesCommand(["themes", "list"]);

    expect(output.stdout).toContain("name");
    expect(output.stdout).toContain("paper-clean");
    expect(output.stdout).toContain("acl-clean");
    expect(output.stdout).toContain("neurips-clean");
    expect(output.stdout).toContain("shadcn-light");
    expect(output.stdout).toContain("shadcn-dark");
    expect(output.stdout).toContain("nature-soft");
    expect(output.stdout).toContain("monochrome-print");
    expect(output.stdout).toContain("poster-dark");
  });

  test("prints theme list as JSON", async () => {
    const output = await runThemesCommand(["themes", "list", "--json"]);
    const themes = JSON.parse(output.stdout) as Array<{ name: string }>;

    expect(themes.map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
      "neurips-clean",
      "shadcn-light",
      "shadcn-dark",
      "nature-soft",
      "monochrome-print",
      "poster-dark",
    ]);
  });

  test("prints a theme as JSON", async () => {
    const output = await runThemesCommand(["themes", "show", "paper-clean", "--json"]);
    const theme = JSON.parse(output.stdout) as { name: string; config: unknown };

    expect(theme.name).toBe("paper-clean");
    expect(theme.config).toBeDefined();
  });

  test("throws VegaPaperError for unknown themes", async () => {
    await expect(runThemesCommand(["themes", "show", "missing-theme"])).rejects.toBeInstanceOf(
      VegaPaperError,
    );
  });

  test("shows a custom theme file", async () => {
    const themePath = join(import.meta.dir, ".tmp-themes-command", "custom.json");
    await mkdir(join(import.meta.dir, ".tmp-themes-command"), { recursive: true });
    await Bun.write(
      themePath,
      JSON.stringify({
        name: "custom-show",
        config: { background: "white" },
      }),
    );

    const output = await runThemesCommand(["themes", "show", themePath, "--json"]);
    const theme = JSON.parse(output.stdout) as { name: string; config: { background: string } };

    expect(theme.name).toBe("custom-show");
    expect(theme.config.background).toBe("white");

    await rm(join(import.meta.dir, ".tmp-themes-command"), { recursive: true, force: true });
  });
});

async function runThemesCommand(args: string[]): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerThemesCommand(program, (value) => {
    stdout += value;
  });
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}
