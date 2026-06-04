import { resolveThemeRef, type VegaPaperTheme } from "@vega-paper/themes";
import { VegaPaperError } from "./errors";

export async function getCliTheme(
  ref: string,
  options?: { cwd?: string },
): Promise<VegaPaperTheme> {
  try {
    return await resolveThemeRef(ref, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new VegaPaperError(error.message);
    }

    throw error;
  }
}
