import { access, readFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function isReleaseInstallHome(home: string): Promise<boolean> {
  try {
    await access(join(home, "lib", "node_modules"));
    return true;
  } catch {
    return false;
  }
}

export function resolveCliPackageRootFromMeta(importMetaUrl: string): string {
  const moduleDirectory = dirname(fileURLToPath(importMetaUrl));

  if (moduleDirectory.endsWith(join("dist", "core"))) {
    return join(moduleDirectory, "..", "..");
  }

  if (moduleDirectory.endsWith(join("src", "core"))) {
    return join(moduleDirectory, "..", "..");
  }

  if (moduleDirectory.endsWith("dist")) {
    return join(moduleDirectory, "..");
  }

  if (moduleDirectory.endsWith("bin")) {
    return join(moduleDirectory, "..");
  }

  return join(moduleDirectory, "..", "..");
}

export function resolveVegaPaperHome(): string | undefined {
  const home = process.env.VEGA_PAPER_HOME?.trim();
  return home && home.length > 0 ? home : undefined;
}

export function resolveInstallBinDirectory(importMetaUrl: string = import.meta.url): string {
  const home = resolveVegaPaperHome();

  if (home) {
    return join(home, "node_modules", ".bin");
  }

  return join(resolveCliPackageRootFromMeta(importMetaUrl), "node_modules", ".bin");
}

export async function resolveInstallBinDirectoryAsync(
  importMetaUrl: string = import.meta.url,
): Promise<string> {
  const home = resolveVegaPaperHome();

  if (home) {
    if (await isReleaseInstallHome(home)) {
      return join(home, "bin");
    }

    return join(home, "node_modules", ".bin");
  }

  return join(resolveCliPackageRootFromMeta(importMetaUrl), "node_modules", ".bin");
}

export async function shouldUseCliPackageInstallBin(
  importMetaUrl: string = import.meta.url,
): Promise<boolean> {
  if (resolveVegaPaperHome()) {
    return true;
  }

  const cliPackageRoot = resolveCliPackageRootFromMeta(importMetaUrl);
  const workspaceRoot = join(cliPackageRoot, "..", "..");

  try {
    const packageJson = JSON.parse(await readFile(join(workspaceRoot, "package.json"), "utf8")) as {
      workspaces?: unknown;
    };

    if (packageJson.workspaces !== undefined) {
      return false;
    }
  } catch {
    // Not a monorepo checkout; treat as a published install layout.
  }

  return true;
}

export async function resolveCliNodeModulesDirectory(
  importMetaUrl: string = import.meta.url,
): Promise<string> {
  const home = resolveVegaPaperHome();

  if (home) {
    if (await isReleaseInstallHome(home)) {
      return join(home, "lib", "node_modules");
    }

    return join(home, "node_modules");
  }

  return join(resolveCliPackageRootFromMeta(importMetaUrl), "node_modules");
}

export async function resolveExecutableOnPath(name: string): Promise<string | undefined> {
  const pathValue = process.env.PATH ?? "";

  for (const directory of pathValue.split(delimiter)) {
    if (!directory) {
      continue;
    }

    const candidate = join(directory, name);

    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking through PATH entries.
    }
  }

  return undefined;
}
