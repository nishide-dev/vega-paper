import { describe, expect, test } from "bun:test";
import { getPalette, listPalettes } from "../src/palettes/registry";

describe("palette registry", () => {
  test("lists four palettes in stable order", () => {
    expect(listPalettes().map((palette) => palette.id)).toEqual([
      "carbon-categorical",
      "ft-line-web",
      "catppuccin-latte",
      "catppuccin-mocha",
    ]);
  });

  test("carbon-categorical colors match spec", () => {
    expect(getPalette("carbon-categorical").colors).toEqual([
      "#6929C4",
      "#1192E8",
      "#005D5D",
      "#9F1853",
      "#FA4D56",
      "#198038",
    ]);
  });

  test("ft-line-web colors match spec", () => {
    expect(getPalette("ft-line-web").colors).toEqual([
      "#0F5499",
      "#EB5E8D",
      "#70DCE6",
      "#9DBF57",
      "#208FCE",
      "#7F062E",
    ]);
  });

  test("catppuccin-latte colors match spec", () => {
    expect(getPalette("catppuccin-latte").colors).toEqual([
      "#1E66F5",
      "#179299",
      "#FE640B",
      "#8839EF",
      "#40A02B",
      "#D20F39",
    ]);
  });

  test("catppuccin-mocha colors match spec", () => {
    expect(getPalette("catppuccin-mocha").colors).toEqual([
      "#89B4FA",
      "#94E2D5",
      "#FAB387",
      "#CBA6F7",
      "#A6E3A1",
      "#F38BA8",
    ]);
  });

  test("rejects unknown palette id", () => {
    expect(() => getPalette("missing-palette")).toThrow('Unknown palette "missing-palette"');
  });
});
