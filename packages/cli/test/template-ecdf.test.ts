import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { EcdfRequest } from "../src/core/template";
import { buildEcdfSpec, uniqueDerivedFieldName } from "../src/core/templates/ecdf";

function createRequest(
  optionOverrides: Partial<EcdfRequest["options"]> = {},
  commonOverrides: Partial<Omit<EcdfRequest, "template" | "options">> = {},
): EcdfRequest {
  return {
    template: "ecdf",
    inputPath: "examples/run-distribution/runs.csv",
    specOutputPath: "examples/run-distribution/chart-ecdf.vl.json",
    table: {
      header: ["method", "seed", "score"],
      rows: [
        ["baseline", "1", "79.0"],
        ["baseline", "2", "80.0"],
        ["ours", "1", "83.0"],
        ["ours", "2", "84.0"],
      ],
    },
    options: {
      xField: "score",
      ...optionOverrides,
    },
    ...commonOverrides,
  };
}

describe("uniqueDerivedFieldName", () => {
  test("returns the base name when it does not collide", () => {
    expect(uniqueDerivedFieldName("__ecdf", ["method", "score"])).toBe("__ecdf");
  });

  test("prefixes underscores until the name is unique", () => {
    expect(uniqueDerivedFieldName("__ecdf", ["__ecdf", "___ecdf"])).toBe("____ecdf");
  });
});

describe("buildEcdfSpec", () => {
  test("builds a step-after cumulative spec grouped by color", () => {
    const spec = buildEcdfSpec(createRequest({ colorField: "method" }));

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: {
        url: "runs.csv",
        format: { type: "csv", parse: { seed: "number", score: "number" } },
      },
      width: 360,
      height: 240,
      layer: [
        {
          transform: [
            {
              window: [{ op: "count", as: "__ecdf_count" }],
              sort: [{ field: "score", order: "ascending" }],
              groupby: ["method"],
              frame: [null, 0],
            },
            {
              joinaggregate: [{ op: "count", as: "__ecdf_total" }],
              groupby: ["method"],
            },
            {
              calculate: "datum['__ecdf_count'] / datum['__ecdf_total']",
              as: "__ecdf",
            },
          ],
          mark: { type: "line", interpolate: "step-after" },
          encoding: {
            x: { field: "score", type: "quantitative", scale: { zero: false } },
            y: {
              field: "__ecdf",
              type: "quantitative",
              scale: { domain: [0, 1] },
              title: "Cumulative proportion",
            },
            color: { field: "method", type: "nominal" },
          },
        },
      ],
    });
  });

  test("omits groupby and color without a color field", () => {
    const spec = buildEcdfSpec(createRequest()) as {
      layer: Array<{
        transform: Array<Record<string, unknown>>;
        encoding: Record<string, unknown>;
      }>;
    };

    expect(spec.layer[0]?.transform[0]).not.toHaveProperty("groupby");
    expect(spec.layer[0]?.transform[1]).not.toHaveProperty("groupby");
    expect(spec.layer[0]?.encoding).not.toHaveProperty("color");
  });

  test("uses a log x scale when requested", () => {
    const spec = buildEcdfSpec(createRequest({ xScale: "log" })) as {
      layer: Array<{ encoding: { x: Record<string, unknown> } }>;
    };

    expect(spec.layer[0]?.encoding.x.scale).toEqual({ type: "log" });
  });

  test("renames derived fields that collide with data columns", () => {
    const request = createRequest();
    request.table.header = ["method", "__ecdf", "score"];

    const spec = buildEcdfSpec(request) as {
      layer: Array<{
        transform: [{ window: [{ as: string }] }, unknown, { calculate: string; as: string }];
        encoding: { y: { field: string } };
      }>;
    };

    expect(spec.layer[0]?.transform[2].as).toBe("___ecdf");
    expect(spec.layer[0]?.encoding.y.field).toBe("___ecdf");
  });

  test("rejects unknown fields", () => {
    expect(() => buildEcdfSpec(createRequest({ xField: "missing" }))).toThrow(VegaPaperError);
    expect(() => buildEcdfSpec(createRequest({ colorField: "missing" }))).toThrow(VegaPaperError);
  });
});
