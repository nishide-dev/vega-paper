import { dirname, isAbsolute, resolve } from "node:path";
import { parseCsv } from "./infer";
import type { JsonObject } from "./spec";

export async function loadLintDataRows(
  spec: JsonObject,
  specPath: string,
): Promise<JsonObject[] | undefined> {
  const url = getRootCsvDataUrl(spec);

  if (url === undefined) {
    return undefined;
  }

  const dataPath = isAbsolute(url) ? url : resolve(dirname(specPath), url);
  const file = Bun.file(dataPath);

  try {
    if (!(await file.exists())) {
      return undefined;
    }

    const csv = parseCsv(await file.text());

    return csv.rows.map((row) =>
      Object.fromEntries(csv.header.map((field, index) => [field, row[index] ?? ""])),
    );
  } catch {
    return undefined;
  }
}

function getRootCsvDataUrl(spec: JsonObject): string | undefined {
  const data = spec.data;

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined;
  }

  const url = (data as JsonObject).url;

  if (typeof url !== "string" || !url.toLowerCase().endsWith(".csv")) {
    return undefined;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return undefined;
  }

  return url;
}
