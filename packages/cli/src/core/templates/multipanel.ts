import { isAbsolute, relative, resolve } from "node:path";
import { VegaPaperError } from "../errors";
import type { JsonObject } from "../spec";

export type MultipanelLayout = "hconcat" | "vconcat";

export type MultipanelPanel = {
  spec: JsonObject;
  label: string;
  title?: string | undefined;
};

export type MultipanelRequest = {
  panels: MultipanelPanel[];
  layout: MultipanelLayout;
};

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";

export function buildMultipanelSpec(request: MultipanelRequest): JsonObject {
  if (request.panels.length < 2) {
    throw new VegaPaperError(
      "The multipanel template requires at least two panels. Pass --panel twice or more.",
    );
  }

  return {
    $schema: VEGA_LITE_SCHEMA,
    [request.layout]: request.panels.map((panel) => toPanelView(panel)),
  };
}

function toPanelView(panel: MultipanelPanel): JsonObject {
  const view = structuredClone(panel.spec);

  delete view.$schema;
  delete view.config;

  const text = panel.title === undefined ? `(${panel.label})` : `(${panel.label}) ${panel.title}`;

  view.title = { text, anchor: "start", fontWeight: "bold" };

  return view;
}

export function rebaseDataUrl(
  spec: JsonObject,
  specDirectory: string,
  outputDirectory: string,
): JsonObject {
  const rebased = structuredClone(spec);
  const data = rebased.data;

  if (!isPlainObject(data) || typeof data.url !== "string") {
    return rebased;
  }

  if (isRemoteUrl(data.url) || isAbsolute(data.url)) {
    return rebased;
  }

  data.url = relative(resolve(outputDirectory), resolve(specDirectory, data.url));

  return rebased;
}

function isRemoteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
