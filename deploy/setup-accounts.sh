#!/usr/bin/env bash
# What the account layer needs of GCP before its first deploy (deploy/README.md
# §6), as one script that can be run again: what exists is left as it is.
#
#   bash deploy/setup-accounts.sh
#
# It makes, in the project `staunlabor` unless said otherwise,
#   * the Cloud SQL Admin and Cloud Scheduler APIs;
#   * the web service's own account, staunlabor-web, which reads the edge token
#     and nothing else, so that staunlabor-run, which now reads the database's
#     and the signing key's secrets, is the backend's alone;
#   * the secrets the backend and the migrate job read: the two database URLs
#     (each with a password made here), the signing key and the daily call's
#     token, from random bytes, never printed, never in a file;
#   * roles/cloudsql.client in the project `keksdose`, for staunlabor-run (the
#     backend and the migrate job connect as it) and staunlabor-build;
#   * the private bucket for feedback's files, which staunlabor-run alone may
#     use, and github-deployer's storage.admin narrowed to leave it out;
#   * the daily call: a Cloud Scheduler job that POSTs the account routes'
#     /ops/accounts/daily through the site with the jobs token.
# What it does not make: the database and its roles (apply-roles.sh, which asks
# for the instance's postgres password), the second factor's key
# staunlabor-totp-keys and the Resend key, which Marcel makes himself; it grants
# the backend each of these two once it exists, so run it again after.
set -euo pipefail

P=staunlabor
R=europe-west4
SQL_PROJECT=keksdose
INSTANCE=keksdose:europe-west4:keksdose-db
BUCKET=staunlabor-feedback-files
SITE=https://staunlabor.app
RUN=staunlabor-run@$P.iam.gserviceaccount.com
WEB=staunlabor-web@$P.iam.gserviceaccount.com
BUILD=staunlabor-build@$P.iam.gserviceaccount.com
DEPLOYER=github-deployer@$P.iam.gserviceaccount.com
TMP=$(mktemp -d)
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
say() { printf '\n== %s\n' "$*"; }
quiet() { "$@" >/dev/null; }
exists() { gcloud secrets describe "$1" --project=$P >/dev/null 2>&1; }
# A secret from random bytes, made once; the value goes from python straight to
# Secret Manager.
make_secret() { # name, python expression printing the value
  if exists "$1"; then
    echo "secret $1 exists"
  else
    python3 -c "import secrets; print($2, end='')" \
      | quiet gcloud secrets create "$1" --project=$P --replication-policy=user-managed \
          --locations=$R --data-file=-
    echo "secret $1 created"
  fi
}
reads() { # account, secret
  quiet gcloud secrets add-iam-policy-binding "$2" --project=$P \
    --member="serviceAccount:$1" --role=roles/secretmanager.secretAccessor
  echo "$1 reads $2"
}

say "1. The APIs"
quiet gcloud services enable sqladmin.googleapis.com cloudscheduler.googleapis.com --project=$P
echo "sqladmin and cloudscheduler on"

say "2. The web service's own account"
if gcloud iam service-accounts describe $WEB --project=$P >/dev/null 2>&1; then
  echo "staunlabor-web exists"
else
  quiet gcloud iam service-accounts create staunlabor-web --project=$P \
    --display-name="Staunlabor web (Caddy), reads the edge token"
  echo "staunlabor-web created"
  sleep 10 # a new account takes a moment before IAM accepts it as a member
fi
reads $WEB staunlabor-edge-token
quiet gcloud iam service-accounts add-iam-policy-binding $WEB --project=$P \
  --member=serviceAccount:$BUILD --role=roles/iam.serviceAccountUser
echo "$BUILD deploys the web service as $WEB"

say "3. The backend's secrets"
# The database URLs name the instance's socket, as Cloud Run mounts it; the
# password is URL-safe, so it needs no quoting in the URL.
url() { echo "'postgresql+asyncpg://$1:' + secrets.token_urlsafe(24) + '@/staunlabor?host=/cloudsql/$INSTANCE'"; }
make_secret staunlabor-db-url-app "$(url staunlabor_app)"
make_secret staunlabor-db-url-owner "$(url staunlabor_owner)"
make_secret staunlabor-jwt-secret "secrets.token_hex(32)"
make_secret staunlabor-jobs-token "secrets.token_hex(32)"
for secret in staunlabor-db-url-app staunlabor-db-url-owner staunlabor-jwt-secret staunlabor-jobs-token; do
  reads $RUN $secret
done
# Made by Marcel (README §6); granted once they exist.
for secret in staunlabor-totp-keys staunlabor-resend-api-key; do
  if exists $secret; then reads $RUN $secret; else echo "secret $secret not there yet: nothing granted"; fi
done

say "4. The shared instance, from $P's accounts"
for sa in $RUN $BUILD; do
  quiet gcloud projects add-iam-policy-binding $SQL_PROJECT --member=serviceAccount:$sa \
    --role=roles/cloudsql.client --condition=None
  echo "$sa: roles/cloudsql.client in $SQL_PROJECT"
done

say "5. The bucket for feedback's files"
if gcloud storage buckets describe gs://$BUCKET --project=$P >/dev/null 2>&1; then
  echo "bucket $BUCKET exists"
else
  # Seven days' soft delete, Google's default and Kurvenschmiede's: a deleted
  # file can be restored for a week, an erased person's is gone after it.
  quiet gcloud storage buckets create gs://$BUCKET --project=$P --location=$R \
    --default-storage-class=STANDARD --uniform-bucket-level-access --public-access-prevention \
    --soft-delete-duration=7d
  echo "bucket $BUCKET created"
fi
quiet gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$RUN --role=roles/storage.objectUser
echo "$RUN: objects in $BUCKET, nothing about the bucket"
# A new bucket gives the project's editors and viewers its files too; only the
# owner and the app keep them (Kurvenschmiede README, "The uploads bucket").
gcloud storage buckets get-iam-policy gs://$BUCKET --format=json > "$TMP/policy.json"
for pair in "projectEditor roles/storage.legacyBucketOwner" "projectEditor roles/storage.legacyObjectOwner" \
            "projectViewer roles/storage.legacyBucketReader" "projectViewer roles/storage.legacyObjectReader"; do
  set -- $pair
  if python3 - "$TMP/policy.json" "$1:$P" "$2" <<'PY'
import json, sys
policy, member, role = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
sys.exit(0 if any(b["role"] == role and member in b["members"] for b in policy.get("bindings", [])) else 1)
PY
  then
    quiet gcloud storage buckets remove-iam-policy-binding gs://$BUCKET --member="$1:$P" --role="$2"
    echo "$1: $2 removed"
  fi
done
# github-deployer's storage.admin is for the build's source upload; on the whole
# project it would reach this bucket's files from outside the bucket's policy.
# The condition leaves this bucket out, and the unconditioned grant goes.
quiet gcloud projects add-iam-policy-binding $P --member=serviceAccount:$DEPLOYER --role=roles/storage.admin \
  --condition="expression=!resource.name.startsWith(\"projects/_/buckets/$BUCKET\"),title=not-the-feedback-bucket"
if gcloud projects get-iam-policy $P --format=json | python3 -c "
import json, sys
sys.exit(0 if any(b['role'] == 'roles/storage.admin' and 'serviceAccount:$DEPLOYER' in b['members'] and 'condition' not in b
                  for b in json.load(sys.stdin)['bindings']) else 1)"; then
  quiet gcloud projects remove-iam-policy-binding $P --member=serviceAccount:$DEPLOYER --role=roles/storage.admin \
    --condition=None
  echo "$DEPLOYER: the unconditioned storage.admin removed"
fi
echo "$DEPLOYER: storage.admin on every bucket but $BUCKET"

say "6. The daily call"
# Through the site, so the scheduler needs no way past the backend's internal
# ingress. The token goes into the job's header from Secret Manager by a file in
# a private directory, never on a command line. If the token is ever changed,
# delete the job and run this again.
JOB=projects/$P/locations/$R/jobs/staunlabor-accounts-daily
if gcloud scheduler jobs describe staunlabor-accounts-daily --location=$R --project=$P >/dev/null 2>&1; then
  echo "job staunlabor-accounts-daily exists"
else
  gcloud secrets versions access latest --secret=staunlabor-jobs-token --project=$P > "$TMP/token"
  python3 - "$TMP/token" "$JOB" "$SITE" > "$TMP/job.json" <<'PY'
import json, sys
token, job, site = open(sys.argv[1]).read().strip(), sys.argv[2], sys.argv[3]
print(json.dumps({
    "name": job,
    "description": "The account layer's daily call: erasures due, the prune, the upload sweep (deploy/README.md §6)",
    "schedule": "30 3 * * *",
    "timeZone": "Europe/Zurich",
    "attemptDeadline": "180s",
    "retryConfig": {"retryCount": 3, "minBackoffDuration": "300s"},
    "httpTarget": {
        "uri": f"{site}/api/v1/ops/accounts/daily",
        "httpMethod": "POST",
        "headers": {"X-Jobs-Token": token},
    },
}))
PY
  printf 'Authorization: Bearer %s\n' "$(gcloud auth print-access-token)" > "$TMP/auth"
  curl -sS --fail-with-body -o "$TMP/answer.json" -X POST -H @"$TMP/auth" -H "Content-Type: application/json" \
    --data @"$TMP/job.json" "https://cloudscheduler.googleapis.com/v1/projects/$P/locations/$R/jobs" \
    || { echo "Creating the job failed:"; python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('error',{}).get('message'))" "$TMP/answer.json"; exit 1; }
  echo "job staunlabor-accounts-daily created: 03:30 Europe/Zurich, POST $SITE/api/v1/ops/accounts/daily"
fi

say "Done. Still to do:"
exists staunlabor-totp-keys || echo "  * Marcel: the secret staunlabor-totp-keys (README §6), then run this again"
echo "  * Marcel: bash deploy/apply-roles.sh (the database and its roles; asks for the postgres password)"
exists staunlabor-resend-api-key || echo "  * Marcel, for mail: staunlabor-resend-api-key once Resend has verified staunlabor.app"
