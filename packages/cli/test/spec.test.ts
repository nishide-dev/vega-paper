import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyThemeToSpec, detectSpecType, loadJsonSpec } from "../src/core/spec";

describe("loadJsonSpec", () => {
  test("loads JSON object files", async () => {
    const path = await tempSpecPath("spec-object.json");
    await Bun.write(path, JSON.stringify({ mark: "line", encoding: {} }));

    expect(await loadJsonSpec(path)).toEqual({ mark: "line", encoding: {} });
  });

  test("rejects invalid JSON", async () => {
    const path = await tempSpecPath("spec-invalid.json");
    await Bun.write(path, "{");

    await expect(loadJsonSpec(path)).rejects.toThrow(
      `Invalid JSON in input file: ${path}`,
    );
  });

  test("rejects non-object JSON", async () => {
    const path = await tempSpecPath("spec-array.json");
    await Bun.write(path, "[]");

    await expect(loadJsonSpec(path)).rejects.toThrow(
      `Input JSON must be an object: ${path}`,
    );
  });
});

async function tempSpecPath(fileName: string): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "vega-paper-spec-")), fileName);
}

describe("detectSpecType", () => {
  test("detects Vega-Lite from schema", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        mark: "line",
        encoding: {},
      }),
    ).toBe("vega-lite");
  });

  test("Vega-Lite schema wins over Vega structural fields", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        marks: [],
        scales: [],
      }),
    ).toBe("vega-lite");
  });

  test("detects Vega-Lite from mark and encoding", () => {
    expect(detectSpecType({ mark: "bar", encoding: {} })).toBe("vega-lite");
  });

  test("detects Vega from schema", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega/v6.json",
        marks: [],
        scales: [],
      }),
    ).toBe("vega");
  });

  test("Vega schema wins over Vega-Lite structural fields", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega/v6.json",
        mark: "bar",
        encoding: {},
      }),
    ).toBe("vega");
  });

  test("detects Vega from marks and scales", () => {
    expect(detectSpecType({ marks: [], scales: [] })).toBe("vega");
  });

  test("rejects unknown specs", () => {
    expect(() => detectSpecType({ hello: "world" })).toThrow(
      "Could not determine whether the input is Vega-Lite or Vega",
    );
  });
});

describe("applyThemeToSpec", () => {
  test("applies theme config without mutating input", () => {
    const spec = {
      mark: "line",
      encoding: {},
    };

    const themed = applyThemeToSpec(spec, {
      axis: { labelFontSize: 11 },
      view: { stroke: null },
    });

    expect(themed).toEqual({
      mark: "line",
      encoding: {},
      config: {
        axis: { labelFontSize: 11 },
        view: { stroke: null },
      },
    });
    expect(spec).toEqual({ mark: "line", encoding: {} });
  });

  test("preserves explicit spec config over theme defaults", () => {
    const themed = applyThemeToSpec(
      {
        mark: "line",
        encoding: {},
        config: {
          axis: { labelFontSize: 14 },
        },
      },
      {
        axis: { labelFontSize: 11, titleFontSize: 12 },
        view: { stroke: null },
      },
    );

    expect(themed.config).toEqual({
      axis: {
        labelFontSize: 14,
        titleFontSize: 12,
      },
      view: { stroke: null },
    });
  });

  test("does not mutate theme config", () => {
    const themeConfig = {
      axis: { labelFontSize: 11 },
      view: { stroke: null },
    };

    applyThemeToSpec(
      {
        mark: "line",
        encoding: {},
        config: { axis: { titleFontSize: 12 } },
      },
      themeConfig,
    );

    expect(themeConfig).toEqual({
      axis: { labelFontSize: 11 },
      view: { stroke: null },
    });
  });
});
