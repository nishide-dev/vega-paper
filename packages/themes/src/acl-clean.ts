import type { VegaPaperTheme } from "./index";

export const aclClean: VegaPaperTheme = {
  name: "acl-clean",
  displayName: "ACL Clean",
  description: "Compact two-column NLP paper theme optimized for small figure widths.",
  target: "paper",
  mode: "light",
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 320,
      continuousHeight: 200,
    },
    axis: {
      domainColor: "#404040",
      gridColor: "#e5e5e5",
      gridOpacity: 0.65,
      labelColor: "#171717",
      labelFontSize: 10,
      titleColor: "#171717",
      titleFontSize: 11,
      titlePadding: 7,
      tickColor: "#737373",
    },
    legend: {
      orient: "top",
      direction: "horizontal",
      labelFontSize: 10,
      titleFontSize: 11,
      symbolSize: 60,
    },
    line: {
      strokeWidth: 2.4,
    },
    point: {
      filled: true,
      size: 48,
    },
    range: {
      category: ["#1d4ed8", "#b91c1c", "#047857", "#7e22ce", "#c2410c", "#0e7490"],
    },
  },
};
