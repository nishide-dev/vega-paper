# VegaPaper Doctor and Themes CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `vega-paper themes list/show` and `vega-paper doctor` so users and AI agents can inspect available themes and diagnose SVG render readiness.

**Architecture:** Add thin CLI command modules for `themes` and `doctor`, backed by focused core helpers for formatting and doctor checks. Reuse the existing theme registry and extract the external Vega CLI binary resolver so render and doctor share the same supported Bun/package-store layouts.

**Tech Stack:** Bun, TypeScript, Commander, Bun test, existing VegaPaper CLI packages.

---

## File Structure

- Modify `packages/cli/src/index.ts`: register the new command groups.
- Modify `packages/cli/src/backends/external-vega-cli.ts`: export reusable binary resolution helpers.
- Create `packages/cli/src/core/format.ts`: table/JSON formatting helpers.
- Create `packages/cli/src/core/doctor.ts`: structured doctor checks and overall status helpers.
- Create `packages/cli/src/commands/themes.ts`: `themes list` and `themes show` commands.
- Create `packages/cli/src/commands/doctor.ts`: `doctor` command.
- Create `packages/cli/test/format.test.ts`: table formatting tests.
- Create `packages/cli/test/themes-command.test.ts`: themes command tests.
- Create `packages/cli/test/doctor.test.ts`: doctor core tests.
- Modify `packages/cli/test/external-vega-cli.test.ts`: cover exported resolver behavior.

## Task 1: Extract Shared Vega CLI Binary Resolution

**Files:**
- Modify: `packages/cli/src/backends/external-vega-cli.ts`
- Modify: `packages/cli/test/external-vega-cli.test.ts`

- [ ] **Step 1: Add failing resolver tests**

Modify `packages/cli/test/external-vega-cli.test.ts` to import the resolver:

```ts
import {
  renderWithExternalVegaCli,
  resolveVegaCliBinary,
} from "../src/backends/external-vega-cli";
```

Add these tests inside the existing `describe("renderWithExternalVegaCli", ...)` block:

```ts
  test("resolves local node_modules bin before Bun package-store bins", async () => {
    await withTemporaryWorkspace(async (workspace) => {
      const localBinary = join(workspace, "node_modules", ".bin", "vl2svg");
      await createExecutable(localBinary, "#!/bin/sh\nexit 0\n");
      await createExecutable(
        join(
          workspace,
          "node_modules",
          ".bun",
          "node_modules",
          "vega-lite",
          "bin",
          "vl2svg",
        ),
        "#!/bin/sh\nexit 0\n",
      );

      expect(await resolveVegaCliBinary("vl2svg")).toBe(localBinary);
    });
  });

  test("returns undefined when a Vega CLI binary is not resolvable", async () => {
    await withTemporaryWorkspace(async () => {
      expect(await resolveVegaCliBinary("vl2svg")).toBeUndefined();
    });
  });
```

- [ ] **Step 2: Run resolver tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/external-vega-cli.test.ts
```

Expected: FAIL because `resolveVegaCliBinary` is not exported.

- [ ] **Step 3: Export the resolver**

Modify `packages/cli/src/backends/external-vega-cli.ts` so `renderWithExternalVegaCli` calls an exported helper:

```ts
export type VegaCliBinaryName = "vl2svg" | "vg2svg";

export async function resolveVegaCliBinary(
  binary: VegaCliBinaryName,
): Promise<string | undefined> {
  const localBinary = join("node_modules", ".bin", binary);

  try {
    await access(localBinary);
    return localBinary;
  } catch {
    return getBunPackageStoreBinary(binary);
  }
}
```

Update `renderWithExternalVegaCli` to preserve PATH fallback behavior:

```ts
export async function renderWithExternalVegaCli(
  request: ExternalVegaCliRenderRequest,
): Promise<void> {
  const binary = getRenderBinary(request.specType, request.format);
  const command = (await resolveVegaCliBinary(binary)) ?? binary;

  await runBinary(command, binary, [request.inputPath, request.outputPath]);
}
```

Update `getRenderBinary` to return `VegaCliBinaryName`:

```ts
function getRenderBinary(specType: SpecType, format: "svg"): VegaCliBinaryName {
  if (format !== "svg") {
    throw new VegaPaperError(
      `Unsupported format "${format}". This MVP supports only "svg".`,
    );
  }

  return specType === "vega-lite" ? "vl2svg" : "vg2svg";
}
```

Update `getBunPackageStoreBinary` signature:

```ts
async function getBunPackageStoreBinary(
  binary: VegaCliBinaryName,
): Promise<string | undefined> {
  const packageName = binary === "vl2svg" ? "vega-lite" : "vega-cli";
  // keep the existing candidate search logic
}
```

- [ ] **Step 4: Run focused and broad checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/external-vega-cli.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/backends/external-vega-cli.ts packages/cli/test/external-vega-cli.test.ts
git commit -m "refactor: share vega cli binary resolution"
```

## Task 2: Add Formatting Helpers

**Files:**
- Create: `packages/cli/src/core/format.ts`
- Create: `packages/cli/test/format.test.ts`

- [ ] **Step 1: Write failing format tests**

Create `packages/cli/test/format.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { formatTable, toPrettyJson } from "../src/core/format";

describe("formatTable", () => {
  test("formats headers and rows with stable spacing", () => {
    expect(
      formatTable({
        headers: ["name", "mode"],
        rows: [
          ["paper-clean", "light"],
          ["monochrome-print", "print"],
        ],
      }),
    ).toBe(
      [
        "name              mode",
        "paper-clean       light",
        "monochrome-print  print",
      ].join("\n"),
    );
  });

  test("returns an empty string for no rows and no headers", () => {
    expect(formatTable({ headers: [], rows: [] })).toBe("");
  });
});

describe("toPrettyJson", () => {
  test("prints stable pretty JSON with a trailing newline", () => {
    expect(toPrettyJson({ ok: true })).toBe('{\n  "ok": true\n}\n');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/format.test.ts
```

Expected: FAIL because `core/format.ts` does not exist.

- [ ] **Step 3: Implement formatting helpers**

Create `packages/cli/src/core/format.ts` with:

```ts
export type TableInput = {
  headers: string[];
  rows: string[][];
};

export function formatTable(input: TableInput): string {
  if (input.headers.length === 0 && input.rows.length === 0) {
    return "";
  }

  const allRows = [input.headers, ...input.rows];
  const columnCount = Math.max(...allRows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(...allRows.map((row) => row[columnIndex]?.length ?? 0)),
  );

  return allRows.map((row) => formatRow(row, widths)).join("\n");
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatRow(row: string[], widths: number[]): string {
  return widths
    .map((width, columnIndex) => {
      const value = row[columnIndex] ?? "";
      const isLastColumn = columnIndex === widths.length - 1;

      return isLastColumn ? value : value.padEnd(width + 2, " ");
    })
    .join("")
    .trimEnd();
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/format.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/format.ts packages/cli/test/format.test.ts
git commit -m "feat: add cli formatting helpers"
```

## Task 3: Add Themes Command

**Files:**
- Create: `packages/cli/src/commands/themes.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/test/themes-command.test.ts`

- [ ] **Step 1: Write failing themes command tests**

Create `packages/cli/test/themes-command.test.ts` with:

```ts
import { Command } from "commander";
import { describe, expect, test } from "bun:test";
import { registerThemesCommand } from "../src/commands/themes";
import { VegaPaperError } from "../src/core/errors";

describe("themes command", () => {
  test("prints theme list as a table", async () => {
    const output = await runThemesCommand(["themes", "list"]);

    expect(output.stdout).toContain("name");
    expect(output.stdout).toContain("paper-clean");
    expect(output.stdout).toContain("acl-clean");
    expect(output.stdout).toContain("shadcn-light");
    expect(output.stdout).toContain("monochrome-print");
  });

  test("prints theme list as JSON", async () => {
    const output = await runThemesCommand(["themes", "list", "--json"]);
    const themes = JSON.parse(output.stdout) as Array<{ name: string }>;

    expect(themes.map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
      "shadcn-light",
      "monochrome-print",
    ]);
  });

  test("prints a theme as JSON", async () => {
    const output = await runThemesCommand(["themes", "show", "paper-clean", "--json"]);
    const theme = JSON.parse(output.stdout) as { name: string; config: unknown };

    expect(theme.name).toBe("paper-clean");
    expect(theme.config).toBeDefined();
  });

  test("throws VegaPaperError for unknown themes", async () => {
    await expect(
      runThemesCommand(["themes", "show", "missing-theme"]),
    ).rejects.toBeInstanceOf(VegaPaperError);
  });
});

async function runThemesCommand(args: string[]): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerThemesCommand(program, (value) => {
    stdout += value;
  });
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/themes-command.test.ts
```

Expected: FAIL because `commands/themes.ts` does not exist.

- [ ] **Step 3: Implement themes command**

Create `packages/cli/src/commands/themes.ts` with:

```ts
import { getTheme, listThemes } from "@vega-paper/themes";
import { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import { formatTable, toPrettyJson } from "../core/format";

type JsonOption = {
  json?: boolean;
};

type WriteOutput = (value: string) => void;

export function registerThemesCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
): void {
  const themes = program.command("themes").description("Inspect VegaPaper themes");

  themes
    .command("list")
    .description("List available themes")
    .option("--json", "print JSON")
    .action((options: JsonOption) => {
      const availableThemes = listThemes();

      if (options.json) {
        writeOutput(toPrettyJson(availableThemes));
        return;
      }

      writeOutput(
        `${formatTable({
          headers: ["name", "target", "mode", "description"],
          rows: availableThemes.map((theme) => [
            theme.name,
            theme.target,
            theme.mode,
            theme.description,
          ]),
        })}\n`,
      );
    });

  themes
    .command("show")
    .argument("<name>", "theme name")
    .description("Show a theme")
    .option("--json", "print JSON")
    .action((name: string, options: JsonOption) => {
      const theme = getCliTheme(name);

      if (options.json) {
        writeOutput(toPrettyJson(theme));
        return;
      }

      writeOutput(
        [
          `name: ${theme.name}`,
          `displayName: ${theme.displayName}`,
          `target: ${theme.target}`,
          `mode: ${theme.mode}`,
          `description: ${theme.description}`,
          "config:",
          JSON.stringify(theme.config, null, 2),
          "",
        ].join("\n"),
      );
    });
}

function getCliTheme(name: string): ReturnType<typeof getTheme> {
  try {
    return getTheme(name);
  } catch (error) {
    if (error instanceof Error && error.message === `Unknown theme "${name}"`) {
      throw new VegaPaperError(error.message);
    }

    throw error;
  }
}
```

- [ ] **Step 4: Register command in CLI entrypoint**

Modify `packages/cli/src/index.ts`:

```ts
import { registerThemesCommand } from "./commands/themes";
```

Then register after render:

```ts
registerRenderCommand(program);
registerThemesCommand(program);
```

- [ ] **Step 5: Run checks and CLI smoke**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/themes-command.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper themes list
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper themes show paper-clean --json
```

Expected: tests pass, smoke commands print the expected table/JSON.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/themes.ts packages/cli/src/index.ts packages/cli/test/themes-command.test.ts
git commit -m "feat: add themes cli commands"
```

## Task 4: Add Doctor Core

**Files:**
- Create: `packages/cli/src/core/doctor.ts`
- Create: `packages/cli/test/doctor.test.ts`

- [ ] **Step 1: Write failing doctor core tests**

Create `packages/cli/test/doctor.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/doctor.test.ts
```

Expected: FAIL because `core/doctor.ts` does not exist.

- [ ] **Step 3: Implement doctor core**

Create `packages/cli/src/core/doctor.ts` with:

```ts
import { access } from "node:fs/promises";
import { join } from "node:path";
import { resolveVegaCliBinary, type VegaCliBinaryName } from "../backends/external-vega-cli";

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
  const [bunVersion, nodeVersion, vegaPaperBin, vl2svg, vg2svg] = await Promise.all([
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
```

- [ ] **Step 4: Run checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/doctor.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/doctor.ts packages/cli/test/doctor.test.ts
git commit -m "feat: add doctor checks"
```

## Task 5: Add Doctor Command

**Files:**
- Create: `packages/cli/src/commands/doctor.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/test/doctor.test.ts`

- [ ] **Step 1: Add failing doctor command tests**

Append to `packages/cli/test/doctor.test.ts`:

```ts
import { Command } from "commander";
import { registerDoctorCommand } from "../src/commands/doctor";
```

Add:

```ts
describe("doctor command", () => {
  test("prints doctor checks as JSON", async () => {
    const output = await runDoctorCommand(["doctor", "--json"]);
    const parsed = JSON.parse(output.stdout) as { checks: unknown[] };

    expect(Array.isArray(parsed.checks)).toBe(true);
  });
});

async function runDoctorCommand(args: string[]): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerDoctorCommand(program, (value) => {
    stdout += value;
  });
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/doctor.test.ts
```

Expected: FAIL because `commands/doctor.ts` does not exist.

- [ ] **Step 3: Implement doctor command**

Create `packages/cli/src/commands/doctor.ts` with:

```ts
import type { Command } from "commander";
import { getDoctorExitCode, runDoctorChecks } from "../core/doctor";
import { formatTable, toPrettyJson } from "../core/format";

type DoctorOptions = {
  json?: boolean;
};

type WriteOutput = (value: string) => void;

export function registerDoctorCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
): void {
  program
    .command("doctor")
    .description("Check whether VegaPaper can render SVG charts")
    .option("--json", "print JSON")
    .action(async (options: DoctorOptions) => {
      const checks = await runDoctorChecks();
      const exitCode = getDoctorExitCode(checks);

      if (options.json) {
        writeOutput(toPrettyJson({ checks }));
      } else {
        writeOutput(
          `${formatTable({
            headers: ["status", "name", "message"],
            rows: checks.map((check) => [check.status, check.name, check.message]),
          })}\n`,
        );
      }

      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
    });
}
```

- [ ] **Step 4: Register command in CLI entrypoint**

Modify `packages/cli/src/index.ts`:

```ts
import { registerDoctorCommand } from "./commands/doctor";
```

Then register after themes:

```ts
registerRenderCommand(program);
registerThemesCommand(program);
registerDoctorCommand(program);
```

- [ ] **Step 5: Run checks and smoke commands**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test packages/cli/test/doctor.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper doctor
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper doctor --json
```

Expected: tests pass, `doctor` exits `0` in the current workspace, JSON parses.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/doctor.ts packages/cli/src/index.ts packages/cli/test/doctor.test.ts
git commit -m "feat: add doctor cli command"
```

## Task 6: Final Acceptance Verification

**Files:**
- Modify only files needed to fix verification issues.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: all pass.

- [ ] **Step 2: Run themes acceptance commands**

Run:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper themes list
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper themes show paper-clean --json
```

Expected:

- list output includes `paper-clean`, `acl-clean`, `shadcn-light`, `monochrome-print`.
- show output is parseable JSON and contains `"config"`.

- [ ] **Step 3: Run doctor acceptance commands**

Run:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper doctor
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper doctor --json
```

Expected:

- `doctor` exits `0`.
- human output includes `bun`, `node`, `vl2svg`, `vg2svg`.
- JSON output parses and has a `checks` array.

- [ ] **Step 4: Run unknown theme error smoke**

Run:

```bash
PATH="$PWD/node_modules/.bin:$HOME/.bun/bin:$PATH" vega-paper themes show missing-theme
```

Expected: command exits `1` and prints:

```text
vega-paper: Unknown theme "missing-theme"
```

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes.

- [ ] **Step 6: Commit verification fixes if needed**

If acceptance verification required code changes:

```bash
git add <changed-files>
git commit -m "fix: complete doctor and themes verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: the plan covers `themes list`, `themes show`, `doctor`, `--json` modes, doctor required/optional exit behavior, shared binary resolution, command registration, tests, and acceptance smoke commands.
- Deferred scope is explicit: no `themes preview`, no new themes, no PDF/PNG readiness enforcement, no repair command, no CI template.
- Type consistency: `DoctorCheck`, `DoctorEnvironment`, `VegaCliBinaryName`, and helper names are introduced before command tasks use them.
- Placeholder scan: no placeholder markers or unspecified implementation steps remain.
