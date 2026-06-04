#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.4"
VEGA_PAPER_HOME="${VEGA_PAPER_HOME:-$HOME/.local/share/vega-paper}"
PREFIX="${PREFIX:-$HOME/.local}"
GITHUB_REPO="nishide-dev/vega-paper"
MODIFY_PATH=1
REPO_ROOT=""
FROM_REPO=0
FROM_TARBALL=""
INSTALL_ROOT=""

usage() {
  cat <<EOF
Install vega-paper into a user prefix.

Usage:
  install.sh [options]

Options:
  --version <ver>       Release version without v prefix (default: ${VERSION})
  --home <path>         Base install directory (default: ~/.local/share/vega-paper)
  --prefix <path>       Base prefix for bin shims (default: ~/.local)
  --from-repo           Install from this git checkout (CI/dev smoke)
  --from-tarball <path> Install from a local release tarball
  --no-modify-path      Do not print PATH instructions
  -h, --help            Show this help

Examples:
  curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/install.sh | bash
  bash scripts/install.sh --from-repo
  bash scripts/install.sh --from-tarball dist/release/vega-paper-0.1.0-darwin-arm64.tar.gz
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2#v}"
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
    --from-tarball)
      FROM_TARBALL="${2:-}"
      shift 2
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

detect_target() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "${os}-${arch}" in
    darwin-arm64) echo "darwin-arm64" ;;
    darwin-x86_64) echo "darwin-x64" ;;
    linux-x86_64) echo "linux-x64" ;;
    linux-amd64) echo "linux-x64" ;;
    *)
      echo "Unsupported platform: ${os} ${arch}. See ${GITHUB_REPO} releases for supported targets." >&2
      exit 1
      ;;
  esac
}

install_release_layout() {
  local source_dir="$1"
  local version_dir="${VEGA_PAPER_HOME}/versions/v${VERSION}"

  mkdir -p "${VEGA_PAPER_HOME}/versions"
  rm -rf "${version_dir}"
  mkdir -p "${version_dir}"

  if [[ -f "$source_dir" && "$source_dir" == *.tar.gz ]]; then
    tar -xzf "$source_dir" -C "${version_dir}" --strip-components=1
  else
    cp -R "${source_dir}/." "${version_dir}/"
  fi

  ln -sfn "${version_dir}" "${VEGA_PAPER_HOME}/current"
  INSTALL_ROOT="${VEGA_PAPER_HOME}/current"
}

write_release_shims() {
  local bin_dir="$PREFIX/bin"
  mkdir -p "$bin_dir"

  write_shim() {
    local name="$1"
    cat >"${bin_dir}/${name}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export VEGA_PAPER_HOME="${VEGA_PAPER_HOME}/current"
exec "\${VEGA_PAPER_HOME}/bin/${name}" "\$@"
EOF
    chmod +x "${bin_dir}/${name}"
  }

  write_shim "vega-paper"
  write_shim "vl2svg"
  write_shim "vl2png"
  write_shim "vl2pdf"
  write_shim "vg2svg"
  write_shim "vg2png"
  write_shim "vg2pdf"
}

if [[ "$FROM_REPO" -eq 1 ]]; then
  echo "Building vega-paper packages from repository..."
  (cd "$REPO_ROOT" && bun run --filter @vega-paper/themes build && bun build packages/cli/src/index.ts --outdir packages/cli/dist --target bun && chmod +x packages/cli/dist/index.js)
  VEGA_PAPER_HOME="$REPO_ROOT"

  BIN_DIR="$PREFIX/bin"
  mkdir -p "$BIN_DIR"

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

  write_repo_shim "vega-paper" "\"${VEGA_PAPER_HOME}/packages/cli/dist/index.js\""
  write_repo_shim "vl2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vl2svg\""
  write_repo_shim "vl2png" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vl2png\""
  write_repo_shim "vl2pdf" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vl2pdf\""
  write_repo_shim "vg2svg" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vg2svg\""
  write_repo_shim "vg2png" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vg2png\""
  write_repo_shim "vg2pdf" "\"${VEGA_PAPER_HOME}/node_modules/.bin/vg2pdf\""

elif [[ -n "$FROM_TARBALL" ]]; then
  echo "Installing from tarball ${FROM_TARBALL}..."
  install_release_layout "$FROM_TARBALL"
  write_release_shims

else
  TARGET="$(detect_target)"
  ARCHIVE="vega-paper-${VERSION}-${TARGET}.tar.gz"
  URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${ARCHIVE}"
  TMP_ARCHIVE="$(mktemp -t vega-paper-install.XXXXXX.tar.gz)"

  echo "Downloading ${URL}..."
  if ! curl -fsSL "$URL" -o "$TMP_ARCHIVE"; then
    echo "Failed to download release asset. Publish v${VERSION} with asset ${ARCHIVE} first." >&2
    rm -f "$TMP_ARCHIVE"
    exit 1
  fi

  install_release_layout "$TMP_ARCHIVE"
  rm -f "$TMP_ARCHIVE"
  write_release_shims
fi

if [[ "$FROM_REPO" -ne 1 ]]; then
  echo "Installed vega-paper v${VERSION} into ${VEGA_PAPER_HOME}/current"
  echo "Shims written to ${PREFIX}/bin"
else
  echo "Installed vega-paper shims into ${PREFIX}/bin"
fi

if [[ "$MODIFY_PATH" -eq 1 ]]; then
  echo
  echo "Add this directory to your PATH if needed:"
  echo "  export PATH=\"${PREFIX}/bin:\$PATH\""
  echo
  echo "Then run:"
  echo "  vega-paper doctor"
fi
