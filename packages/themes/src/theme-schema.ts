export const THEME_FILE_ALLOWED_KEYS = [
  "name",
  "displayName",
  "description",
  "target",
  "mode",
  "config",
] as const;

const TARGETS = new Set(["paper", "slide", "web", "poster"]);
const MODES = new Set(["light", "dark", "print"]);
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertThemeTarget(value: unknown): "paper" | "slide" | "web" | "poster" {
  if (typeof value !== "string" || !TARGETS.has(value)) {
    throw new Error(`"target" must be one of: ${[...TARGETS].join(", ")}`);
  }

  return value as "paper" | "slide" | "web" | "poster";
}

export function assertThemeMode(value: unknown): "light" | "dark" | "print" {
  if (typeof value !== "string" || !MODES.has(value)) {
    throw new Error(`"mode" must be one of: ${[...MODES].join(", ")}`);
  }

  return value as "light" | "dark" | "print";
}

export function assertThemeName(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error('"name" must be a non-empty string');
  }

  if (!NAME_PATTERN.test(value)) {
    throw new Error('"name" must match ^[a-z0-9][a-z0-9-]*$');
  }

  return value;
}

export function defaultNameFromBasename(basename: string): string {
  const slug = basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "custom-theme";
}
