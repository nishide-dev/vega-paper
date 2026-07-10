#!/usr/bin/env bun

import { Command } from "commander";
import { registerDoctorCommand } from "./commands/doctor";
import { registerInferCommand } from "./commands/infer";
import { registerLintCommand } from "./commands/lint";
import { registerRenderCommand } from "./commands/render";
import { registerTemplateCommand } from "./commands/template";
import { registerThemesCommand } from "./commands/themes";
import { VegaPaperError } from "./core/errors";

const program = new Command();

program
  .name("vega-paper")
  .description("AI-friendly CLI for publication-ready Vega and Vega-Lite figures")
  .version("0.2.0");

registerRenderCommand(program);
registerInferCommand(program);
registerTemplateCommand(program);
registerLintCommand(program);
registerThemesCommand(program);
registerDoctorCommand(program);

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
