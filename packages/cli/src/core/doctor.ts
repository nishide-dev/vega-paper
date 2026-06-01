import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveVegaCliBinary,
  type VegaCliBinaryName,
} from "../backends/external-vega-cli";

export type DoctorCheckStatus = "ok" | "warn" | "fail";

export type DoctorCheck = {
  name: string;
  status: DoctorCheckStatus;
  message: string;
  required: boolean;
  details?: Record<string, unknown>;
};

export type DoctorEnvironment = {
  getBunVersion: () => Promise<string | undefined>;
  getNodeVersion: () => Promise<string | undefined>;
  resolveExecutable: (name: string) => Promise<string | undefined>;
  resolveVegaCliBinary: (
    name: VegaCliBinaryName,
  ) => Promise<string | undefined>;
};

export function getDoctorExitCode(checks: DoctorCheck[]): 0 | 1 {
  return checks.some((check) => check.required && check.status === "fail")
    ? 1
    : 0;
}

export async function runDoctorChecks(
  environment: DoctorEnvironment = defaultDoctorEnvironment,
): Promise<DoctorCheck[]> {
  const [bunVersion, nodeVersion, vegaPaperBin, vl2svg, vg2svg] =
    await Promise.all([
      environment.getBunVersion(),
      environment.getNodeVersion(),
      environment.resolveExecutable("vega-paper"),
      environment.resolveVegaCliBinary("vl2svg"),
      environment.resolveVegaCliBinary("vg2svg"),
    ]);

  return [
    requiredCheck("bun", bunVersion),
    requiredCheck("node", nodeVersion),
    requiredCheck("vega-paper bin", vegaPaperBin),
    requiredCheck("vl2svg", vl2svg),
    requiredCheck("vg2svg", vg2svg),
    {
      name: "pdf/png",
      status: "warn",
      message: "not checked in this MVP",
      required: false,
    },
  ];
}

function requiredCheck(name: string, value: string | undefined): DoctorCheck {
  return value
    ? { name, status: "ok", message: value, required: true }
    : { name, status: "fail", message: "not found", required: true };
}

export const defaultDoctorEnvironment: DoctorEnvironment = {
  getBunVersion: async () => Bun.version,
  getNodeVersion: async () => process.version,
  resolveExecutable,
  resolveVegaCliBinary,
};

async function resolveExecutable(name: string): Promise<string | undefined> {
  const localBinary = join("node_modules", ".bin", name);

  try {
    await access(localBinary);
    return localBinary;
  } catch {
    return undefined;
  }
}
