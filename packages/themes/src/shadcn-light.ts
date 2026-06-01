import type { VegaPaperTheme } from "./index";

export const shadcnLight: VegaPaperTheme = {
  name: "shadcn-light",
  displayName: "shadcn Light",
  description: "Modern light chart theme inspired by quiet application dashboards.",
  target: "web",
  mode: "light",
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
      category: ["#0f766e", "#2563eb", "#be123c", "#7c3aed", "#ca8a04", "#0891b2"],
    },
  },
};
