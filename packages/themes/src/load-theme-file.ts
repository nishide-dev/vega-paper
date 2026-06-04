import { basename, extname } from "node:path";
import type { VegaPaperTheme } from "./registry";
import {
  assertThemeMode,
  assertThemeName,
  assertThemeTarget,
  defaultNameFromBasename,
  isPlainObject,
  THEME_FILE_ALLOWED_KEYS,
} from "./theme-schema";

export async function loadThemeFromFile(filePath: string): Promise<VegaPaperTheme> {
  let contents: string;

  try {
    contents = await Bun.file(filePath).text();
  } catch {
    throw new Error(`theme file not found or unreadable: ${filePath}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("invalid JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("root value must be a JSON object");
  }

  const unknownKeys = Object.keys(parsed).filter(
    (key) => !THEME_FILE_ALLOWED_KEYS.includes(key as (typeof THEME_FILE_ALLOWED_KEYS)[number]),
  );

  if (unknownKeys.length > 0) {
    throw new Error(
      `unknown keys: ${unknownKeys.join(", ")}. Allowed: ${THEME_FILE_ALLOWED_KEYS.join(", ")}`,
    );
  }

  if (!("config" in parsed)) {
    throw new Error('missing required "config" object');
  }

  if (!isPlainObject(parsed.config)) {
    throw new Error('"config" must be a JSON object');
  }

  if (Object.keys(parsed.config).length === 0) {
    throw new Error('"config" must include at least one styling key');
  }

  const fileBasename = basename(filePath, extname(filePath));
  const name =
    parsed.name === undefined
      ? defaultNameFromBasename(fileBasename)
      : assertThemeName(parsed.name);
  const displayName =
    typeof parsed.displayName === "string" && parsed.displayName.length > 0
      ? parsed.displayName
      : name;
  const description = typeof parsed.description === "string" ? parsed.description : "";
  const target = parsed.target === undefined ? "paper" : assertThemeTarget(parsed.target);
  const mode = parsed.mode === undefined ? "light" : assertThemeMode(parsed.mode);

  return {
    name,
    displayName,
    description,
    target,
    mode,
    config: structuredClone(parsed.config),
  };
}
