# Trekfin

React + Laravel 13 + PostgreSQL 16 + nginx. One Docker Compose project; on the CRM host the existing Traefik issues and renews the certificate for trekfin.ru.

## Production

Project: `/opt/trekfin`. Configuration: root `.env` (0600). Start: `docker compose up -d`. Run migrations: `docker compose run --rm app php artisan migrate --force`.

`trekfin:users` creates Alexey and Vika once and writes temporary passwords to `storage/app/private/initial-credentials.txt`. Password replacement is required at first sign-in. Public registration does not exist.

`trekfin:import /path/to/import.json` loads the private cell snapshot once. Every monthly total is compared to its original cached value. An identical re-import is a no-op; a changed source is refused. The complete source, all five sheets and formulas are retained privately. Planned values never become actual transactions automatically.

On a separate host: set EDGE_NETWORK=trekfin-edge, create it with `docker network create trekfin-edge`, then use `docker compose --profile standalone up -d` to start the included Traefik. DNS must point to the host and ports 80/443 must be available.

## Delivery

GitHub Actions builds both production images and validates PHP and Compose. The `trekfin-deploy.timer` checks main every three minutes. Only a commit with a successful Build workflow is deployed. No GitHub token, SSH deployment credential or public webhook is required. This workflow uses the public repository API.

`journalctl -u trekfin-deploy.service` shows deployment status. The previous images are retained for rollback if an update fails. Additive migrations are required for application rollback to remain safe.

Before deployments and daily at 03:15 Yekaterinburg, PostgreSQL is dumped to `/var/backups/trekfin`. Retention: 14 days. Backups stay on this host. Restore with `gunzip -c backup.sql.gz | docker compose exec -T db psql -U trekfin -d trekfin` while application writes are stopped. Keep a separate off-host copy for disaster recovery.

## Notifications and data

Safari Web Push uses VAPID and a service worker. Add Trekfin to Home Screen (iOS 16.4+) or Dock, then enable notifications in Settings. Morning reminders: 09:00; evening: 21:00 Yekaterinburg. Device permission can only be granted by the person using the device. Push delivery to a real device requires that subscription. Financial API responses are not cached by the service worker.

Tips are local Russian editorial text; currency rates are loaded from the free Central Bank XML API with caching and a stale fallback. API failure does not prevent bookkeeping.

Money is stored as integer kopeks. Each actual operation has an author and records who created/last changed it. Archived categories remain in history. Debt repayments within the couple are tracked separately from household income and expenses. CSV export escapes spreadsheet formulas.

## Development

PHP 8.4; Node 24. Run `composer install` in backend and `npm ci` in frontend. Serve Laravel on 127.0.0.1:8001 and Vite on 127.0.0.1:5173; the Vite proxy sends /api to Laravel.

Automated tests, test dependencies and fixtures are forbidden by the user. Verification uses PHP syntax, route/migration inspection, production builds, healthchecks and manual browser/API scenarios.
