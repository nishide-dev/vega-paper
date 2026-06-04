import { categoryRangeFromPalette } from "./palettes/apply-palette";
import { getPalette } from "./palettes/registry";
import type { VegaPaperTheme } from "./registry";

const palette = getPalette("catppuccin-latte");

export const shadcnLight: VegaPaperTheme = {
  name: "shadcn-light",
  displayName: "shadcn Light",
  description: "Modern light chart theme inspired by quiet application dashboards.",
  target: "web",
  mode: "light",
  paletteId: palette.id,
  paletteAttribution: palette.attribution,
  config: {
    background: "white",
    font: "Inter, ui-sans-serif, system-ui, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 420,
      continuousHeight: 260,
    },
    axis: {
      domain: false,
      gridColor: "#e2e8f0",
      gridOpacity: 0.8,
      labelColor: "#475569",
      labelFontSize: 12,
      titleColor: "#0f172a",
      titleFontSize: 12,
      tickColor: "#cbd5e1",
    },
    legend: {
      labelColor: "#475569",
      labelFontSize: 12,
      titleColor: "#0f172a",
      titleFontSize: 12,
    },
    line: {
      strokeWidth: 2.5,
    },
    point: {
      filled: true,
      size: 60,
    },
    range: {
      category: categoryRangeFromPalette(palette.id),
    },
  },
};
