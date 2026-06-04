#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.1.0"
SMOKE_HOME="$(mktemp -d "${TMPDIR:-/tmp}/vega-paper-tarball-home.XXXXXX")"
SMOKE_PREFIX="$(mktemp -d "${TMPDIR:-/tmp}/vega-paper-tarball-prefix.XXXXXX")"

cleanup() {
  rm -rf "$SMOKE_HOME" "$SMOKE_PREFIX"
}

trap cleanup EXIT

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
      echo "Unsupported platform for tarball smoke: ${os} ${arch}" >&2
      exit 1
      ;;
  esac
}

TARGET="$(detect_target)"
TARBALL="${ROOT_DIR}/dist/release/vega-paper-${VERSION}-${TARGET}.tar.gz"

bash "${ROOT_DIR}/scripts/build-release-tarball.sh" --version "${VERSION}" --target "${TARGET}"

bash "${ROOT_DIR}/scripts/install.sh" \
  --version "${VERSION}" \
  --home "${SMOKE_HOME}" \
  --prefix "${SMOKE_PREFIX}" \
  --from-tarball "${TARBALL}" \
  --no-modify-path

export PATH="${SMOKE_PREFIX}/bin:${PATH}"

echo "Running vega-paper doctor..."
vega-paper doctor

echo "Rendering basic-line example..."
vega-paper render "${ROOT_DIR}/examples/basic-line/chart.vl.json" \
  --theme paper-clean \
  --format svg \
  --out "${SMOKE_HOME}/output.svg"

test -f "${SMOKE_HOME}/output.svg"

echo "Rendering PNG from basic-line example..."
vega-paper render "${ROOT_DIR}/examples/basic-line/chart.vl.json" \
  --theme paper-clean \
  --format png \
  --out "${SMOKE_HOME}/output.png"

test -f "${SMOKE_HOME}/output.png"
echo "Tarball install smoke passed."
