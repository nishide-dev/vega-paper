import { getPalette } from "./registry";

export function categoryRangeFromPalette(paletteId: string): string[] {
  return [...getPalette(paletteId).colors];
}
