#!/usr/bin/env bash
set -euo pipefail
cd /opt/trekfin
[[ ! -f .tls-ready ]] || exit 0
domain_name="$(sed -n 's/^DOMAIN=//p' .env)"
[[ "$domain_name" =~ ^[a-z0-9.-]+$ ]] || exit 1
if curl --fail --silent --max-time 8 --resolve "$domain_name:443:201.51.11.35" "https://$domain_name/api/health" >/dev/null 2>&1; then
  touch .tls-ready
  echo "Valid HTTPS certificate is active for $domain_name"
  exit 0
fi
dig +short @1.1.1.1 "$domain_name" A | grep -Fxq 201.51.11.35 || exit 0
previous_attempt="$(stat -c %Y .tls-attempt 2>/dev/null || echo 0)"
(( $(date +%s) - previous_attempt >= 900 )) || exit 0
touch .tls-attempt
echo 'DNS is ready; refreshing the Trekfin router to request its certificate'
docker compose up -d --no-build --no-deps --force-recreate nginx
