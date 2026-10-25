#!/usr/bin/env bash
set -euo pipefail
cd /opt/trekfin
exec 9>/run/lock/trekfin-deploy.lock
flock -n 9 || exit 0
target_revision="${1:?Expected verified commit SHA}"
[[ "$target_revision" =~ ^[a-f0-9]{40}$ ]] || exit 1
previous_revision="$(cat .deployed-sha 2>/dev/null || true)"
git cat-file -e "$target_revision^{commit}"
if docker compose ps --status running db --quiet | grep -q .; then
  bash scripts/backup.sh
fi
for image in trekfin-php trekfin-nginx; do
  if docker image inspect "$image:local" >/dev/null 2>&1; then docker tag "$image:local" "$image:previous"; fi
done
git reset --hard "$target_revision"
rollback() {
  echo 'Deployment failed; restoring the previous application images' >&2
  trap - ERR
  for image in trekfin-php trekfin-nginx; do
    if docker image inspect "$image:previous" >/dev/null 2>&1; then docker tag "$image:previous" "$image:local"; fi
  done
  if [[ -n "$previous_revision" ]]; then git reset --hard "$previous_revision"; fi
  docker compose up -d --no-build app nginx scheduler || true
  exit 1
}
trap rollback ERR
docker compose build app nginx
docker compose up -d db
docker compose run --rm --no-deps app php artisan migrate --force
docker compose up -d --no-build app nginx scheduler
for attempt in $(seq 1 30); do
  if docker compose exec -T nginx wget -q -O /dev/null http://127.0.0.1/api/health; then
    echo "$target_revision" > .deployed-sha
    echo "Deployed $target_revision"
    exit 0
  fi
  sleep 2
done
false
