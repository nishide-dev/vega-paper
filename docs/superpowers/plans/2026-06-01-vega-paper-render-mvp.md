# VegaPaper Render MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working vertical slice of VegaPaper: `vega-paper render <spec.vl.json> --theme paper-clean --format svg --out <file.svg>`.

**Architecture:** Use a Bun-first TypeScript workspace with two packages: `vega-paper` for the CLI and `@vega-paper/themes` for theme definitions. Keep spec loading/theme application/rendering orchestration separate from the external Vega CLI backend so later Node-native, Bun-native, or MCP integrations can reuse the core boundary.

**Tech Stack:** Bun, TypeScript, Commander, Vega, Vega-Lite, Vega CLI, Bun test.

---

## File Structure

- Create `package.json`: root Bun workspace scripts and dev dependencies.
- Create `tsconfig.json`: shared strict TypeScript config.
- Create `packages/themes/package.json`: package metadata for `@vega-paper/themes`.
- Create `packages/themes/src/index.ts`: theme type, registry, lookup helpers.
- Create `packages/themes/src/paper-clean.ts`: default publication theme.
- Create `packages/themes/src/acl-clean.ts`: two-column NLP paper theme.
- Create `packages/themes/src/shadcn-light.ts`: modern light theme.
- Create `packages/themes/src/monochrome-print.ts`: grayscale-safe print theme.
- Create `packages/themes/test/themes.test.ts`: theme registry tests.
- Create `packages/cli/package.json`: executable CLI package metadata.
- Create `packages/cli/src/index.ts`: Commander entrypoint.
- Create `packages/cli/src/commands/render.ts`: `render` command registration and CLI option validation.
- Create `packages/cli/src/core/errors.ts`: typed user-facing errors.
- Create `packages/cli/src/core/spec.ts`: JSON loading, spec detection, and theme merge.
- Create `packages/cli/src/core/render.ts`: render orchestration.
- Create `packages/cli/src/backends/external-vega-cli.ts`: `vl2svg` and `vg2svg` subprocess backend.
- Create `packages/cli/test/spec.test.ts`: spec detection and merge tests.
- Create `packages/cli/test/render-options.test.ts`: CLI option validation tests.
- Create `packages/cli/test/render.integration.test.ts`: example render smoke test that skips when binaries are unavailable.
- Create `examples/basic-line/chart.vl.json`: small Vega-Lite line chart.
- Generate `examples/basic-line/output.svg` only during verification; do not commit it unless explicitly desired later.

## Task 1: Bootstrap Bun Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `packages/themes/package.json`
- Create: `packages/cli/package.json`

- [ ] **Step 1: Install Bun if missing**

Run:

```bash
command -v bun
```

Expected if Bun is already installed: path to the Bun binary.

If it fails with no output, install Bun:

```bash
curl -fsSL https://bun.com/install | bash
```

Then open a new shell or source the shell profile suggested by the installer and verify:

```bash
bun --version
bun --revision
```

Expected: both commands print Bun version information.

- [ ] **Step 2: Create root package files**

Create `package.json` with:

```json
{
  "name": "vega-paper-workspace",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun test",
    "typecheck": "bun run --filter '*' typecheck",
    "render:example": "vega-paper render examples/basic-line/chart.vl.json --theme paper-clean --format svg --out examples/basic-line/output.svg"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "latest"
  },
  "trustedDependencies": [
    "canvas"
  ]
}
```

Create `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bun-types"]
  },
  "include": ["packages/**/*.ts"]
}
```

- [ ] **Step 3: Create package manifests**

Create `packages/themes/package.json` with:

```json
{
  "name": "@vega-paper/themes",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir dist --target bun",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/cli/package.json` with:

```json
{
  "name": "vega-paper",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "vega-paper": "./src/index.ts"
  },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir dist --target bun",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vega-paper/themes": "workspace:*",
    "commander": "latest",
    "vega": "latest",
    "vega-cli": "latest",
    "vega-lite": "latest"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
bun install
```

Expected: dependencies install and `bun.lock` is created.

- [ ] **Step 5: Run baseline checks**

Run:

```bash
bun test
bun run typecheck
```

Expected: `bun test` reports no tests or zero failures. `bun run typecheck` should succeed once package files exist; if it fails because there are no source files yet, continue to Task 2 and rerun after source files are added.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json packages/themes/package.json packages/cli/package.json bun.lock
git commit -m "chore: bootstrap bun workspace"
```

## Task 2: Add Theme Registry

**Files:**
- Create: `packages/themes/src/index.ts`
- Create: `packages/themes/src/paper-clean.ts`
- Create: `packages/themes/src/acl-clean.ts`
- Create: `packages/themes/src/shadcn-light.ts`
- Create: `packages/themes/src/monochrome-print.ts`
- Create: `packages/themes/test/themes.test.ts`

- [ ] **Step 1: Write failing theme tests**

Create `packages/themes/test/themes.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { getTheme, listThemes } from "../src";

describe("theme registry", () => {
  test("lists the initial themes in stable order", () => {
    expect(listThemes().map((theme) => theme.name)).toEqual([
      "paper-clean",
      "acl-clean",
      "shadcn-light",
      "monochrome-print",
    ]);
  });

  test("returns a theme by name", () => {
    const theme = getTheme("paper-clean");

    expect(theme.name).toBe("paper-clean");
    expect(theme.target).toBe("paper");
    expect(theme.mode).toBe("light");
    expect(theme.config).toHaveProperty("axis");
    expect(theme.config).toHaveProperty("view");
  });

  test("rejects unknown themes", () => {
    expect(() => getTheme("missing-theme")).toThrow('Unknown theme "missing-theme"');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test packages/themes/test/themes.test.ts
```

Expected: FAIL because `packages/themes/src/index.ts` does not exist.

- [ ] **Step 3: Add theme implementations**

Create `packages/themes/src/paper-clean.ts` with:

```ts
import type { VegaPaperTheme } from "./index";

export const paperClean: VegaPaperTheme = {
  name: "paper-clean",
  displayName: "Paper Clean",
  description: "General publication-ready theme with restrained grids and readable labels.",
  target: "paper",
  mode: "light",
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 360,
      continuousHeight: 220,
    },
    axis: {
      domainColor: "#3f3f46",
      gridColor: "#e4e4e7",
      gridOpacity: 0.75,
      labelColor: "#27272a",
      labelFontSize: 11,
      titleColor: "#18181b",
      titleFontSize: 12,
      titlePadding: 8,
      tickColor: "#71717a",
    },
    legend: {
      labelColor: "#27272a",
      labelFontSize: 11,
      titleColor: "#18181b",
      titleFontSize: 12,
      symbolSize: 70,
    },
    line: {
      strokeWidth: 2.25,
    },
    point: {
      filled: true,
      size: 55,
    },
    range: {
      category: ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"],
    },
  },
};
```

Create `packages/themes/src/acl-clean.ts` with:

```ts
import type { VegaPaperTheme } from "./index";

export const aclClean: VegaPaperTheme = {
  name: "acl-clean",
  displayName: "ACL Clean",
  description: "Compact two-column NLP paper theme optimized for small figure widths.",
  target: "paper",
  mode: "light",
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 320,
      continuousHeight: 200,
    },
    axis: {
      domainColor: "#404040",
      gridColor: "#e5e5e5",
      gridOpacity: 0.65,
      labelColor: "#171717",
      labelFontSize: 10,
      titleColor: "#171717",
      titleFontSize: 11,
      titlePadding: 7,
      tickColor: "#737373",
    },
    legend: {
      orient: "top",
      direction: "horizontal",
      labelFontSize: 10,
      titleFontSize: 11,
      symbolSize: 60,
    },
    line: {
      strokeWidth: 2.4,
    },
    point: {
      filled: true,
      size: 48,
    },
    range: {
      category: ["#1d4ed8", "#b91c1c", "#047857", "#7e22ce", "#c2410c", "#0e7490"],
    },
  },
};
```

Create `packages/themes/src/shadcn-light.ts` with:

```ts
import type { VegaPaperTheme } from "./index";

export const shadcnLight: VegaPaperTheme = {
  name: "shadcn-light",
  displayName: "shadcn Light",
  description: "Modern light chart theme inspired by quiet application dashboards.",
  target: "web",
  mode: "light",
  config: {
    background: "white",
    font: "Inter, ui-sans-serif, system-ui, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 420,
      continuousHeight: 260,
    },
    axis: {
      domain: false,
      gridColor: "#e2e8f0",
      gridOpacity: 0.8,
      labelColor: "#475569",
      labelFontSize: 12,
      titleColor: "#0f172a",
      titleFontSize: 12,
      tickColor: "#cbd5e1",
    },
    legend: {
      labelColor: "#475569",
      labelFontSize: 12,
      titleColor: "#0f172a",
      titleFontSize: 12,
    },
    line: {
      strokeWidth: 2.5,
    },
    point: {
      filled: true,
      size: 60,
    },
    range: {
      category: ["#0f766e", "#2563eb", "#be123c", "#7c3aed", "#ca8a04", "#0891b2"],
    },
  },
};
```

Create `packages/themes/src/monochrome-print.ts` with:

```ts
import type { VegaPaperTheme } from "./index";

export const monochromePrint: VegaPaperTheme = {
  name: "monochrome-print",
  displayName: "Monochrome Print",
  description: "Grayscale-safe print theme for review PDFs and black-and-white output.",
  target: "paper",
  mode: "print",
  config: {
    background: "white",
    font: "Arial, Helvetica, sans-serif",
    view: {
      stroke: null,
      continuousWidth: 360,
      continuousHeight: 220,
    },
    axis: {
      domainColor: "#222222",
      gridColor: "#dddddd",
      gridOpacity: 0.8,
      labelColor: "#111111",
      labelFontSize: 11,
      titleColor: "#111111",
      titleFontSize: 12,
      tickColor: "#666666",
    },
    legend: {
      labelColor: "#111111",
      labelFontSize: 11,
      titleColor: "#111111",
      titleFontSize: 12,
    },
    line: {
      strokeWidth: 2.2,
    },
    point: {
      filled: true,
      size: 52,
    },
    range: {
      category: ["#111111", "#444444", "#777777", "#999999", "#bbbbbb", "#dddddd"],
    },
  },
};
```

Create `packages/themes/src/index.ts` with:

```ts
import { aclClean } from "./acl-clean";
import { monochromePrint } from "./monochrome-print";
import { paperClean } from "./paper-clean";
import { shadcnLight } from "./shadcn-light";

export type VegaPaperThemeTarget = "paper" | "slide" | "web" | "poster";
export type VegaPaperThemeMode = "light" | "dark" | "print";

export interface VegaPaperTheme {
  name: string;
  displayName: string;
  description: string;
  target: VegaPaperThemeTarget;
  mode: VegaPaperThemeMode;
  config: Record<string, unknown>;
}

export const themes = [paperClean, aclClean, shadcnLight, monochromePrint] as const;

export function listThemes(): VegaPaperTheme[] {
  return [...themes];
}

export function getTheme(name: string): VegaPaperTheme {
  const theme = themes.find((candidate) => candidate.name === name);

  if (!theme) {
    throw new Error(`Unknown theme "${name}"`);
  }

  return theme;
}
```

- [ ] **Step 4: Run theme tests**

Run:

```bash
bun test packages/themes/test/themes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/themes
git commit -m "feat: add initial theme registry"
```

## Task 3: Add Spec Loading, Detection, and Theme Merge

**Files:**
- Create: `packages/cli/src/core/errors.ts`
- Create: `packages/cli/src/core/spec.ts`
- Create: `packages/cli/test/spec.test.ts`

- [ ] **Step 1: Write failing spec tests**

Create `packages/cli/test/spec.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { applyThemeToSpec, detectSpecType } from "../src/core/spec";

describe("detectSpecType", () => {
  test("detects Vega-Lite from schema", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        mark: "line",
        encoding: {},
      }),
    ).toBe("vega-lite");
  });

  test("detects Vega-Lite from mark and encoding", () => {
    expect(detectSpecType({ mark: "bar", encoding: {} })).toBe("vega-lite");
  });

  test("detects Vega from schema", () => {
    expect(
      detectSpecType({
        $schema: "https://vega.github.io/schema/vega/v6.json",
        marks: [],
        scales: [],
      }),
    ).toBe("vega");
  });

  test("detects Vega from marks and scales", () => {
    expect(detectSpecType({ marks: [], scales: [] })).toBe("vega");
  });

  test("rejects unknown specs", () => {
    expect(() => detectSpecType({ hello: "world" })).toThrow(
      "Could not determine whether the input is Vega-Lite or Vega",
    );
  });
});

describe("applyThemeToSpec", () => {
  test("applies theme config without mutating input", () => {
    const spec = {
      mark: "line",
      encoding: {},
    };

    const themed = applyThemeToSpec(spec, {
      axis: { labelFontSize: 11 },
      view: { stroke: null },
    });

    expect(themed).toEqual({
      mark: "line",
      encoding: {},
      config: {
        axis: { labelFontSize: 11 },
        view: { stroke: null },
      },
    });
    expect(spec).toEqual({ mark: "line", encoding: {} });
  });

  test("preserves explicit spec config over theme defaults", () => {
    const themed = applyThemeToSpec(
      {
        mark: "line",
        encoding: {},
        config: {
          axis: { labelFontSize: 14 },
        },
      },
      {
        axis: { labelFontSize: 11, titleFontSize: 12 },
        view: { stroke: null },
      },
    );

    expect(themed.config).toEqual({
      axis: {
        labelFontSize: 14,
        titleFontSize: 12,
      },
      view: { stroke: null },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test packages/cli/test/spec.test.ts
```

Expected: FAIL because `packages/cli/src/core/spec.ts` does not exist.

- [ ] **Step 3: Add typed errors**

Create `packages/cli/src/core/errors.ts` with:

```ts
export class VegaPaperError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "VegaPaperError";
    this.exitCode = exitCode;
  }
}
```

- [ ] **Step 4: Add spec core**

Create `packages/cli/src/core/spec.ts` with:

```ts
import { readFile } from "node:fs/promises";
import { VegaPaperError } from "./errors";

export type VegaPaperSpecType = "vega-lite" | "vega";
export type JsonObject = Record<string, unknown>;

export async function loadJsonSpec(inputPath: string): Promise<JsonObject> {
  let raw: string;

  try {
    raw = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new VegaPaperError(`Input file not found or unreadable: ${inputPath}`);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed)) {
      throw new VegaPaperError(`Input JSON must be an object: ${inputPath}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`Invalid JSON in input file: ${inputPath}`);
  }
}

export function detectSpecType(spec: JsonObject): VegaPaperSpecType {
  const schema = typeof spec.$schema === "string" ? spec.$schema : "";

  if (schema.includes("vega-lite")) {
    return "vega-lite";
  }

  if (schema.includes("/vega/")) {
    return "vega";
  }

  if ("mark" in spec && "encoding" in spec) {
    return "vega-lite";
  }

  if ("marks" in spec && "scales" in spec) {
    return "vega";
  }

  throw new VegaPaperError(
    "Could not determine whether the input is Vega-Lite or Vega. Add a Vega schema URL or use a standard Vega-Lite/Vega spec shape.",
  );
}

export function applyThemeToSpec(spec: JsonObject, themeConfig: JsonObject): JsonObject {
  const specConfig = isRecord(spec.config) ? spec.config : {};

  return {
    ...deepCloneObject(spec),
    config: deepMerge(themeConfig, specConfig),
  };
}

function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = { ...deepCloneObject(base) };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];

    if (isRecord(existing) && isRecord(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = deepCloneValue(value);
    }
  }

  return result;
}

function deepCloneObject(value: JsonObject): JsonObject {
  return structuredClone(value) as JsonObject;
}

function deepCloneValue(value: unknown): unknown {
  return structuredClone(value);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 5: Run spec tests**

Run:

```bash
bun test packages/cli/test/spec.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/core/errors.ts packages/cli/src/core/spec.ts packages/cli/test/spec.test.ts
git commit -m "feat: add spec detection and theme merge"
```

## Task 4: Add Render Option Validation

**Files:**
- Create: `packages/cli/src/commands/render.ts`
- Create: `packages/cli/test/render-options.test.ts`

- [ ] **Step 1: Write failing render option tests**

Create `packages/cli/test/render-options.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { normalizeRenderOptions } from "../src/commands/render";

describe("normalizeRenderOptions", () => {
  test("accepts explicit svg format and output path", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        format: "svg",
        out: "chart.svg",
        theme: "paper-clean",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.svg",
      format: "svg",
      themeName: "paper-clean",
    });
  });

  test("infers svg format from output path", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.svg",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.svg",
      format: "svg",
      themeName: undefined,
    });
  });

  test("rejects unsupported formats", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        format: "png",
        out: "chart.png",
      }),
    ).toThrow('Unsupported format "png". This MVP supports only "svg".');
  });

  test("requires an output path", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        format: "svg",
      }),
    ).toThrow("Missing --out <path>. SVG output must be written to a file.");
  });

  test("requires a detectable format", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.out",
      }),
    ).toThrow('Missing --format <format>. Use "--format svg" or an .svg output path.');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun test packages/cli/test/render-options.test.ts
```

Expected: FAIL because `packages/cli/src/commands/render.ts` does not exist.

- [ ] **Step 3: Add render command option normalization**

Create `packages/cli/src/commands/render.ts` with:

```ts
import type { Command } from "commander";
import { VegaPaperError } from "../core/errors";
import { renderChart, type RenderRequest } from "../core/render";

export type RawRenderOptions = {
  theme?: string;
  format?: string;
  out?: string;
};

export function normalizeRenderOptions(inputPath: string, options: RawRenderOptions): RenderRequest {
  if (!options.out) {
    throw new VegaPaperError("Missing --out <path>. SVG output must be written to a file.");
  }

  const inferredFormat = options.out.endsWith(".svg") ? "svg" : undefined;
  const format = options.format ?? inferredFormat;

  if (!format) {
    throw new VegaPaperError('Missing --format <format>. Use "--format svg" or an .svg output path.');
  }

  if (format !== "svg") {
    throw new VegaPaperError(`Unsupported format "${format}". This MVP supports only "svg".`);
  }

  return {
    inputPath,
    outputPath: options.out,
    format,
    themeName: options.theme,
  };
}

export function registerRenderCommand(program: Command): void {
  program
    .command("render")
    .argument("<spec>", "Vega-Lite or Vega JSON specification")
    .option("--theme <name>", "theme preset name")
    .option("--format <format>", "output format; this MVP supports svg")
    .option("--out <path>", "output SVG path")
    .action(async (inputPath: string, options: RawRenderOptions) => {
      const request = normalizeRenderOptions(inputPath, options);
      const result = await renderChart(request);
      console.log(`Rendered ${result.outputPath}`);
    });
}
```

- [ ] **Step 4: Add temporary render core stub for typecheck**

Create `packages/cli/src/core/render.ts` with:

```ts
export type RenderRequest = {
  inputPath: string;
  outputPath: string;
  format: "svg";
  themeName?: string;
};

export type RenderResult = {
  outputPath: string;
  warnings: string[];
};

export async function renderChart(request: RenderRequest): Promise<RenderResult> {
  return {
    outputPath: request.outputPath,
    warnings: [],
  };
}
```

- [ ] **Step 5: Run render option tests**

Run:

```bash
bun test packages/cli/test/render-options.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/render.ts packages/cli/src/core/render.ts packages/cli/test/render-options.test.ts
git commit -m "feat: add render option validation"
```

## Task 5: Add CLI Entrypoint

**Files:**
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Add CLI entrypoint**

Create `packages/cli/src/index.ts` with:

```ts
#!/usr/bin/env bun

import { Command } from "commander";
import { registerRenderCommand } from "./commands/render";
import { VegaPaperError } from "./core/errors";

const program = new Command();

program
  .name("vega-paper")
  .description("AI-friendly CLI for publication-ready Vega and Vega-Lite figures")
  .version("0.1.0");

registerRenderCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof VegaPaperError) {
    console.error(`vega-paper: ${error.message}`);
    process.exit(error.exitCode);
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

- [ ] **Step 2: Verify help output**

Run:

```bash
vega-paper --help
```

Expected output includes:

```text
Usage: vega-paper [options] [command]
```

Run:

```bash
vega-paper render --help
```

Expected output includes:

```text
Usage: vega-paper render [options] <spec>
```

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
bun test
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat: add cli entrypoint"
```

## Task 6: Implement External Vega CLI Backend

**Files:**
- Create: `packages/cli/src/backends/external-vega-cli.ts`
- Modify: `packages/cli/src/core/render.ts`

- [ ] **Step 1: Replace render core stub with backend orchestration**

Modify `packages/cli/src/core/render.ts` to:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { getTheme } from "@vega-paper/themes";
import { renderWithExternalVegaCli } from "../backends/external-vega-cli";
import { applyThemeToSpec, detectSpecType, loadJsonSpec } from "./spec";

export type RenderRequest = {
  inputPath: string;
  outputPath: string;
  format: "svg";
  themeName?: string;
};

export type RenderResult = {
  outputPath: string;
  warnings: string[];
};

export async function renderChart(request: RenderRequest): Promise<RenderResult> {
  const spec = await loadJsonSpec(request.inputPath);
  const specType = detectSpecType(spec);
  const theme = request.themeName ? getTheme(request.themeName) : undefined;
  const renderedSpec = theme ? applyThemeToSpec(spec, theme.config) : spec;

  await mkdir(dirname(request.outputPath), { recursive: true });

  const tempDirectory = await mkdtemp(join(tmpdir(), "vega-paper-"));
  const tempSpecPath = join(tempDirectory, specType === "vega-lite" ? "spec.vl.json" : "spec.vg.json");
  await writeFile(tempSpecPath, `${JSON.stringify(renderedSpec, null, 2)}\n`, "utf8");

  await renderWithExternalVegaCli({
    specType,
    inputPath: tempSpecPath,
    outputPath: request.outputPath,
    format: request.format,
  });

  return {
    outputPath: request.outputPath,
    warnings: [],
  };
}
```

- [ ] **Step 2: Add external backend**

Create `packages/cli/src/backends/external-vega-cli.ts` with:

```ts
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { VegaPaperError } from "../core/errors";
import type { VegaPaperSpecType } from "../core/spec";

export type ExternalVegaCliRenderRequest = {
  specType: VegaPaperSpecType;
  inputPath: string;
  outputPath: string;
  format: "svg";
};

export async function renderWithExternalVegaCli(request: ExternalVegaCliRenderRequest): Promise<void> {
  const binary = getRenderBinary(request.specType, request.format);
  const command = await resolveBinary(binary);
  await runBinary(command, binary, [request.inputPath, request.outputPath]);
}

function getRenderBinary(specType: VegaPaperSpecType, format: "svg"): string {
  if (format !== "svg") {
    throw new VegaPaperError(`Unsupported format "${format}". This MVP supports only "svg".`);
  }

  return specType === "vega-lite" ? "vl2svg" : "vg2svg";
}

async function resolveBinary(binary: string): Promise<string> {
  const localBinary = join("node_modules", ".bin", binary);

  try {
    await access(localBinary);
    return localBinary;
  } catch {
    return binary;
  }
}

async function runBinary(command: string, displayName: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new VegaPaperError(
            `Missing Vega CLI binary "${displayName}". Run "bun install" in this workspace and ensure node_modules/.bin is available.`,
          ),
        );
        return;
      }

      reject(new VegaPaperError(`Failed to start Vega CLI binary "${displayName}": ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = stderr.trim() ? `\n${stderr.trim()}` : "";
      reject(new VegaPaperError(`Vega CLI binary "${displayName}" failed with exit code ${code}.${detail}`));
    });
  });
}
```

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
bun test
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/core/render.ts packages/cli/src/backends/external-vega-cli.ts
git commit -m "feat: add external vega cli backend"
```

## Task 7: Add Example and Integration Test

**Files:**
- Create: `examples/basic-line/chart.vl.json`
- Create: `packages/cli/test/render.integration.test.ts`

- [ ] **Step 1: Add example spec**

Create `examples/basic-line/chart.vl.json` with:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "description": "Basic training curve example for VegaPaper.",
  "data": {
    "values": [
      { "epoch": 1, "accuracy": 0.62, "model": "baseline" },
      { "epoch": 2, "accuracy": 0.68, "model": "baseline" },
      { "epoch": 3, "accuracy": 0.71, "model": "baseline" },
      { "epoch": 1, "accuracy": 0.65, "model": "improved" },
      { "epoch": 2, "accuracy": 0.73, "model": "improved" },
      { "epoch": 3, "accuracy": 0.79, "model": "improved" }
    ]
  },
  "mark": {
    "type": "line",
    "point": true
  },
  "encoding": {
    "x": {
      "field": "epoch",
      "type": "quantitative",
      "title": "Epoch"
    },
    "y": {
      "field": "accuracy",
      "type": "quantitative",
      "title": "Accuracy"
    },
    "color": {
      "field": "model",
      "type": "nominal",
      "title": "Model"
    }
  }
}
```

- [ ] **Step 2: Write integration test**

Create `packages/cli/test/render.integration.test.ts` with:

```ts
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { beforeEach, describe, expect, test } from "bun:test";
import { renderChart } from "../src/core/render";

const outputPath = "examples/basic-line/output.svg";

describe("render integration", () => {
  beforeEach(async () => {
    await rm(outputPath, { force: true });
    await mkdir(dirname(outputPath), { recursive: true });
  });

  test("renders the basic Vega-Lite example to SVG", async () => {
    if (!(await hasLocalVl2Svg())) {
      console.warn("Skipping render integration test because node_modules/.bin/vl2svg is unavailable.");
      return;
    }

    await renderChart({
      inputPath: "examples/basic-line/chart.vl.json",
      outputPath,
      format: "svg",
      themeName: "paper-clean",
    });

    const svg = await readFile(outputPath, "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});

async function hasLocalVl2Svg(): Promise<boolean> {
  try {
    await access("node_modules/.bin/vl2svg");
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Run integration test**

Run:

```bash
bun test packages/cli/test/render.integration.test.ts
```

Expected when dependencies are installed and the external binary works: PASS and `examples/basic-line/output.svg` exists.

Expected when the binary is unavailable: PASS with a skip warning.

- [ ] **Step 4: Remove generated SVG before commit**

Run:

```bash
rm -f examples/basic-line/output.svg
```

Expected: generated output is removed from the working tree.

- [ ] **Step 5: Commit**

```bash
git add examples/basic-line/chart.vl.json packages/cli/test/render.integration.test.ts
git commit -m "test: add basic render integration"
```

## Task 8: Verify End-to-End CLI Render

**Files:**
- Modify: only files needed to fix issues discovered by this verification.

- [ ] **Step 1: Run all tests**

Run:

```bash
bun test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run the user-facing render command**

Run:

```bash
vega-paper render examples/basic-line/chart.vl.json --theme paper-clean --format svg --out examples/basic-line/output.svg
```

Expected output:

```text
Rendered examples/basic-line/output.svg
```

- [ ] **Step 4: Inspect the generated SVG**

Run:

```bash
head -n 5 examples/basic-line/output.svg
```

Expected: output starts with an SVG tag or XML/SVG header and contains `<svg`.

- [ ] **Step 5: Verify unknown theme error**

Run:

```bash
vega-paper render examples/basic-line/chart.vl.json --theme missing-theme --format svg --out examples/basic-line/missing-theme.svg
```

Expected: command exits non-zero and prints:

```text
vega-paper: Unknown theme "missing-theme"
```

- [ ] **Step 6: Remove generated SVG artifacts**

Run:

```bash
rm -f examples/basic-line/output.svg examples/basic-line/missing-theme.svg
```

Expected: generated files are removed from the working tree.

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes except intentionally untracked user files such as `docs/initial-design.md`.

- [ ] **Step 8: Commit any verification fixes**

If verification required code changes, commit them:

```bash
git add <changed-files>
git commit -m "fix: complete render mvp verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: this plan covers the Bun workspace, CLI package, themes package, `render --format svg`, theme merge, external Vega CLI backend, example chart, unit tests, integration test, and actionable error messages.
- Deferred scope is explicit: MCP, GUI, `infer`, PDF, PNG, full linting, and production Skill packaging remain out of this slice.
- Type consistency: `RenderRequest`, `RenderResult`, `VegaPaperSpecType`, and `VegaPaperTheme` are introduced before later tasks use them.
- Placeholder scan: no placeholder markers or unspecified edge-case steps remain.
