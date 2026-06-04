# VegaPaper / `vega-paper` 設計仕様書

> **Note (2026-06):** 本書は初期プロダクト構想の原典です。内容の大部分は設計判断の参照用として残します。
>
> - **現在の Phase 進捗と優先順位:** [`roadmap.md`](./roadmap.md)
> - **実装仕様（正）:** `docs/superpowers/specs/` および `docs/superpowers/plans/`
>
> §13 のロードマップ順序（MCP を Phase 4 に置いていた部分）は [`roadmap.md`](./roadmap.md) で更新済みです。CLI 配布 → カスタム theme → MCP の順に進めます。

## 1. 概要

**VegaPaper** は、Vega / Vega-Lite を用いて、研究論文・技術レポート・スライド向けの publication-ready な図を生成するための **AI-friendly CLI + Skill + Theme Toolkit** である。

パッケージ名・CLI名は `vega-paper` とする。

```bash
vega-paper render chart.vl.json --theme acl-clean --format svg --out figures/main.svg
vega-paper infer results.csv --chart line --x epoch --y f1 --theme shadcn-light --out figures/f1.svg
vega-paper lint chart.vl.json
vega-paper themes list
```

VegaPaper は Vega / Vega-Lite の代替ではなく、公式 Vega ecosystem の上に構築する **論文図生成向け orchestration layer** である。

---

## 2. 目的

### 2.1 解決したい問題

Vega / Vega-Lite は宣言的な図生成に強力だが、研究者が論文図として使うには以下の課題がある。

* Vega / Vega-Lite spec を毎回手で書くのが面倒
* 論文用に一貫した見た目を保ちにくい
* 既存の Vega Themes はやや古典的で、現代的な UI / 論文図スタイルに合わないものが多い
* SVG / PDF / PNG への出力手順がプロジェクトごとにばらつく
* AI agent に任せる場合、spec 生成・検証・レンダリング・修正のループが必要
* LaTeX / Markdown / paper repository に組み込むには、再現可能なCLIが必要

### 2.2 VegaPaper の役割

VegaPaper は以下を提供する。

1. **Paper-ready Vega-Lite spec generation**
2. **Modern academic chart themes**
3. **CLI-based rendering workflow**
4. **Spec validation / linting**
5. **AI Skill for chart generation**
6. **Optional MCP server for external AI clients**

---

## 3. 基本方針

### 3.1 MVP は CLI + Skill

初期実装では MCP server ではなく、まず CLI と Skill を中核にする。

```text
AI / Agent
  ↓
VegaPaper Skill
  ↓
vega-paper CLI
  ↓
Vega-Lite / Vega official tooling
  ↓
SVG / PDF / PNG
```

理由:

* 図生成はローカルファイル生成型ワークフローであり CLI と相性が良い
* Vega / Vega-Lite 公式CLIをバックエンドとして使える
* Skill により AI の判断基準・作図手順・修正ループを記述できる
* MCP は後から薄い wrapper として追加しやすい

### 3.2 Vega-Lite first

通常の論文図では、AIにはまず Vega-Lite spec を生成させる。

理由:

* Vega-Lite は Vega より高レベルで、AI が壊しにくい
* bar / line / scatter / area / heatmap / facet / layer など、多くの論文図に十分
* 必要に応じて Vega spec に compile できる

Vega spec を直接扱うのは以下の場合に限定する。

* 複雑な annotation
* custom layout
* signal / interaction を含む図
* Vega-Lite では表現しづらい multi-panel figure
* 低レベルな mark / scale / layout 制御が必要な場合

---

## 4. 技術スタック

### 4.1 推奨スタック

* Runtime / package manager: **Bun**
* Language: **TypeScript**
* CLI framework: `commander`, `clipanion`, or lightweight custom parser
* Schema validation: `zod`
* Vega ecosystem:

  * `vega`
  * `vega-lite`
  * `vega-cli`
  * `vega-themes`
* Testing: `bun test`
* Formatting / linting: `biome` or `eslint + prettier`
* Build: `bun build`

### 4.2 Bun 採用方針

Bun は TypeScript 実行、パッケージ管理、テスト、ビルドが統合されており、CLI 開発との相性が良い。

ただし、Vega の PNG / PDF レンダリング周りは Node.js ecosystem の `canvas` や headless rendering に依存する場合がある。そのため、MVPでは以下の方針にする。

* 開発・CLI実行は Bun ベース
* 公式 Vega CLI / Vega-Lite CLI を内部で呼び出す場合は、Node互換性に注意する
* まずは **SVG出力を第一級ターゲット** にする
* PDF / PNG は optional dependency / doctor check で扱う
* 互換性問題が出た場合、render backend は Node subprocess に逃がせる設計にする

### 4.3 Runtime fallback

VegaPaper CLI は Bun-first だが、レンダリング部分は安全のため backend を抽象化する。

```text
RenderBackend
  ├─ BunNativeBackend
  ├─ NodeSubprocessBackend
  └─ ExternalVegaCliBackend
```

初期実装では `ExternalVegaCliBackend` を優先する。

```text
VegaPaper CLI
  ↓
node_modules/.bin/vl2svg / vl2pdf / vl2png
or
node_modules/.bin/vg2svg / vg2pdf / vg2png
```

これにより Bun 由来の互換性問題を局所化できる。

---

## 5. パッケージ構成

### 5.1 Monorepo 構成

```text
vega-paper/
  package.json
  bun.lock
  README.md
  docs/
    architecture.md
    cli.md
    themes.md
    skill.md
    mcp.md
  packages/
    cli/
      package.json
      src/
        index.ts
        commands/
          render.ts
          infer.ts
          lint.ts
          themes.ts
          doctor.ts
        core/
          spec.ts
          theme.ts
          render.ts
          validate.ts
          data.ts
          diagnostics.ts
        backends/
          external-vega-cli.ts
          node-subprocess.ts
        utils/
      test/
    themes/
      package.json
      src/
        index.ts
        shadcn-light.ts
        shadcn-dark.ts
        paper-clean.ts
        acl-clean.ts
        nature-soft.ts
        monochrome-print.ts
        poster-dark.ts
    skill/
      SKILL.md
      references/
        chart-selection.md
        vega-lite-patterns.md
        paper-style-guide.md
        theme-catalog.md
      scripts/
        validate-spec.ts
        render-chart.ts
    mcp/
      package.json
      src/
        server.ts
        tools/
          render-chart.ts
          validate-spec.ts
          list-themes.ts
  examples/
    ablation/
      data.csv
      chart.vl.json
      output.svg
    training-curve/
      data.csv
      chart.vl.json
      output.svg
```

### 5.2 初期パッケージ

MVPでは以下の3パッケージに絞る。

```text
packages/cli
packages/themes
packages/skill
```

`packages/mcp` は Phase 2 以降に追加する。

---

## 6. CLI 仕様

### 6.1 `vega-paper render`

Vega-Lite / Vega spec を読み込み、テーマを適用して画像として出力する。

```bash
vega-paper render chart.vl.json \
  --theme acl-clean \
  --format svg \
  --out figures/chart.svg
```

Options:

```text
--theme <name>        Theme preset name
--format <format>     svg | pdf | png | vg | vl
--out <path>          Output path
--config <path>       Additional Vega/Vega-Lite config
--width <number>      Override width
--height <number>     Override height
--scale <number>      Output scale for raster formats
--transparent         Transparent background
--strict              Fail on warnings
--save-spec           Save themed Vega-Lite spec next to output
--save-vega           Save compiled Vega spec next to output
```

Input:

* `.vl.json`: Vega-Lite spec
* `.vg.json`: Vega spec
* `.json`: auto-detect

Output:

* `.svg`
* `.pdf`
* `.png`
* themed `.vl.json`
* compiled `.vg.json`

### 6.2 `vega-paper infer`

CSV / JSON データから Vega-Lite spec を生成し、そのままレンダリングする。

```bash
vega-paper infer results.csv \
  --chart line \
  --x epoch \
  --y f1 \
  --color model \
  --theme shadcn-light \
  --out figures/f1.svg
```

Options:

```text
--chart <type>        bar | line | scatter | area | heatmap | boxplot
--x <field>           X encoding field
--y <field>           Y encoding field
--color <field>       Color encoding field
--facet <field>       Facet field
--title <text>        Chart title
--width <number>
--height <number>
--theme <name>
--format <format>
--out <path>
--aggregate <method>  mean | median | sum | count | min | max
--error-band <field>  Add error band / error bar
```

このコマンドは人間が明示的に chart type と encoding を指定する低リスクAPIとする。
AIが使う場合も、まずこのコマンドを優先する。

### 6.3 `vega-paper spec`

Spec 操作用のサブコマンド群。

```bash
vega-paper spec compile chart.vl.json --out chart.vg.json
vega-paper spec theme chart.vl.json --theme paper-clean --out themed.vl.json
vega-paper spec inspect chart.vl.json
```

### 6.4 `vega-paper lint`

論文図としての品質を検査する。

```bash
vega-paper lint chart.vl.json --profile acl
```

Checks:

* axis label が存在するか
* title が過剰に長くないか
* legend が多すぎないか
* color encoding がカテゴリ数に対して破綻していないか
* grayscale printing に弱すぎないか
* width / height が論文カラム幅に合うか
* font size が小さすぎないか
* data が inline の場合、大きすぎないか
* log scale / normalization が明示されているか
* y-axis がゼロ始まりであるべき chart で不自然に切られていないか

### 6.5 `vega-paper themes`

テーマ一覧とプレビュー生成。

```bash
vega-paper themes list
vega-paper themes show shadcn-light
vega-paper themes preview --out theme-gallery.svg
```

### 6.6 `vega-paper doctor`

実行環境を検査する。

```bash
vega-paper doctor
```

Checks:

* Bun version
* Node version
* `vega`, `vega-lite`, `vega-cli` versions
* `vl2svg`, `vg2svg` が実行可能か
* PDF / PNG backend が使えるか
* `canvas` availability
* fonts availability
* output directory permission

---

## 7. Theme 設計

### 7.1 Theme の正体

VegaPaper の theme は Vega / Vega-Lite の `config` object を中心にしたプリセットである。

```ts
export interface VegaPaperTheme {
  name: string;
  displayName: string;
  description: string;
  target: "paper" | "slide" | "web" | "poster";
  mode: "light" | "dark" | "print";
  config: Record<string, unknown>;
}
```

### 7.2 初期テーマ

#### `paper-clean`

最も汎用的な論文向けテーマ。

* 白背景または透明背景
* 控えめな grid
* 小さすぎない axis label
* legend は簡潔
* 色数を抑える

#### `acl-clean`

ACL / EMNLP / NAACL などの2カラム論文を想定。

* 小さめの図幅でも読める
* 軸ラベルを太すぎず明瞭に
* 線幅をやや太め
* legend は上部 or 内側
* caption は LaTeX 側に任せる

#### `shadcn-light`

shadcn/ui charts の雰囲気を Vega-Lite に移植したテーマ。

* muted grid
* soft contrast
* modern sans-serif
* calm categorical palette
* card UI にも載せやすい

#### `shadcn-dark`

Dark UI / poster / web demo 向け。

* dark background
* muted axis
* high contrast lines
* dark card compatible

#### `nature-soft`

Nature / biomedical paper 風の柔らかいテーマ。

* white background
* minimal axis
* muted but distinguishable colors
* small multiples に強い

#### `monochrome-print`

白黒印刷・査読PDF向け。

* grayscale-safe
* pattern / strokeDash の活用
* color だけに依存しない区別

#### `poster-dark`

ポスター・発表スライド向け。

* dark background
* large labels
* bold lines
* high contrast

### 7.3 Theme catalog

`vega-paper themes list` は以下を表示する。

```text
name              target   mode    description
paper-clean       paper    light   General publication-ready theme
acl-clean         paper    light   Two-column NLP paper optimized theme
shadcn-light      web      light   Modern shadcn-like chart theme
shadcn-dark       web      dark    Modern dark chart theme
nature-soft       paper    light   Soft biomedical journal style
monochrome-print  paper    print   Grayscale-safe print theme
poster-dark       poster   dark    Dark poster / slide theme
```

---

## 8. AI Skill 設計

### 8.1 Skill の目的

`vega-paper` Skill は、AI agent が VegaPaper CLI を使って論文図を生成するための作業手順・判断基準・修正ループを提供する。

Skill は以下を含む。

```text
packages/skill/
  SKILL.md
  references/
    chart-selection.md
    vega-lite-patterns.md
    paper-style-guide.md
    theme-catalog.md
  scripts/
    validate-spec.ts
    render-chart.ts
```

### 8.2 SKILL.md に書くべき内容

* 入力データの確認方法
* 図種選択のルール
* Vega-Lite spec の基本テンプレート
* テーマ選択のルール
* 論文用サイズの推奨値
* SVG / PDF / PNG の使い分け
* validation / lint の流れ
* 失敗時の修正ループ
* LaTeX に入れるときの注意

### 8.3 AI の標準ワークフロー

```text
1. User intent を読む
2. データ構造を確認する
3. 図種を選ぶ
4. Vega-Lite spec を生成する
5. vega-paper lint を実行する
6. vega-paper render で SVG を生成する
7. 出力を確認する
8. 必要なら spec を修正して再レンダリングする
9. 最終的に SVG / PDF / spec / caption を返す
```

---

## 9. MCP 設計（Phase 2）

### 9.1 MCP の位置づけ

MCP は中核ではなく、`vega-paper` CLI を外部AIクライアントやIDEから呼ぶための wrapper とする。

```text
AI App / IDE / Chat Client
  ↓
vega-paper MCP Server
  ↓
vega-paper CLI / core library
  ↓
Vega official tooling
```

### 9.2 MCP tools

```text
render_chart
validate_spec
list_themes
infer_spec
compile_spec
```

### 9.3 MCP を後回しにする理由

* 最初はCLIだけで十分実用になる
* MCPを先に作ると、認可・ファイルI/O・サーバ管理が重くなる
* CLIが安定してからラップした方が設計がぶれない

---

## 10. 出力形式

### 10.1 SVG first

MVPでは SVG を第一級出力にする。

理由:

* 論文図に向いている
* Git diff 可能
* LaTeX / Markdown / HTML に埋め込みやすい
* PNG / PDF より環境依存が少ない

### 10.2 PDF

LaTeX 投稿用に重要。

ただし、フォント・canvas・renderer 差分に注意する。

### 10.3 PNG

README / Web preview / slide draft 用。

高解像度出力のため `--scale` をサポートする。

---

## 11. データ入力

### 11.1 対応形式

MVP:

* CSV
* JSON
* Vega-Lite JSON
* Vega JSON

Future:

* TSV
* JSONL
* Parquet
* Arrow
* Python dataframe bridge

### 11.2 データポリシー

論文図では再現性が重要なので、生成された図には以下を保存できるようにする。

```text
figure.svg
figure.vl.json
figure.vg.json
figure.data.csv
figure.meta.json
```

`figure.meta.json` には以下を含める。

```json
{
  "generatedBy": "vega-paper",
  "theme": "acl-clean",
  "input": "results.csv",
  "output": "figure.svg",
  "createdAt": "...",
  "vegaVersion": "...",
  "vegaLiteVersion": "..."
}
```

---

## 12. MVP Scope

### 12.1 MVP に含める

* Bun + TypeScript CLI
* `render`
* `infer`
* `lint`
* `themes list`
* `doctor`
* SVG output
* Vega-Lite first workflow
* 4 themes:

  * `paper-clean`
  * `acl-clean`
  * `shadcn-light`
  * `monochrome-print`
* Skill draft
* Examples

### 12.2 MVP では後回し

* MCP server
* GUI
* interactive chart editing
* complex multi-panel figure designer
* direct Overleaf integration
* full automatic natural language to chart intent parser
* Parquet / Arrow support
* animated charts

---

## 13. Roadmap

> **Superseded:** 以下は初期計画の記録です。**現行ロードマップは [`roadmap.md`](./roadmap.md) を参照してください。**

### Phase 0: Research & prototype

* Vega / Vega-Lite CLI の挙動確認
* Bun からの subprocess 実行確認
* SVG / PDF / PNG 出力確認
* theme config prototype

### Phase 1: CLI MVP

* `vega-paper render`
* `vega-paper infer`
* `vega-paper lint`
* `vega-paper doctor`
* initial themes
* examples

### Phase 2: AI Skill

* `SKILL.md`
* chart selection guide
* Vega-Lite pattern catalog
* paper style guide
* render / validation scripts

### Phase 3: Theme expansion

* shadcn-like variants
* ACL / EMNLP / NeurIPS paper profiles
* Nature / biomedical themes
* poster themes
* grayscale safety checks

### Phase 4: MCP wrapper

* MCP server
* `render_chart`
* `validate_spec`
* `list_themes`
* integration tests

### Phase 5: Research workflow integration

* Python wrapper
* notebook integration
* LaTeX helper
* GitHub Actions example
* paper repository template

---

## 14. 設計上の重要な判断

### 14.1 `vega-paper` は Vega の代替ではない

VegaPaper は Vega / Vega-Lite の公式機能をラップし、論文図生成に必要な不足分を補う。

### 14.2 AI には自由生成より constrained generation をさせる

最初から完全自然言語 → 完全図生成を目指さない。

MVPでは、AIは次を明示する。

```text
chart type
x field
y field
color field
theme
output format
```

その上で CLI が決定的に spec と図を生成する。

### 14.3 テーマは美しさより再現性を優先する

論文図では、派手さより以下を重視する。

* 読みやすさ
* 印刷耐性
* caption との整合性
* 小さい図幅での可読性
* Git / CI での再現性

### 14.4 SVG を canonical artifact にする

PNG は派生物、PDF は投稿用派生物とし、canonical output は SVG + spec とする。

---

## 15. 初期 README の一文

```text
VegaPaper is an AI-friendly CLI, theme toolkit, and Skill for creating publication-ready academic figures with Vega and Vega-Lite.
```

日本語では以下。

```text
VegaPaper は、Vega / Vega-Lite を用いて論文・研究発表向けの publication-ready な図を生成するための AI-friendly CLI / Theme Toolkit / Skill です。
```

---

## 16. Open Questions

* CLI framework は `commander` と `clipanion` のどちらにするか
* Theme config を JSON で持つか TypeScript で持つか
* PNG / PDF backend をどこまで MVP に入れるか
* npm package を `vega-paper` として公開できるか
* repository は単一 package から始めるか monorepo で始めるか
* Skill の配布形式を `packages/skill` にするか `.agents/skills/vega-paper` にするか
* Python wrapper を Phase 2 に入れるか Phase 5 に回すか

---

## 17. 現時点の推奨判断

* 名前: **VegaPaper**
* package / CLI: **`vega-paper`**
* 技術: **Bun + TypeScript**
* 中核: **CLI + Themes + Skill**
* rendering backend: **official Vega / Vega-Lite CLI**
* 出力: **SVG first**
* MCP: **Phase 2以降の薄い wrapper**

この設計により、公式Vega ecosystemに乗りつつ、独自価値を「AIで扱いやすい論文図生成」「モダンテーマ」「paper-ready validation」に集中できる。

