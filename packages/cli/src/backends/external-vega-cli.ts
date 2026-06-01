import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { VegaPaperError } from "../core/errors";
import type { SpecType } from "../core/spec";

export type ExternalVegaCliRenderRequest = {
  specType: SpecType;
  inputPath: string;
  outputPath: string;
  format: "svg";
};

export async function renderWithExternalVegaCli(
  request: ExternalVegaCliRenderRequest,
): Promise<void> {
  const binary = getRenderBinary(request.specType, request.format);
  const command = await resolveBinary(binary);

  await runBinary(command, binary, [request.inputPath, request.outputPath]);
}

function getRenderBinary(specType: SpecType, format: "svg"): string {
  if (format !== "svg") {
    throw new VegaPaperError(
      `Unsupported format "${format}". This MVP supports only "svg".`,
    );
  }

  return specType === "vega-lite" ? "vl2svg" : "vg2svg";
}

async function resolveBinary(binary: string): Promise<string> {
  const localBinary = join("node_modules", ".bin", binary);

  try {
    await access(localBinary);
    return localBinary;
  } catch {
    const bunBinary = await getBunPackageStoreBinary(binary);

    if (bunBinary) {
      return bunBinary;
    }

    return binary;
  }
}

async function getBunPackageStoreBinary(
  binary: string,
): Promise<string | undefined> {
  const packageName = binary.startsWith("vl") ? "vega-lite" : "vega-cli";

  if (binary !== "vl2svg" && binary !== "vg2svg") {
    return undefined;
  }

  const packageStoreRoot = join("node_modules", ".bun");
  const candidates = [
    join(packageStoreRoot, "node_modules", packageName, "bin", binary),
  ];

  try {
    const entries = await readdir(packageStoreRoot);
    candidates.push(
      ...entries
        .filter((entry) => entry.startsWith(`${packageName}@`))
        .map((entry) =>
          join(packageStoreRoot, entry, "node_modules", packageName, "bin", binary),
        ),
    );
  } catch {
    return undefined;
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking through Bun's possible package-store layouts.
    }
  }

  return undefined;
}

async function runBinary(
  command: string,
  displayName: string,
  args: string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let settled = false;

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }

      settled = true;

      if (error.code === "ENOENT") {
        reject(
          new VegaPaperError(
            `Missing Vega CLI binary "${displayName}". Run "bun install" in this workspace and ensure node_modules/.bin is available.`,
          ),
        );
        return;
      }

      reject(
        new VegaPaperError(
          `Failed to start Vega CLI binary "${displayName}": ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;

      if (code === 0) {
        resolve();
        return;
      }

      const detail = stderr.trim() ? `\n${stderr.trim()}` : "";
      reject(
        new VegaPaperError(
          `Vega CLI binary "${displayName}" failed with exit code ${code}.${detail}`,
        ),
      );
    });
  });
}
