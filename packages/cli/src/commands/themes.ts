import { getTheme, listThemes } from "@vega-paper/themes";
import { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import { formatTable, toPrettyJson } from "../core/format";

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
    .argument("<name>", "theme name")
    .description("Show a theme")
    .option("--json", "print JSON")
    .action((name: string, options: JsonOption) => {
      const theme = getCliTheme(name);

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
          "config:",
          JSON.stringify(theme.config, null, 2),
          "",
        ].join("\n"),
      );
    });
}

function getCliTheme(name: string): ReturnType<typeof getTheme> {
  try {
    return getTheme(name);
  } catch (error) {
    if (error instanceof Error && error.message === `Unknown theme "${name}"`) {
      throw new VegaPaperError(error.message);
    }

    throw error;
  }
}
