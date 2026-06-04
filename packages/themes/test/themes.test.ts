import { describe, expect, test } from "bun:test";
import { getTheme, listThemes } from "../src";

describe("theme registry", () => {
  test("lists the initial themes in stable order", () => {
    expect(listThemes().map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
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
    expect(freshTheme.config.range.category[0]).toBe("#2563eb");
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
