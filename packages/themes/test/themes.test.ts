import { describe, expect, test } from "bun:test";
import { getPalette, getTheme, listThemes } from "../src";

const THEMES_WITH_PALETTES: Array<{ name: string; paletteId: string }> = [
  { name: "paper-clean", paletteId: "carbon-categorical" },
  { name: "acl-clean", paletteId: "carbon-categorical" },
  { name: "neurips-clean", paletteId: "ft-line-web" },
  { name: "nature-soft", paletteId: "ft-line-web" },
  { name: "shadcn-light", paletteId: "catppuccin-latte" },
  { name: "shadcn-dark", paletteId: "catppuccin-mocha" },
  { name: "poster-dark", paletteId: "catppuccin-mocha" },
];

describe("theme registry", () => {
  test("lists the initial themes in stable order", () => {
    expect(listThemes().map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
      "neurips-clean",
      "shadcn-light",
      "shadcn-dark",
      "nature-soft",
      "monochrome-print",
      "poster-dark",
    ]);
  });

  test("returns a theme by name", () => {
    const theme = getTheme("paper-clean");

    expect(theme.name).toBe("paper-clean");
    expect(theme.target).toBe("paper");
    expect(theme.mode).toBe("light");
    expect(theme.config).toHaveProperty("axis");
    expect(theme.config).toHaveProperty("view");
  });

  test("returns poster-dark with poster target and dark mode", () => {
    const theme = getTheme("poster-dark");

    expect(theme.target).toBe("poster");
    expect(theme.mode).toBe("dark");
  });

  test("rejects unknown themes", () => {
    expect(() => getTheme("missing-theme")).toThrow('Unknown theme "missing-theme"');
  });

  test("listThemes returns themes that cannot corrupt registry state", () => {
    const [theme] = listThemes() as any[];

    theme.displayName = "Mutated Theme";
    theme.config.range.category[0] = "#ff00ff";

    const freshTheme = getTheme("paper-clean") as any;

    expect(freshTheme.displayName).toBe("Paper Clean");
    expect(freshTheme.config.range.category[0]).toBe("#6929C4");
  });

  test("wired themes use palette registry colors", () => {
    for (const { name, paletteId } of THEMES_WITH_PALETTES) {
      const theme = getTheme(name);
      const palette = getPalette(paletteId);
      const category = (theme.config as { range: { category: string[] } }).range.category;

      expect(theme.paletteId).toBe(paletteId);
      expect(category).toEqual([...palette.colors]);
    }
  });

  test("monochrome-print has no palette metadata and unchanged grayscale series", () => {
    const theme = getTheme("monochrome-print");

    expect(theme.paletteId).toBeUndefined();
    expect(theme.paletteAttribution).toBeUndefined();
    expect((theme.config as { range: { category: string[] } }).range.category).toEqual([
      "#111111",
      "#444444",
      "#777777",
      "#999999",
      "#bbbbbb",
      "#dddddd",
    ]);
  });

  test("paper-clean references carbon-categorical palette", () => {
    const theme = getTheme("paper-clean");

    expect(theme.paletteId).toBe("carbon-categorical");
    expect(theme.paletteAttribution?.name).toContain("Carbon");
  });

  test("getTheme returns themes that cannot corrupt registry state", () => {
    const theme = getTheme("paper-clean") as any;

    theme.name = "mutated-theme";
    theme.config.axis.labelFontSize = 999;

    const freshTheme = getTheme("paper-clean") as any;

    expect(freshTheme.name).toBe("paper-clean");
    expect(freshTheme.config.axis.labelFontSize).toBe(11);
  });
});
