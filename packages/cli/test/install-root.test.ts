import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  resolveCliPackageRootFromMeta,
  resolveInstallBinDirectory,
} from "../src/core/install-root";

describe("install-root", () => {
  test("resolveCliPackageRootFromMeta walks up from src/core to packages/cli", () => {
    const metaUrl = new URL("../src/core/install-root.ts", import.meta.url).href;
    const root = resolveCliPackageRootFromMeta(metaUrl);
    expect(root.endsWith(join("packages", "cli"))).toBe(true);
  });

  test("resolveInstallBinDirectory prefers VEGA_PAPER_HOME", () => {
    const original = process.env.VEGA_PAPER_HOME;
    process.env.VEGA_PAPER_HOME = "/tmp/vega-paper-home";

    try {
      expect(resolveInstallBinDirectory(import.meta.url)).toBe(
        join("/tmp/vega-paper-home", "node_modules", ".bin"),
      );
    } finally {
      if (original === undefined) {
        delete process.env.VEGA_PAPER_HOME;
      } else {
        process.env.VEGA_PAPER_HOME = original;
      }
    }
  });
});
