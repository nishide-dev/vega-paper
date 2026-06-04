import type { VegaPaperTheme } from "./registry";

export const posterDark: VegaPaperTheme = {
  name: "poster-dark",
  displayName: "Poster Dark",
  description: "Dark poster and slide theme with large labels and high-contrast lines.",
  target: "poster",
  mode: "dark",
  config: {
    background: "#1a1a2e",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 480,
      continuousHeight: 320,
    },
    axis: {
      domainColor: "#e0e0e0",
      gridColor: "#3d3d5c",
      gridOpacity: 0.6,
      labelColor: "#f0f0f0",
      labelFontSize: 14,
      titleColor: "#ffffff",
      titleFontSize: 16,
      titlePadding: 10,
      tickColor: "#a0a0a0",
    },
    legend: {
      labelColor: "#f0f0f0",
      labelFontSize: 14,
      titleColor: "#ffffff",
      titleFontSize: 15,
      symbolSize: 90,
    },
    line: {
      strokeWidth: 3.5,
    },
    point: {
      filled: true,
      size: 80,
    },
    range: {
      category: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#f38181", "#aa96da"],
    },
  },
};
