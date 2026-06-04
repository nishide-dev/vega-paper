import { aclClean } from "./acl-clean";
import { monochromePrint } from "./monochrome-print";
import { natureSoft } from "./nature-soft";
import { paperClean } from "./paper-clean";
import { posterDark } from "./poster-dark";
import { shadcnDark } from "./shadcn-dark";
import { shadcnLight } from "./shadcn-light";

export type VegaPaperThemeTarget = "paper" | "slide" | "web" | "poster";
export type VegaPaperThemeMode = "light" | "dark" | "print";

export interface VegaPaperTheme {
  name: string;
  displayName: string;
  description: string;
  target: VegaPaperThemeTarget;
  mode: VegaPaperThemeMode;
  config: Record<string, unknown>;
}

export const themes = [
  paperClean,
  aclClean,
  shadcnLight,
  shadcnDark,
  natureSoft,
  monochromePrint,
  posterDark,
] as const;

export function listThemes(): VegaPaperTheme[] {
  return themes.map(cloneTheme);
}

export function getTheme(name: string): VegaPaperTheme {
  const theme = themes.find((candidate) => candidate.name === name);

  if (!theme) {
    throw new Error(`Unknown theme "${name}"`);
  }

  return cloneTheme(theme);
}

function cloneTheme(theme: VegaPaperTheme): VegaPaperTheme {
  return structuredClone(theme);
}
