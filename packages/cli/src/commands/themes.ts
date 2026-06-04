import { listThemes } from "@vega-paper/themes";
import type { Command } from "commander";
import { formatTable, toPrettyJson } from "../core/format";
import { getCliTheme } from "../core/theme";

type JsonOption = {
  json?: boolean;
};

type WriteOutput = (value: string) => void;

export function registerThemesCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
): void {
  const themes = program.command("themes").description("Inspect VegaPaper themes");

  themes
    .command("list")
    .description("List available themes")
    .option("--json", "print JSON")
    .action((options: JsonOption) => {
      const availableThemes = listThemes();

      if (options.json) {
        writeOutput(toPrettyJson(availableThemes));
        return;
      }

      writeOutput(
        `${formatTable({
          headers: ["name", "target", "mode", "description"],
          rows: availableThemes.map((theme) => [
            theme.name,
            theme.target,
            theme.mode,
            theme.description,
          ]),
        })}\n`,
      );
    });

  themes
    .command("show")
    .argument("<name>", "built-in theme name or path to theme JSON")
    .description("Show a theme")
    .option("--json", "print JSON")
    .action(async (name: string, options: JsonOption) => {
      const theme = await getCliTheme(name);

      if (options.json) {
        writeOutput(toPrettyJson(theme));
        return;
      }

      writeOutput(
        [
          `name: ${theme.name}`,
          `displayName: ${theme.displayName}`,
          `target: ${theme.target}`,
          `mode: ${theme.mode}`,
          `description: ${theme.description}`,
          ...(theme.paletteId ? [`paletteId: ${theme.paletteId}`] : []),
          ...(theme.paletteAttribution
            ? [
                `paletteSource: ${theme.paletteAttribution.name} (${theme.paletteAttribution.url})`,
              ]
            : []),
          "config:",
          JSON.stringify(theme.config, null, 2),
          "",
        ].join("\n"),
      );
    });
}
