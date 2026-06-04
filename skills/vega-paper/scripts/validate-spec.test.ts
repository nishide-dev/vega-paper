import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { resolveCliEntry } from "./cli";
import {
  buildValidateSpecCommand,
  parseValidateSpecArgs,
  runValidateSpec,
} from "./validate-spec";

const REPO_ROOT = "/repo";

describe("buildValidateSpecCommand", () => {
  test("uses default paper profile", () => {
    expect(
      buildValidateSpecCommand(REPO_ROOT, {
        specPath: "figures/f1.vl.json",
        lintProfile: "paper",
        strict: false,
      }),
    ).toEqual([
      "bun",
      resolveCliEntry(REPO_ROOT),
      "lint",
      "figures/f1.vl.json",
      "--profile",
      "paper",
    ]);
  });

  test("passes strict and custom profile", () => {
    expect(
      buildValidateSpecCommand(REPO_ROOT, {
        specPath: "chart.vl.json",
        lintProfile: "acl",
        strict: true,
      }),
    ).toEqual([
      "bun",
      resolveCliEntry(REPO_ROOT),
      "lint",
      "chart.vl.json",
      "--profile",
      "acl",
      "--strict",
    ]);
  });
});

describe("parseValidateSpecArgs", () => {
  test("parses defaults", () => {
    expect(parseValidateSpecArgs(["figures/f1.vl.json"])).toEqual({
      specPath: "figures/f1.vl.json",
      lintProfile: "paper",
      strict: false,
    });
  });

  test("parses lint-profile alias and strict", () => {
    expect(parseValidateSpecArgs(["chart.vl.json", "--lint-profile", "web", "--strict"])).toEqual({
      specPath: "chart.vl.json",
      lintProfile: "web",
      strict: true,
    });
  });

  test("accepts --profile alias", () => {
    expect(parseValidateSpecArgs(["chart.vl.json", "--profile", "acl"])).toEqual({
      specPath: "chart.vl.json",
      lintProfile: "acl",
      strict: false,
    });
  });
});

describe("runValidateSpec", () => {
  test("delegates exit code from spawned CLI", async () => {
    const calls: Array<{ command: string[]; cwd: string }> = [];

    const exitCode = await runValidateSpec(
      {
        specPath: "figures/f1.vl.json",
        lintProfile: "paper",
        strict: false,
      },
      (command, options) => {
        calls.push({ command, cwd: options.cwd });
        return { exited: Promise.resolve(1) };
      },
      REPO_ROOT,
    );

    expect(exitCode).toBe(1);
    expect(calls).toEqual([
      {
        command: buildValidateSpecCommand(REPO_ROOT, {
          specPath: "figures/f1.vl.json",
          lintProfile: "paper",
          strict: false,
        }),
        cwd: REPO_ROOT,
      },
    ]);
  });
});

describe("resolveCliEntry", () => {
  test("points at packages/cli entry from repo root", () => {
    expect(resolveCliEntry(REPO_ROOT)).toBe(join(REPO_ROOT, "packages/cli/src/index.ts"));
  });
});
