import type { VegaPaperTheme } from "./index";

export const neuripsClean: VegaPaperTheme = {
  name: "neurips-clean",
  displayName: "NeurIPS Clean",
  description:
    "NeurIPS / ICML / ML conference theme with clear series colors and readable single-column figures.",
  target: "paper",
  mode: "light",
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
      category: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"],
    },
  },
};
