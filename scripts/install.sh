#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0"
VEGA_PAPER_HOME="${VEGA_PAPER_HOME:-$HOME/.local/share/vega-paper}"
PREFIX="${PREFIX:-$HOME/.local}"
MODIFY_PATH=1
REPO_ROOT=""
FROM_REPO=0

usage() {
  cat <<EOF
Install vega-paper into a user prefix.

Usage:
  install.sh [options]

Options:
  --version <ver>       npm version to install (default: ${VERSION})
  --home <path>         VEGA_PAPER_HOME install directory
  --prefix <path>       Base prefix for bin shims (default: ~/.local)
  --from-repo           Install from this git checkout (CI/dev smoke)
  --no-modify-path      Do not print PATH instructions
  -h, --help            Show this help

Examples:
  curl -fsSL .../install.sh | bash
  bash scripts/install.sh --from-repo
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --home)
      VEGA_PAPER_HOME="${2:-}"
      shift 2
      ;;
    --prefix)
      PREFIX="${2:-}"
      shift 2
      ;;
    --from-repo)
      FROM_REPO=1
      REPO_ROOT="$ROOT_DIR"
      shift
      ;;
    --no-modify-path)
      MODIFY_PATH=0
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$FROM_REPO" -eq 1 ]]; then
  echo "Building vega-paper packages from repository..."
  (cd "$REPO_ROOT" && bun run --filter @vega-paper/themes build && bun build packages/cli/src/index.ts --outdir packages/cli/dist --target bun && chmod +x packages/cli/dist/index.js)
  VEGA_PAPER_HOME="$REPO_ROOT"
else
  if ! command -v bun >/dev/null 2>&1; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
  fi

  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is required but was not found on PATH after install." >&2
    exit 1
  fi

  mkdir -p "$VEGA_PAPER_HOME"
  cat >"$VEGA_PAPER_HOME/package.json" <<EOF
{
  "name": "vega-paper-install",
  "private": true,
  "dependencies": {
    "vega-paper": "${VERSION}"
  }
}
EOF

  echo "Installing vega-paper@${VERSION} into ${VEGA_PAPER_HOME}..."
  (cd "$VEGA_PAPER_HOME" && bun install)
fi

BIN_DIR="$PREFIX/bin"
mkdir -p "$BIN_DIR"

write_shim() {
  local name="$1"
  local target="$2"
  cat >"$BIN_DIR/$name" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export VEGA_PAPER_HOME="${VEGA_PAPER_HOME}"
exec ${target} "\$@"
EOF
  chmod +x "$BIN_DIR/$name"
}

write_repo_shim() {
  local name="$1"
  local target="$2"
  cat >"$BIN_DIR/$name" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec ${target} "\$@"
EOF
  chmod +x "$BIN_DIR/$name"
}

if [[ "$FROM_REPO" -eq 1 ]]; then
  write_repo_shim "vega-paper" "\"${VEGA_PAPER_HOME}/packages/cli/dist/index.js\""
  write_repo_shim "vl2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vl2svg\""
  write_repo_shim "vg2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vg2svg\""
else
  write_shim "vega-paper" "\"${VEGA_PAPER_HOME}/node_modules/vega-paper/dist/index.js\""
  write_shim "vl2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vl2svg\""
  write_shim "vg2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vg2svg\""
fi

echo "Installed vega-paper shims into ${BIN_DIR}"

if [[ "$MODIFY_PATH" -eq 1 ]]; then
  echo
  echo "Add this directory to your PATH if needed:"
  echo "  export PATH=\"${BIN_DIR}:\$PATH\""
  echo
  echo "Then run:"
  echo "  vega-paper doctor"
fi
