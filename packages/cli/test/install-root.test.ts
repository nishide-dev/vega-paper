import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  isReleaseInstallHome,
  resolveCliPackageRootFromMeta,
  resolveInstallBinDirectory,
  resolveInstallBinDirectoryAsync,
} from "../src/core/install-root";

describe("install-root", () => {
  test("resolveCliPackageRootFromMeta walks up from src/core to packages/cli", () => {
    const metaUrl = new URL("../src/core/install-root.ts", import.meta.url).href;
    const root = resolveCliPackageRootFromMeta(metaUrl);
    expect(root.endsWith(join("packages", "cli"))).toBe(true);
  });

  test("resolveCliPackageRootFromMeta walks up from dist to packages/cli", () => {
    const metaUrl = new URL("../dist/index.js", import.meta.url).href;
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

  test("resolveInstallBinDirectoryAsync uses release bin directory", async () => {
    const original = process.env.VEGA_PAPER_HOME;
    process.env.VEGA_PAPER_HOME = "/tmp/vega-paper-release-home";

    try {
      await mkdir("/tmp/vega-paper-release-home/lib/node_modules", { recursive: true });
      expect(await resolveInstallBinDirectoryAsync(import.meta.url)).toBe(
        join("/tmp/vega-paper-release-home", "bin"),
      );
      expect(await isReleaseInstallHome("/tmp/vega-paper-release-home")).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.VEGA_PAPER_HOME;
      } else {
        process.env.VEGA_PAPER_HOME = original;
      }
    }
  });
});
