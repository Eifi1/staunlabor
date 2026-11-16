#!/usr/bin/env bash
# Staunlabor's database and roles on keksdose's shared Cloud SQL instance
# (deploy/roles.sql), from a workstation, as Kurvenschmiede's apply-roles.sh
# does it: the two role passwords come out of Secret Manager into psql
# variables, the instance is reached through a local cloud-sql-proxy that this
# script starts and stops, and the only thing typed is the instance's
# `postgres` password, at a prompt that does not echo. Safe to run again.
#
#     bash deploy/apply-roles.sh        # after deploy/setup-accounts.sh
#
# Needs: gcloud signed in with access to both projects, cloud-sql-proxy, psql.
set -euo pipefail

P=staunlabor
INSTANCE=keksdose:europe-west4:keksdose-db
PORT=55433
HERE="$(cd "$(dirname "$0")" && pwd)"

password_in() {
  gcloud secrets versions access latest --secret="$1" --project="$P" \
    | sed -E "s#.*$2:([^@]+)@.*#\\1#"
}
APP_PW="$(password_in staunlabor-db-url-app staunlabor_app)"
OWNER_PW="$(password_in staunlabor-db-url-owner staunlabor_owner)"

cloud-sql-proxy --gcloud-auth --port "$PORT" "$INSTANCE" >/dev/null 2>&1 &
PROXY=$!
trap 'kill "$PROXY" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break
  sleep 0.5
done

read -rsp "Password of the instance's postgres user: " PGPASSWORD; echo
export PGPASSWORD

# \connect inside roles.sql reuses host, port and PGPASSWORD.
psql "host=127.0.0.1 port=$PORT user=postgres dbname=postgres sslmode=disable" \
  -v ON_ERROR_STOP=1 -v app_pw="$APP_PW" -v owner_pw="$OWNER_PW" \
  -f "$HERE/roles.sql"

echo "Done: database staunlabor with the roles staunlabor_owner and staunlabor_app."
