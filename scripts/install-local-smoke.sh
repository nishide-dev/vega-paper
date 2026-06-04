#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_HOME="${TMPDIR:-/tmp}/vega-paper-install-smoke-$$"
SMOKE_PREFIX="${TMPDIR:-/tmp}/vega-paper-install-prefix-$$"

cleanup() {
  rm -rf "$SMOKE_HOME" "$SMOKE_PREFIX"
}

trap cleanup EXIT

bash "$ROOT_DIR/scripts/install.sh" \
  --from-repo \
  --prefix "$SMOKE_PREFIX" \
  --no-modify-path

export PATH="$SMOKE_PREFIX/bin:$PATH"

echo "Running vega-paper doctor..."
vega-paper doctor

echo "Rendering basic-line example..."
vega-paper render "$ROOT_DIR/examples/basic-line/chart.vl.json" \
  --theme paper-clean \
  --format svg \
  --out "$SMOKE_HOME/output.svg"

test -f "$SMOKE_HOME/output.svg"
echo "Install smoke passed."
