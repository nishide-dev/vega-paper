#!/usr/bin/env bun

import { listThemes } from "../packages/themes/src/index.ts";

const spec = "examples/basic-line/chart.vl.json";
const outDir = "examples/theme-samples";

for (const theme of listThemes()) {
  const out = `${outDir}/${theme.name}.svg`;
  console.log(`Rendering ${theme.name} -> ${out}`);

  const proc = Bun.spawn(
    [
      "bun",
      "run",
      "packages/cli/src/index.ts",
      "render",
      spec,
      "--theme",
      theme.name,
      "--format",
      "svg",
      "--out",
      out,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );

  if ((await proc.exited) !== 0) {
    process.exit(1);
  }
}
