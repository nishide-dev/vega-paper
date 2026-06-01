import { describe, expect, test } from "bun:test";
import {
  getDoctorExitCode,
  runDoctorChecks,
  type DoctorEnvironment,
} from "../src/core/doctor";

describe("doctor core", () => {
  test("returns exit code 0 when required checks pass and optional checks warn", () => {
    expect(
      getDoctorExitCode([
        { name: "bun", status: "ok", message: "1.3.14", required: true },
        { name: "pdf/png", status: "warn", message: "not checked", required: false },
      ]),
    ).toBe(0);
  });

  test("returns exit code 1 when a required check fails", () => {
    expect(
      getDoctorExitCode([
        { name: "bun", status: "fail", message: "not found", required: true },
        { name: "pdf/png", status: "warn", message: "not checked", required: false },
      ]),
    ).toBe(1);
  });

  test("runs injected checks", async () => {
    const environment: DoctorEnvironment = {
      getBunVersion: async () => "1.3.14",
      getNodeVersion: async () => "v25.9.0",
      resolveExecutable: async (name) =>
        name === "vega-paper" ? "node_modules/.bin/vega-paper" : undefined,
      resolveVegaCliBinary: async (name) =>
        name === "vl2svg" ? "node_modules/.bun/vega-lite/bin/vl2svg" : "node_modules/.bun/vega-cli/bin/vg2svg",
    };

    expect(await runDoctorChecks(environment)).toEqual([
      { name: "bun", status: "ok", message: "1.3.14", required: true },
      { name: "node", status: "ok", message: "v25.9.0", required: true },
      {
        name: "vega-paper bin",
        status: "ok",
        message: "node_modules/.bin/vega-paper",
        required: true,
      },
      {
        name: "vl2svg",
        status: "ok",
        message: "node_modules/.bun/vega-lite/bin/vl2svg",
        required: true,
      },
      {
        name: "vg2svg",
        status: "ok",
        message: "node_modules/.bun/vega-cli/bin/vg2svg",
        required: true,
      },
      {
        name: "pdf/png",
        status: "warn",
        message: "not checked in this MVP",
        required: false,
      },
    ]);
  });
});
