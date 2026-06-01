#!/usr/bin/env bun

import { Command } from "commander";
import { registerRenderCommand } from "./commands/render";
import { registerThemesCommand } from "./commands/themes";
import { VegaPaperError } from "./core/errors";

const program = new Command();

program
  .name("vega-paper")
  .description("AI-friendly CLI for publication-ready Vega and Vega-Lite figures")
  .version("0.1.0");

registerRenderCommand(program);
registerThemesCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof VegaPaperError) {
    console.error(`vega-paper: ${error.message}`);
    process.exit(error.exitCode);
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
