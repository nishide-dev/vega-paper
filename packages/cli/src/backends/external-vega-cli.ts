import { spawn } from "node:child_process";
import { access, readdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { VegaPaperError } from "../core/errors";
import {
  resolveCliPackageRootFromMeta,
  resolveExecutableOnPath,
  resolveInstallBinDirectoryAsync,
  resolveVegaPaperHome,
  shouldUseCliPackageInstallBin,
} from "../core/install-root";
import type { RenderFormat } from "../core/render-format";
import type { SpecType } from "../core/spec";

export type ExternalVegaCliRenderRequest = {
  specType: SpecType;
  inputPath: string;
  outputPath: string;
  format: RenderFormat;
  scale?: number | undefined;
};

export type VegaCliBinaryName = "vl2svg" | "vl2png" | "vl2pdf" | "vg2svg" | "vg2png" | "vg2pdf";

export function getVegaCliBinaryName(specType: SpecType, format: RenderFormat): VegaCliBinaryName {
  const prefix = specType === "vega-lite" ? "vl2" : "vg2";
  return `${prefix}${format}` as VegaCliBinaryName;
}

export async function renderWithExternalVegaCli(
  request: ExternalVegaCliRenderRequest,
): Promise<void> {
  const binary = getVegaCliBinaryName(request.specType, request.format);
  const command = (await resolveVegaCliBinary(binary)) ?? binary;
  const args = buildVegaCliArgs(request);

  await runBinary(command, binary, args);
}

export function buildVegaCliArgs(request: ExternalVegaCliRenderRequest): string[] {
  const args: string[] = [];
  const scale = request.scale ?? 1;

  if (scale !== 1) {
    args.push("-s", String(scale));
  }

  args.push(request.inputPath, request.outputPath);
  return args;
}

export async function resolveVegaCliBinary(binary: VegaCliBinaryName): Promise<string | undefined> {
  const workspace = await getWorkspacePath();
  const candidates: string[] = [];

  if (resolveVegaPaperHome()) {
    candidates.push(join(await resolveInstallBinDirectoryAsync(), binary));
  }

  candidates.push(join(workspace, "node_modules", ".bin", binary));

  if (await shouldUseCliPackageInstallBin()) {
    candidates.push(
      join(resolveCliPackageRootFromMeta(import.meta.url), "node_modules", ".bin", binary),
    );
  }

  candidates.push(...(await getBunPackageStoreCandidates(binary, workspace)));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate layout.
    }
  }

  return resolveExecutableOnPath(binary);
}

async function getWorkspacePath(): Promise<string> {
  const cwd = process.cwd();
  const tempRoot = tmpdir();

  try {
    const realTempRoot = await realpath(tempRoot);

    if (cwd === realTempRoot || cwd.startsWith(`${realTempRoot}${sep}`)) {
      return join(tempRoot, cwd.slice(realTempRoot.length));
    }
  } catch {
    // Fall back to the runtime cwd when the platform temp root is unavailable.
  }

  return cwd;
}

async function getBunPackageStoreCandidates(
  binary: VegaCliBinaryName,
  workspace: string,
): Promise<string[]> {
  const packageName = binary.startsWith("vl2") ? "vega-lite" : "vega-cli";
  const packageStoreRoot = join(workspace, "node_modules", ".bun");
  const candidates = [join(packageStoreRoot, "node_modules", packageName, "bin", binary)];

  try {
    const entries = await readdir(packageStoreRoot);
    candidates.push(
      ...entries
        .filter((entry) => entry.startsWith(`${packageName}@`))
        .map((entry) => join(packageStoreRoot, entry, "node_modules", packageName, "bin", binary)),
    );
  } catch {
    return candidates;
  }

  return candidates;
}

async function runBinary(command: string, displayName: string, args: string[]): Promise<void> {
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
            `Missing Vega CLI binary "${displayName}". Install vega-paper via install.sh or ensure ${displayName} is on PATH.`,
          ),
        );
        return;
      }

      reject(
        new VegaPaperError(`Failed to start Vega CLI binary "${displayName}": ${error.message}`),
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
