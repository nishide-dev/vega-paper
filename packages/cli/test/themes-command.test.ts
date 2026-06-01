import { Command } from "commander";
import { describe, expect, test } from "bun:test";
import { registerThemesCommand } from "../src/commands/themes";
import { VegaPaperError } from "../src/core/errors";

describe("themes command", () => {
  test("prints theme list as a table", async () => {
    const output = await runThemesCommand(["themes", "list"]);

    expect(output.stdout).toContain("name");
    expect(output.stdout).toContain("paper-clean");
    expect(output.stdout).toContain("acl-clean");
    expect(output.stdout).toContain("shadcn-light");
    expect(output.stdout).toContain("monochrome-print");
  });

  test("prints theme list as JSON", async () => {
    const output = await runThemesCommand(["themes", "list", "--json"]);
    const themes = JSON.parse(output.stdout) as Array<{ name: string }>;

    expect(themes.map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
      "shadcn-light",
      "monochrome-print",
    ]);
  });

  test("prints a theme as JSON", async () => {
    const output = await runThemesCommand(["themes", "show", "paper-clean", "--json"]);
    const theme = JSON.parse(output.stdout) as { name: string; config: unknown };

    expect(theme.name).toBe("paper-clean");
    expect(theme.config).toBeDefined();
  });

  test("throws VegaPaperError for unknown themes", async () => {
    await expect(
      runThemesCommand(["themes", "show", "missing-theme"]),
    ).rejects.toBeInstanceOf(VegaPaperError);
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
