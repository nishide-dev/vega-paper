import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import {
  DEFAULT_LINT_PROFILE_NAME,
  getLintProfile,
  listLintProfileNames,
} from "../src/core/lint-profiles";

describe("lint profiles", () => {
  test("uses paper as the default lint profile", () => {
    expect(DEFAULT_LINT_PROFILE_NAME).toBe("paper");
    expect(getLintProfile()).toEqual(getLintProfile("paper"));
  });

  test("returns the paper profile thresholds", () => {
    expect(getLintProfile("paper")).toEqual({
      name: "paper",
      titleMaxLength: 90,
      widthRange: { min: 180, max: 720 },
      heightRange: { min: 120, max: 540 },
      maxInlineRows: 500,
      maxColorCategories: 12,
      minFontSize: 8,
      grayscaleSafe: false,
    });
  });

  test("returns the web profile thresholds", () => {
    expect(getLintProfile("web")).toEqual({
      name: "web",
      titleMaxLength: 120,
      widthRange: { min: 240, max: 1200 },
      heightRange: { min: 160, max: 800 },
      maxInlineRows: 1000,
      maxColorCategories: 20,
      minFontSize: 10,
      grayscaleSafe: false,
    });
  });

  test("returns the acl profile thresholds", () => {
    expect(getLintProfile("acl")).toEqual({
      name: "acl",
      titleMaxLength: 70,
      widthRange: { min: 240, max: 480 },
      heightRange: { min: 160, max: 360 },
      maxInlineRows: 300,
      maxColorCategories: 8,
      minFontSize: 9,
      grayscaleSafe: false,
    });
  });

  test("returns the print profile thresholds", () => {
    expect(getLintProfile("print")).toEqual({
      name: "print",
      titleMaxLength: 70,
      widthRange: { min: 180, max: 480 },
      heightRange: { min: 120, max: 360 },
      maxInlineRows: 300,
      maxColorCategories: 6,
      minFontSize: 9,
      grayscaleSafe: true,
    });
  });

  test("lists profile names in stable order", () => {
    expect(listLintProfileNames()).toEqual(["paper", "web", "acl", "print"]);
  });

  test("throws a CLI error for unknown profiles", () => {
    expect(() => getLintProfile("unknown")).toThrow(VegaPaperError);
    expect(() => getLintProfile("unknown")).toThrow(
      'Unknown lint profile "unknown". Expected one of: paper, web, acl, print.',
    );
  });
});
