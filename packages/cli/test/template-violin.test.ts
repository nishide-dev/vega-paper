import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { ViolinRequest } from "../src/core/template";
import {
  buildViolinSpec,
  computeViolinDensitySettings,
  normalReferenceBandwidth,
} from "../src/core/templates/violin";

function createRequest(
  optionOverrides: Partial<ViolinRequest["options"]> = {},
  commonOverrides: Partial<Omit<ViolinRequest, "template" | "options">> = {},
): ViolinRequest {
  return {
    template: "violin",
    inputPath: "examples/run-distribution/runs.csv",
    specOutputPath: "examples/run-distribution/chart-violin.vl.json",
    table: {
      header: ["method", "seed", "score"],
      rows: [
        ["baseline", "1", "79.0"],
        ["baseline", "2", "80.0"],
        ["baseline", "3", "81.0"],
        ["baseline", "4", "80.0"],
        ["ours", "1", "83.0"],
        ["ours", "2", "84.0"],
        ["ours", "3", "85.0"],
        ["ours", "4", "84.0"],
      ],
    },
    options: {
      xField: "method",
      yField: "score",
      ...optionOverrides,
    },
    ...commonOverrides,
  };
}

describe("normalReferenceBandwidth", () => {
  test("matches the hand-computed Silverman value for 1..10", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // sd = 3.0277, IQR/1.34 = 3.3582 → h = 3.0277; 1.06 * h * 10^-0.2 = 2.0253
    expect(normalReferenceBandwidth(values)).toBeCloseTo(2.025, 2);
  });

  test("returns 0 for fewer than two values", () => {
    expect(normalReferenceBandwidth([5])).toBe(0);
  });
});

describe("computeViolinDensitySettings", () => {
  test("pads the shared extent so every violin tapers instead of clipping", () => {
    const request = createRequest();
    const settings = computeViolinDensitySettings(request.table, "score", ["method"], undefined);

    // Data range is [79, 85]; the pad must clear both the 5% range pad and
    // 1.5 kernel bandwidths, so the extent strictly contains the data.
    expect(settings.extent[0]).toBeLessThan(79);
    expect(settings.extent[1]).toBeGreaterThan(85);
    expect(settings.bandwidth).toBeUndefined();
  });

  test("scales the widest per-group auto bandwidth by the factor", () => {
    const request = createRequest();
    const auto = computeViolinDensitySettings(request.table, "score", ["method"], undefined);
    const scaled = computeViolinDensitySettings(request.table, "score", ["method"], 0.5);

    expect(scaled.bandwidth).toBeDefined();
    expect(scaled.bandwidth ?? 0).toBeGreaterThan(0);
    // The padded extent must track the effective (scaled) bandwidth.
    expect(scaled.extent[1] - scaled.extent[0]).toBeLessThanOrEqual(
      auto.extent[1] - auto.extent[0],
    );
  });

  test("rejects non-numeric measure values", () => {
    const request = createRequest();
    request.table.rows[0] = ["baseline", "1", "fast"];

    expect(() =>
      computeViolinDensitySettings(request.table, "score", ["method"], undefined),
    ).toThrow(new VegaPaperError('Field "score" contains a non-numeric value "fast".'));
  });
});

describe("buildViolinSpec", () => {
  test("builds a faceted mirrored-density spec with a hidden density axis", () => {
    const spec = buildViolinSpec(createRequest()) as {
      $schema: string;
      data: unknown;
      facet: Record<string, unknown>;
      spec: {
        width: number;
        height: number;
        transform: Array<Record<string, unknown>>;
        mark: unknown;
        encoding: Record<string, Record<string, unknown>>;
      };
    };

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");
    expect(spec.data).toEqual({
      url: "runs.csv",
      format: { type: "csv", parse: { seed: "number", score: "number" } },
    });

    expect(spec.facet).toEqual({
      field: "method",
      type: "nominal",
      header: { titleOrient: "bottom", labelOrient: "bottom", labelPadding: 2 },
    });

    const density = spec.spec.transform[0] as {
      density: string;
      groupby: string[];
      extent: [number, number];
      as: [string, string];
    };
    expect(density.density).toBe("score");
    expect(density.groupby).toEqual(["method"]);
    expect(density.extent[0]).toBeLessThan(79);
    expect(density.extent[1]).toBeGreaterThan(85);
    expect(density.as).toEqual(["value", "density"]);

    expect(spec.spec.mark).toEqual({ type: "area", orient: "horizontal" });
    expect(spec.spec.encoding.y).toEqual({
      field: "value",
      type: "quantitative",
      title: "score",
      scale: { zero: false },
    });
    expect(spec.spec.encoding.x).toEqual({
      field: "density",
      type: "quantitative",
      stack: "center",
      impute: null,
      title: null,
      axis: { labels: false, ticks: false, grid: false, domain: false },
    });
    expect(spec.spec.encoding.color).toEqual({
      field: "method",
      type: "nominal",
      legend: null,
    });
  });

  test("splits the requested width across category panels deterministically", () => {
    const spec = buildViolinSpec(createRequest({}, { width: 360, height: 200 })) as {
      spec: { width: number; height: number };
    };

    // Two categories: (360 - 60 reserved) / 2 = 150 per panel.
    expect(spec.spec.width).toBe(150);
    expect(spec.spec.height).toBe(200);
  });

  test("emits an explicit density bandwidth when a factor is set", () => {
    const spec = buildViolinSpec(createRequest({ bandwidth: 0.5 })) as {
      spec: { transform: Array<{ bandwidth?: number }> };
    };

    expect(spec.spec.transform[0]?.bandwidth ?? 0).toBeGreaterThan(0);
  });

  test("sets the title when provided", () => {
    const spec = buildViolinSpec(createRequest({}, { title: "Score distribution" }));

    expect(spec.title).toBe("Score distribution");
  });

  test("rejects unknown fields", () => {
    expect(() => buildViolinSpec(createRequest({ xField: "missing" }))).toThrow(VegaPaperError);
    expect(() => buildViolinSpec(createRequest({ yField: "missing" }))).toThrow(VegaPaperError);
  });
});
