import type { VegaPaperTheme } from "./index";

export const shadcnDark: VegaPaperTheme = {
  name: "shadcn-dark",
  displayName: "shadcn Dark",
  description: "Modern dark chart theme for dashboards, demos, and dark UI surfaces.",
  target: "web",
  mode: "dark",
  config: {
    background: "#0f172a",
    font: "Inter, ui-sans-serif, system-ui, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 420,
      continuousHeight: 260,
    },
    axis: {
      domain: false,
      gridColor: "#334155",
      gridOpacity: 0.7,
      labelColor: "#cbd5e1",
      labelFontSize: 12,
      titleColor: "#f8fafc",
      titleFontSize: 12,
      tickColor: "#475569",
    },
    legend: {
      labelColor: "#cbd5e1",
      labelFontSize: 12,
      titleColor: "#f8fafc",
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
      category: ["#2dd4bf", "#60a5fa", "#fb7185", "#a78bfa", "#fbbf24", "#22d3ee"],
    },
  },
};
