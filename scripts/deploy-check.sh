#!/usr/bin/env bash
set -euo pipefail
cd /opt/trekfin
bash scripts/ensure-tls.sh
git fetch --quiet origin main
target_revision="$(git rev-parse origin/main)"
[[ "$target_revision" != "$(cat .deployed-sha 2>/dev/null || true)" ]] || exit 0
build_status="$(curl --fail --silent --show-error --max-time 20 \
  -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/alexlobovdev/trekfin/actions/workflows/ci.yml/runs?branch=main&head_sha=$target_revision&per_page=1" \
  | python3 -c 'import json,sys; runs=json.load(sys.stdin).get("workflow_runs",[]); print(runs[0].get("conclusion") if runs else "pending")')"
[[ "$build_status" == success ]] || exit 0
exec bash scripts/deploy.sh "$target_revision"
