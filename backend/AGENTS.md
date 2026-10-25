# Trekfin backend

Read the root AGENTS.md first.

## No tests

The user explicitly forbids creating, modifying, generating or running automated tests. Never add fixtures, snapshots, test helpers, test factories or test dependencies. Verify with PHP syntax checks, route/migration inspection, Docker healthchecks, builds and manual browser/API scenarios. This overrides framework defaults.

## Code

PHP 8.4, Laravel 13, PostgreSQL 16. Use installed package versions and existing conventions. Keep controllers and services focused; use integer kopeks for money. Real operations require an author. Do not commit financial source data or secrets. Format changed PHP with Laravel Pint.
