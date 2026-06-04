import { categoryRangeFromPalette } from "./palettes/apply-palette";
import { getPalette } from "./palettes/registry";
import type { VegaPaperTheme } from "./registry";

const palette = getPalette("carbon-categorical");

export const paperClean: VegaPaperTheme = {
  name: "paper-clean",
  displayName: "Paper Clean",
  description: "General publication-ready theme with restrained grids and readable labels.",
  target: "paper",
  mode: "light",
  paletteId: palette.id,
  paletteAttribution: palette.attribution,
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 360,
      continuousHeight: 220,
    },
    axis: {
      domainColor: "#3f3f46",
      gridColor: "#e4e4e7",
      gridOpacity: 0.75,
      labelColor: "#27272a",
      labelFontSize: 11,
      titleColor: "#18181b",
      titleFontSize: 12,
      titlePadding: 8,
      tickColor: "#71717a",
    },
    legend: {
      labelColor: "#27272a",
      labelFontSize: 11,
      titleColor: "#18181b",
      titleFontSize: 12,
      symbolSize: 70,
    },
    line: {
      strokeWidth: 2.25,
    },
    point: {
      filled: true,
      size: 55,
    },
    range: {
      category: categoryRangeFromPalette(palette.id),
    },
  },
};
