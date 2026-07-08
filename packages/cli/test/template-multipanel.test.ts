import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { JsonObject } from "../src/core/spec";
import { buildMultipanelSpec, rebaseDataUrl } from "../src/core/templates/multipanel";

function linePanel(): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    mark: "line",
    width: 360,
    height: 240,
    config: { font: "serif" },
    title: "Training F1",
    encoding: {
      x: { field: "epoch", type: "quantitative" },
      y: { field: "f1", type: "quantitative" },
    },
  };
}

function barPanel(): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { url: "data.csv" },
    mark: "bar",
    encoding: {
      x: { field: "component", type: "nominal" },
      y: { field: "score", type: "quantitative" },
    },
  };
}

describe("buildMultipanelSpec", () => {
  test("wraps panels in hconcat with anchored bold labels", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");
    expect(spec.vconcat).toBeUndefined();

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(panels).toHaveLength(2);
    expect(panels[0]?.title).toEqual({
      text: "(a) Training",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[1]?.title).toEqual({
      text: "(b) Ablation",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[0]?.mark).toBe("line");
    expect(panels[1]?.mark).toBe("bar");
  });

  test("strips panel $schema and config so the outer spec owns both", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    for (const panel of panels) {
      expect(panel.$schema).toBeUndefined();
      expect(panel.config).toBeUndefined();
    }
  });

  test("omitted panel title yields a bare label", () => {
    const spec = buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: linePanel(), label: "a" },
        { spec: barPanel(), label: "b" },
      ],
    });

    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect((panels[0]?.title as { text: string }).text).toBe("(a)");
  });

  test("vconcat layout stacks panels vertically", () => {
    const spec = buildMultipanelSpec({
      layout: "vconcat",
      panels: [
        { spec: linePanel(), label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(spec.hconcat).toBeUndefined();
    expect(spec.vconcat as unknown[]).toHaveLength(2);
  });

  test("does not mutate the input panel specs", () => {
    const original = linePanel();
    const untouched = structuredClone(original);

    buildMultipanelSpec({
      layout: "hconcat",
      panels: [
        { spec: original, label: "a", title: "Training" },
        { spec: barPanel(), label: "b", title: "Ablation" },
      ],
    });

    expect(original).toEqual(untouched);
  });

  test("rejects fewer than two panels", () => {
    expect(() =>
      buildMultipanelSpec({
        layout: "hconcat",
        panels: [{ spec: linePanel(), label: "a", title: "Training" }],
      }),
    ).toThrow(VegaPaperError);
  });
});

describe("rebaseDataUrl", () => {
  test("rewrites a relative data url from the panel dir to the output dir", () => {
    const rebased = rebaseDataUrl(
      linePanel(),
      "/repo/examples/training-curve",
      "/repo/examples/multipanel-paper-figure",
    );

    expect(rebased.data).toEqual({ url: "../training-curve/data.csv" });
  });

  test("keeps the url unchanged when panel and output dirs match", () => {
    const rebased = rebaseDataUrl(linePanel(), "/repo/figures", "/repo/figures");

    expect(rebased.data).toEqual({ url: "data.csv" });
  });

  test("leaves remote and absolute urls unchanged", () => {
    const remote: JsonObject = { data: { url: "https://example.org/data.csv" }, mark: "line" };
    const absolute: JsonObject = { data: { url: "/srv/data.csv" }, mark: "line" };

    expect(rebaseDataUrl(remote, "/repo/a", "/repo/b").data).toEqual({
      url: "https://example.org/data.csv",
    });
    expect(rebaseDataUrl(absolute, "/repo/a", "/repo/b").data).toEqual({
      url: "/srv/data.csv",
    });
  });

  test("leaves inline data.values specs unchanged", () => {
    const inline: JsonObject = { data: { values: [{ x: 1 }] }, mark: "line" };

    expect(rebaseDataUrl(inline, "/repo/a", "/repo/b").data).toEqual({
      values: [{ x: 1 }],
    });
  });
});
