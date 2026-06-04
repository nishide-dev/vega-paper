import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveVegaCliBinary as resolveInstalledVegaCliBinary,
  type VegaCliBinaryName,
} from "../backends/external-vega-cli";
import { resolveExecutableOnPath } from "./install-root";

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
  resolveVegaCliBinary: (name: VegaCliBinaryName) => Promise<string | undefined>;
};

export function getDoctorExitCode(checks: DoctorCheck[]): 0 | 1 {
  return checks.some((check) => check.required && check.status === "fail") ? 1 : 0;
}

export async function runDoctorChecks(
  environment: DoctorEnvironment = defaultDoctorEnvironment,
): Promise<DoctorCheck[]> {
  const [bunVersion, nodeVersion, vegaPaperBin, vl2svg, vl2png, vl2pdf, vg2svg, vg2png, vg2pdf] =
    await Promise.all([
      environment.getBunVersion(),
      environment.getNodeVersion(),
      environment.resolveExecutable("vega-paper"),
      environment.resolveVegaCliBinary("vl2svg"),
      environment.resolveVegaCliBinary("vl2png"),
      environment.resolveVegaCliBinary("vl2pdf"),
      environment.resolveVegaCliBinary("vg2svg"),
      environment.resolveVegaCliBinary("vg2png"),
      environment.resolveVegaCliBinary("vg2pdf"),
    ]);

  return [
    requiredCheck("bun", bunVersion),
    requiredCheck("node", nodeVersion),
    requiredCheck("vega-paper bin", vegaPaperBin),
    requiredCheck("vl2svg", vl2svg),
    requiredCheck("vl2png", vl2png),
    requiredCheck("vl2pdf", vl2pdf),
    requiredCheck("vg2svg", vg2svg),
    requiredCheck("vg2png", vg2png),
    requiredCheck("vg2pdf", vg2pdf),
  ];
}

function requiredCheck(name: string, value: string | undefined): DoctorCheck {
  return value
    ? { name, status: "ok", message: value, required: true }
    : { name, status: "fail", message: "not found", required: true };
}

export const defaultDoctorEnvironment: DoctorEnvironment = {
  getBunVersion: async () => Bun.version,
  getNodeVersion,
  resolveExecutable,
  resolveVegaCliBinary: resolveEffectiveVegaCliBinary,
};

async function resolveExecutable(name: string): Promise<string | undefined> {
  const onPath = await resolveExecutableOnPath(name);

  if (onPath) {
    return onPath;
  }

  const localBinary = join("node_modules", ".bin", name);

  try {
    await access(localBinary);
    return localBinary;
  } catch {
    return undefined;
  }
}

async function resolveEffectiveVegaCliBinary(name: VegaCliBinaryName): Promise<string | undefined> {
  return resolveInstalledVegaCliBinary(name);
}

async function getNodeVersion(): Promise<string | undefined> {
  const nodeBinary = await resolveExecutableOnPath("node");

  if (!nodeBinary) {
    return undefined;
  }

  return new Promise((resolve) => {
    const child = spawn(nodeBinary, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(undefined);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;

      if (code !== 0) {
        resolve(undefined);
        return;
      }

      resolve(stdout.trim() || stderr.trim() || undefined);
    });
  });
}
