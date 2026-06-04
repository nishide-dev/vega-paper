import type { VegaPaperTheme } from "./registry";

export const paperClean: VegaPaperTheme = {
  name: "paper-clean",
  displayName: "Paper Clean",
  description: "General publication-ready theme with restrained grids and readable labels.",
  target: "paper",
  mode: "light",
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
      category: ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"],
    },
  },
};
