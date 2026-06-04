import { categoryRangeFromPalette } from "./palettes/apply-palette";
import { getPalette } from "./palettes/registry";
import type { VegaPaperTheme } from "./registry";

const palette = getPalette("ft-line-web");

export const natureSoft: VegaPaperTheme = {
  name: "nature-soft",
  displayName: "Nature Soft",
  description: "Soft biomedical journal style with minimal axes and muted distinguishable colors.",
  target: "paper",
  mode: "light",
  paletteId: palette.id,
  paletteAttribution: palette.attribution,
  config: {
    background: "white",
    font: "Helvetica, Arial, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 360,
      continuousHeight: 220,
    },
    axis: {
      domain: false,
      gridColor: "#f0f0f0",
      gridOpacity: 0.9,
      labelColor: "#333333",
      labelFontSize: 10,
      titleColor: "#1a1a1a",
      titleFontSize: 11,
      tickColor: "#888888",
    },
    legend: {
      labelColor: "#333333",
      labelFontSize: 10,
      titleColor: "#1a1a1a",
      titleFontSize: 11,
    },
    line: {
      strokeWidth: 2,
    },
    point: {
      filled: true,
      size: 50,
    },
    range: {
      category: categoryRangeFromPalette("ft-line-web"),
    },
  },
};
