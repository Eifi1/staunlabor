#!/usr/bin/env bash
#
# One-time local PostgreSQL bootstrap for Staunlabor (development and tests).
#
# The accounts, the feedback and the translation review keep their rows in
# PostgreSQL — in development, in the test suite and in production (a database
# of its own on the shared Cloud SQL instance keksdose-db), the same engine
# everywhere, as Keksdose, Kastlan and Kurvenschmiede do. The exhibits never
# touch it.
#
# Creates one role and two databases on the local instance, beside the sibling
# projects' own. Run once, with access to a superuser:
#     npm run db:setup                  # = bash scripts/setup-postgres.sh
#
# Auth: `sudo -u postgres psql` by default (a native install). For a
# password-based superuser (Docker, say), set PG_SUPERUSER_DSN:
#     PG_SUPERUSER_DSN="postgresql://postgres:postgres@127.0.0.1:5432/postgres" npm run db:setup
#
# Override the dev password with STAUNLABOR_DB_PASSWORD=… — never the default
# anywhere but a laptop.
set -euo pipefail

DB_USER="staunlabor"
DB_PASSWORD="${STAUNLABOR_DB_PASSWORD:-staunlabor_dev}"
# `staunlabor_test` is a MAINTENANCE database and stays empty: the suite runs
# under `pytest -n auto`, and each xdist worker creates and drops a throwaway
# database of its own, because two workers emptying one database tear each
# other's fixtures down mid-test. `CREATE DATABASE` has to be issued from
# somewhere, and that is what this one is for.
DATABASES=("staunlabor" "staunlabor_test")

if [ -n "${PG_SUPERUSER_DSN:-}" ]; then
  run() { psql "$PG_SUPERUSER_DSN" -v ON_ERROR_STOP=1 "$@"; }
else
  run() { sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }
  # Check the superuser path BEFORE the first statement: without a terminal,
  # sudo fails with a message about askpass helpers that says nothing about what
  # this script is for, which is what an agent or a CI shell gets.
  if ! sudo -n true 2>/dev/null && [ ! -t 0 ]; then
    cat >&2 <<ADVICE
This needs a superuser to create the role, and sudo has no terminal to ask for a
password on. Any one of these:

  1. Run it from an interactive terminal:
       cd $(pwd) && npm run db:setup

  2. Point it at a password-based superuser instead of sudo:
       PG_SUPERUSER_DSN="postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres" npm run db:setup

  3. Paste this into a superuser psql yourself; it is the whole script:
       CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD' NOSUPERUSER CREATEDB;
       CREATE DATABASE staunlabor OWNER $DB_USER;
       CREATE DATABASE staunlabor_test OWNER $DB_USER;
ADVICE
    exit 1
  fi
fi

echo "==> Ensuring role '$DB_USER' (LOGIN, NOSUPERUSER, CREATEDB)…"
# CREATEDB is what lets the suite build a database per xdist worker without a
# superuser anywhere near the loop.
run -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD' NOSUPERUSER CREATEDB;
  ELSE
    ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD' NOSUPERUSER CREATEDB;
  END IF;
END \$\$;"

for db in "${DATABASES[@]}"; do
  exists="$(run -tAc "SELECT 1 FROM pg_database WHERE datname = '$db';")"
  if [ "$exists" = "1" ]; then
    echo "==> Database '$db' already exists; left as it is."
  else
    echo "==> Creating database '$db' owned by '$DB_USER'…"
    run -c "CREATE DATABASE $db OWNER $DB_USER;"
  fi
done

echo
echo "Done. The defaults point here, so nothing needs to go in backend/.env unless"
echo "you changed the password:"
echo "  STAUNLABOR_DATABASE_URL=postgresql+asyncpg://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/staunlabor"
