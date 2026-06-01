import { describe, expect, test } from "bun:test";
import { formatTable, toPrettyJson } from "../src/core/format";

describe("formatTable", () => {
  test("formats headers and rows with stable spacing", () => {
    expect(
      formatTable({
        headers: ["name", "mode"],
        rows: [
          ["paper-clean", "light"],
          ["monochrome-print", "print"],
        ],
      }),
    ).toBe(
      [
        "name              mode",
        "paper-clean       light",
        "monochrome-print  print",
      ].join("\n"),
    );
  });

  test("returns an empty string for no rows and no headers", () => {
    expect(formatTable({ headers: [], rows: [] })).toBe("");
  });

  test("formats rows without injecting an empty header row", () => {
    expect(formatTable({ headers: [], rows: [["paper-clean", "light"]] })).toBe(
      "paper-clean  light",
    );
  });
});

describe("toPrettyJson", () => {
  test("prints stable pretty JSON with a trailing newline", () => {
    expect(toPrettyJson({ ok: true })).toBe('{\n  "ok": true\n}\n');
  });
});
