#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=""
TARGET=""
OUTDIR="${ROOT_DIR}/dist/release"

usage() {
  cat <<EOF
Build a GitHub Release tarball for vega-paper.

Usage:
  build-release-tarball.sh --version <ver> --target <target> [--outdir <path>]

Targets:
  darwin-arm64, darwin-x64, linux-x64

Example:
  bash scripts/build-release-tarball.sh --version 0.1.0 --target darwin-arm64
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --outdir)
      OUTDIR="${2:-}"
      shift 2
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

if [[ -z "$VERSION" || -z "$TARGET" ]]; then
  echo "Missing required --version and --target." >&2
  usage >&2
  exit 2
fi

case "$TARGET" in
  darwin-arm64) BUN_TARGET="bun-darwin-arm64" ;;
  darwin-x64) BUN_TARGET="bun-darwin-x64" ;;
  linux-x64) BUN_TARGET="bun-linux-x64" ;;
  *)
    echo "Unsupported target: $TARGET" >&2
    exit 2
    ;;
esac

WORK_DIR="$(mktemp -d)"
ROOT_NAME="vega-paper-${VERSION}-${TARGET}"
STAGING="${WORK_DIR}/${ROOT_NAME}"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

mkdir -p "${STAGING}/bin" "${STAGING}/lib"

echo "Building themes and validating CLI sources..."
(cd "$ROOT_DIR" && bun run --filter @vega-paper/themes build && bun run --filter vega-paper build)

echo "Compiling vega-paper for ${TARGET}..."
bun build "${ROOT_DIR}/packages/cli/src/index.ts" \
  --compile \
  --target="${BUN_TARGET}" \
  --outfile "${STAGING}/bin/vega-paper"
chmod +x "${STAGING}/bin/vega-paper"

echo "${VERSION}" >"${STAGING}/VERSION"

cat >"${STAGING}/lib/package.json" <<EOF
{
  "name": "vega-paper-release-lib",
  "private": true,
  "dependencies": {
    "vega-lite": "latest",
    "vega-cli": "latest"
  }
}
EOF

echo "Installing Vega CLI dependencies..."
(cd "${STAGING}/lib" && bun install --production)

write_tool_shim() {
  local name="$1"
  cat >"${STAGING}/bin/${name}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
ROOT="\$(cd "\$(dirname "\$0")/.." && pwd)"
exec "\${ROOT}/lib/node_modules/.bin/${name}" "\$@"
EOF
  chmod +x "${STAGING}/bin/${name}"
}

write_tool_shim "vl2svg"
write_tool_shim "vl2png"
write_tool_shim "vl2pdf"
write_tool_shim "vg2svg"
write_tool_shim "vg2png"
write_tool_shim "vg2pdf"

mkdir -p "$OUTDIR"
ARCHIVE="${OUTDIR}/${ROOT_NAME}.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK_DIR" "$ROOT_NAME"

echo "Wrote ${ARCHIVE}"
