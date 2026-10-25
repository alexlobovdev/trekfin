#!/usr/bin/env bash
set -euo pipefail
cd /opt/trekfin
umask 077
mkdir -p /var/backups/trekfin
backup_file="/var/backups/trekfin/$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$backup_file.tmp"
mv "$backup_file.tmp" "$backup_file"
find /var/backups/trekfin -name '*.sql.gz' -mtime +14 -delete
echo "Database snapshot saved"
