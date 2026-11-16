#!/usr/bin/env bash
# The first admin, before the site opens (deploy/README.md §6): the schema built
# on the database `staunlabor` and the operator's account made in it as the
# admin, so that nobody who types the allow-listed address at the site first can
# claim it. Run once, after apply-roles.sh and before the first deploy of the
# account routes; it changes nothing once any account exists.
#
#     bash deploy/bootstrap-admin.sh
#
# The database is reached through a local cloud-sql-proxy that this script
# starts and stops; the two role passwords come out of Secret Manager into this
# process alone. It asks for the admin's address, name and password (twice,
# not echoed); nothing of it is written to a file or printed.
#
# Needs: gcloud signed in with access to both projects, cloud-sql-proxy, uv.
set -euo pipefail

P=staunlabor
INSTANCE=keksdose:europe-west4:keksdose-db
PORT=55435
HERE="$(cd "$(dirname "$0")" && pwd)"

password_in() {
  gcloud secrets versions access latest --secret="$1" --project="$P" \
    | sed -E "s#.*$2:([^@]+)@.*#\\1#"
}
OWNER_PW="$(password_in staunlabor-db-url-owner staunlabor_owner)"
APP_PW="$(password_in staunlabor-db-url-app staunlabor_app)"

cloud-sql-proxy --gcloud-auth --port "$PORT" "$INSTANCE" >/dev/null 2>&1 &
PROXY=$!
trap 'kill "$PROXY" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break
  sleep 0.5
done

cd "$HERE/../backend"
# The migrations as the owner, as the deploy's job runs them (it then finds
# nothing left to do); the account as the app's role, as the site writes one.
# Twelve bcrypt rounds, the deployment's, whatever a laptop's settings say.
echo "Building the schema (alembic upgrade head) …"
STAUNLABOR_DATABASE_URL="postgresql+asyncpg://staunlabor_owner:$OWNER_PW@127.0.0.1:$PORT/staunlabor" \
  uv run --no-sync alembic upgrade head
echo "The admin's account:"
STAUNLABOR_DATABASE_URL="postgresql+asyncpg://staunlabor_app:$APP_PW@127.0.0.1:$PORT/staunlabor" \
STAUNLABOR_BCRYPT_ROUNDS=12 \
  uv run --no-sync python -m staunlabor.bootstrap
