import { readdir, stat } from "node:fs/promises";

const [label, separator, ...command] = Bun.argv.slice(2);

if (!label || separator !== "--" || command.length === 0) {
  console.error("Usage: bun scripts/run-if-sources.ts <label> -- <command...>");
  process.exit(2);
}

const ignoredDirectories = new Set(["node_modules", "dist"]);

async function hasTypeScriptSources(directory: string): Promise<boolean> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      if (await hasTypeScriptSources(`${directory}/${entry.name}`)) {
        return true;
      }

      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      return true;
    }
  }

  return false;
}

async function directoryExists(directory: string): Promise<boolean> {
  return stat(directory)
    .then((entry) => entry.isDirectory())
    .catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return false;
      }

      throw error;
    });
}

const sourceRoot = (await directoryExists(`${process.cwd()}/packages`))
  ? `${process.cwd()}/packages`
  : process.cwd();

if (!(await hasTypeScriptSources(sourceRoot))) {
  console.log(`No TypeScript sources found; skipping ${label}`);
  process.exit(0);
}

const child = Bun.spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await child.exited);
