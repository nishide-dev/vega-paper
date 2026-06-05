#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { listThemes } from "../packages/themes/src/index.ts";

const CLI = ["bun", "run", "packages/cli/src/index.ts"];
const SCALE = "2";
const GALLERY = "docs/assets/gallery";

type GalleryJob = {
  spec: string;
  theme: string;
  out: string;
};

const exampleJobs: GalleryJob[] = [
  {
    spec: "examples/basic-line/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/basic-line.png`,
  },
  {
    spec: "examples/training-curve/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/training-curve.png`,
  },
  {
    spec: "examples/confusion-matrix/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/confusion-matrix.png`,
  },
  {
    spec: "examples/faceted-training/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/faceted-training.png`,
  },
  {
    spec: "examples/boxplot/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/boxplot.png`,
  },
  {
    spec: "examples/embedding-scatter/chart.vl.json",
    theme: "paper-clean",
    out: `${GALLERY}/examples/embedding-scatter.png`,
  },
  {
    spec: "examples/custom-theme/chart.vl.json",
    theme: "examples/custom-theme/theme.json",
    out: `${GALLERY}/examples/custom-theme.png`,
  },
];

async function renderJob(job: GalleryJob): Promise<void> {
  await mkdir(dirname(job.out), { recursive: true });
  console.log(`Rendering ${job.theme} -> ${job.out}`);

  const proc = Bun.spawn(
    [
      ...CLI,
      "render",
      job.spec,
      "--theme",
      job.theme,
      "--format",
      "png",
      "--scale",
      SCALE,
      "--out",
      job.out,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );

  if ((await proc.exited) !== 0) {
    throw new Error(`Render failed: ${job.out}`);
  }
}

const themeJobs: GalleryJob[] = listThemes().map((theme) => ({
  spec: "examples/basic-line/chart.vl.json",
  theme: theme.name,
  out: `${GALLERY}/themes/${theme.name}.png`,
}));

for (const job of [...themeJobs, ...exampleJobs]) {
  await renderJob(job);
}
