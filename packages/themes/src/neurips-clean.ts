import { categoryRangeFromPalette } from "./palettes/apply-palette";
import { getPalette } from "./palettes/registry";
import type { VegaPaperTheme } from "./registry";

const palette = getPalette("ft-line-web");

export const neuripsClean: VegaPaperTheme = {
  name: "neurips-clean",
  displayName: "NeurIPS Clean",
  description:
    "NeurIPS / ICML / ML conference theme with clear series colors and readable single-column figures.",
  target: "paper",
  mode: "light",
  paletteId: palette.id,
  paletteAttribution: palette.attribution,
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 380,
      continuousHeight: 240,
    },
    axis: {
      domainColor: "#374151",
      gridColor: "#e5e7eb",
      gridOpacity: 0.7,
      labelColor: "#1f2937",
      labelFontSize: 11,
      titleColor: "#111827",
      titleFontSize: 12,
      titlePadding: 8,
      tickColor: "#6b7280",
    },
    legend: {
      orient: "top",
      direction: "horizontal",
      labelColor: "#1f2937",
      labelFontSize: 11,
      titleColor: "#111827",
      titleFontSize: 12,
      symbolSize: 68,
    },
    line: {
      strokeWidth: 2.5,
    },
    point: {
      filled: true,
      size: 58,
    },
    range: {
      category: categoryRangeFromPalette("ft-line-web"),
    },
  },
};
