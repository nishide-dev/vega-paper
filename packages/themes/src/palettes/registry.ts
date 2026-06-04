import { carbonCategorical } from "./carbon-categorical";
import { catppuccinLatte } from "./catppuccin-latte";
import { catppuccinMocha } from "./catppuccin-mocha";
import { ftLineWeb } from "./ft-line-web";
import type { VegaPaperPalette } from "./types";

const palettes = [carbonCategorical, ftLineWeb, catppuccinLatte, catppuccinMocha] as const;

export function listPalettes(): VegaPaperPalette[] {
  return palettes.map(clonePalette);
}

export function getPalette(id: string): VegaPaperPalette {
  const palette = palettes.find((candidate) => candidate.id === id);
  if (!palette) {
    throw new Error(`Unknown palette "${id}"`);
  }
  return clonePalette(palette);
}

function clonePalette(palette: VegaPaperPalette): VegaPaperPalette {
  return structuredClone(palette);
}
