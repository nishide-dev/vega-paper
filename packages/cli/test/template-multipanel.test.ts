import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMultipanelLayout, parsePanelOption } from "../src/commands/template";
import { VegaPaperError } from "../src/core/errors";
import type { JsonObject } from "../src/core/spec";
import { buildMultipanelSpec, rebaseDataUrl } from "../src/core/templates/multipanel";

const REPO_ROOT = join(import.meta.dir, "../../..");
const CLI_ENTRY = join(REPO_ROOT, "packages/cli/src/index.ts");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

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

describe("parsePanelOption", () => {
  test("splits path, label, and title", () => {
    expect(parsePanelOption("examples/training-curve/chart.vl.json:a:Training")).toEqual({
      specPath: "examples/training-curve/chart.vl.json",
      label: "a",
      title: "Training",
    });
  });

  test("title is optional", () => {
    expect(parsePanelOption("chart.vl.json:b")).toEqual({
      specPath: "chart.vl.json",
      label: "b",
      title: undefined,
    });
  });

  test("re-joins colons inside the title", () => {
    expect(parsePanelOption("chart.vl.json:c:Quality: latency")).toEqual({
      specPath: "chart.vl.json",
      label: "c",
      title: "Quality: latency",
    });
  });

  test("treats a trailing empty title as no title", () => {
    expect(parsePanelOption("chart.vl.json:a:")).toEqual({
      specPath: "chart.vl.json",
      label: "a",
      title: undefined,
    });
  });

  test("rejects a value without a label", () => {
    expect(() => parsePanelOption("chart.vl.json")).toThrow(VegaPaperError);
    expect(() => parsePanelOption("chart.vl.json")).toThrow(
      'Invalid --panel value "chart.vl.json". Expected <spec-path>:<label>[:<title>].',
    );
  });

  test("rejects empty path or empty label", () => {
    expect(() => parsePanelOption(":a:Training")).toThrow(VegaPaperError);
    expect(() => parsePanelOption("chart.vl.json::Training")).toThrow(VegaPaperError);
  });
});

describe("parseMultipanelLayout", () => {
  test("defaults to hconcat and accepts both layouts", () => {
    expect(parseMultipanelLayout(undefined)).toBe("hconcat");
    expect(parseMultipanelLayout("hconcat")).toBe("hconcat");
    expect(parseMultipanelLayout("vconcat")).toBe("vconcat");
  });

  test("rejects unknown layouts", () => {
    expect(() => parseMultipanelLayout("grid")).toThrow(VegaPaperError);
  });
});

async function createPanelWorkspace(): Promise<{
  workspace: string;
  panelA: string;
  panelB: string;
}> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-multipanel-"));
  temporaryDirectories.push(workspace);

  const panelsDirectory = join(workspace, "panels");
  await mkdir(panelsDirectory, { recursive: true });

  const panelA = join(panelsDirectory, "curve.vl.json");
  const panelB = join(panelsDirectory, "bars.vl.json");

  await writeFile(
    panelA,
    `${JSON.stringify(
      {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: { url: "curve.csv" },
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    panelB,
    `${JSON.stringify(
      {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: { url: "bars.csv" },
        mark: "bar",
        encoding: {
          x: { field: "component", type: "nominal" },
          y: { field: "score", type: "quantitative" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { workspace, panelA, panelB };
}

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", CLI_ENTRY, ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

describe("template multipanel command", () => {
  test("composes two spec files into a labeled hconcat spec with rebased data urls", async () => {
    const { workspace, panelA, panelB } = await createPanelWorkspace();
    const specOut = join(workspace, "figures", "combined.vl.json");

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a:Training`,
      "--panel",
      `${panelB}:b:Ablation`,
      "--layout",
      "hconcat",
      "--spec-out",
      specOut,
    ]);

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Wrote ${specOut}`);

    const spec = (await Bun.file(specOut).json()) as Record<string, unknown>;
    const panels = spec.hconcat as Array<Record<string, unknown>>;

    expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v6.json");
    expect(panels).toHaveLength(2);
    expect(panels[0]?.title).toEqual({
      text: "(a) Training",
      anchor: "start",
      fontWeight: "bold",
    });
    expect(panels[0]?.data).toEqual({ url: "../panels/curve.csv" });
    expect(panels[1]?.data).toEqual({ url: "../panels/bars.csv" });
  });

  test("rejects a <data> positional argument", async () => {
    const { panelA, panelB, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "some-data.csv",
      "--panel",
      `${panelA}:a`,
      "--panel",
      `${panelB}:b`,
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not take a <data> argument");
  });

  test("rejects fewer than two --panel values", async () => {
    const { panelA, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requires at least two --panel values");
  });

  test("rejects a malformed --panel value", async () => {
    const { panelA, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--panel",
      "no-label-here",
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid --panel value "no-label-here"');
  });

  test("rejects an unknown --layout", async () => {
    const { panelA, panelB, workspace } = await createPanelWorkspace();

    const result = await runCli([
      "template",
      "multipanel",
      "--panel",
      `${panelA}:a`,
      "--panel",
      `${panelB}:b`,
      "--layout",
      "grid",
      "--spec-out",
      join(workspace, "combined.vl.json"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid value "grid" for --layout');
  });
});
