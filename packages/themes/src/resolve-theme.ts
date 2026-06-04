import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { loadThemeFromFile } from "./load-theme-file";
import { getTheme, type VegaPaperTheme } from "./registry";

export type ResolveThemeRefOptions = {
  cwd?: string;
};

export function looksLikeThemePath(ref: string): boolean {
  if (ref.startsWith(".") || ref.startsWith("~") || ref.startsWith("/")) {
    return true;
  }

  if (/^[A-Za-z]:[\\/]/.test(ref) || ref.startsWith("\\\\")) {
    return true;
  }

  if (ref.includes("/") || ref.includes("\\")) {
    return true;
  }

  return ref.endsWith(".json");
}

export async function resolveThemeRef(
  ref: string,
  options: ResolveThemeRefOptions = {},
): Promise<VegaPaperTheme> {
  const cwd = options.cwd ?? process.cwd();

  if (!looksLikeThemePath(ref)) {
    try {
      return getTheme(ref);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== `Unknown theme "${ref}"`) {
        throw error;
      }
    }
  }

  const expandedRef = expandUserPath(ref);
  const candidatePaths = isAbsolute(expandedRef)
    ? [expandedRef]
    : [join(cwd, expandedRef), expandedRef];

  for (const candidatePath of candidatePaths) {
    if (await Bun.file(candidatePath).exists()) {
      try {
        return await loadThemeFromFile(candidatePath);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid theme file ${candidatePath}: ${detail}`);
      }
    }
  }

  if (!looksLikeThemePath(ref)) {
    try {
      return getTheme(ref);
    } catch {
      // fall through to unknown theme error
    }
  }

  throw new Error(
    `Unknown theme "${ref}". Use a built-in name (vega-paper themes list) or a path to a .json theme file.`,
  );
}

function expandUserPath(ref: string): string {
  if (ref === "~") {
    return homedir();
  }

  if (ref.startsWith("~/")) {
    return join(homedir(), ref.slice(2));
  }

  return ref;
}
