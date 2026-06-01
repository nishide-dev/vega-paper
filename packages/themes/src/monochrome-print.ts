import type { VegaPaperTheme } from "./index";

export const monochromePrint: VegaPaperTheme = {
  name: "monochrome-print",
  displayName: "Monochrome Print",
  description: "Grayscale-safe print theme for review PDFs and black-and-white output.",
  target: "paper",
  mode: "print",
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 360,
      continuousHeight: 220,
    },
    axis: {
      domainColor: "#222222",
      gridColor: "#dddddd",
      gridOpacity: 0.8,
      labelColor: "#111111",
      labelFontSize: 11,
      titleColor: "#111111",
      titleFontSize: 12,
      tickColor: "#666666",
    },
    legend: {
      labelColor: "#111111",
      labelFontSize: 11,
      titleColor: "#111111",
      titleFontSize: 12,
    },
    line: {
      strokeWidth: 2.2,
    },
    point: {
      filled: true,
      size: 52,
    },
    range: {
      category: ["#111111", "#444444", "#777777", "#999999", "#bbbbbb", "#dddddd"],
    },
  },
};
