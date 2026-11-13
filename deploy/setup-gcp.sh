#!/usr/bin/env bash
# The one-time setup of the GCP project `staunlabor` (deploy/README.md §1), as
# one script that can be run again: what exists is left as it is.
#
#   bash deploy/setup-gcp.sh [address for the alert mails; default: the project owner's]
#
# It makes
#   * the Artifact Registry repository and the build's source bucket, in the EU;
#   * three accounts: staunlabor-build (what a deploy does, nothing else),
#     staunlabor-run (both services, no roles at all) and github-deployer
#     (starts a build as staunlabor-build, uploads its source);
#   * GitHub's keyless sign-in, only for runs of Eifi1/staunlabor on main;
#   * three alert mails: a service deployed by anyone but the build, a key made
#     for a service account, a change to the project's access;
#   * the site's private way to the backend: the default network, and Private
#     Google Access on its europe-west4 subnet;
# and takes roles/editor from the Compute default account, if the project gave
# it one.
set -euo pipefail

P=staunlabor
R=europe-west4
REPO=Eifi1/staunlabor
# The alert address: the one given, else the project owner's own account.
ALERT_EMAIL=${1:-$(gcloud projects get-iam-policy $P --format=json | python3 -c "
import json, sys
owners = [m[5:] for b in json.load(sys.stdin)['bindings'] if b['role'] == 'roles/owner' for m in b['members'] if m.startswith('user:')]
print(owners[0] if len(owners) == 1 else '')")}
[ -n "$ALERT_EMAIL" ] || { echo "Usage: bash deploy/setup-gcp.sh <address for the alert mails>; nothing done."; exit 1; }
echo "Alert mails go to $ALERT_EMAIL"

PN=$(gcloud projects describe $P --format='value(projectNumber)')
BUILD=staunlabor-build@$P.iam.gserviceaccount.com
RUN=staunlabor-run@$P.iam.gserviceaccount.com
DEPLOYER=github-deployer@$P.iam.gserviceaccount.com
CE=$PN-compute@developer.gserviceaccount.com
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
say() { printf '\n== %s\n' "$*"; }
quiet() { "$@" >/dev/null; }

say "1. The image repository and the build's source bucket"
if gcloud artifacts repositories describe $P --location=$R --project=$P >/dev/null 2>&1; then
  echo "repository $P exists"
else
  quiet gcloud artifacts repositories create $P --project=$P --location=$R --repository-format=docker \
    --description="Staunlabor's images"
  echo "repository $P created"
fi
# `gcloud builds submit` uploads the source to gs://<project>_cloudbuild and
# would make it in the US if it did not exist; made here, it is in the EU.
if gcloud storage buckets describe gs://${P}_cloudbuild --project=$P >/dev/null 2>&1; then
  echo "bucket ${P}_cloudbuild exists"
else
  quiet gcloud storage buckets create gs://${P}_cloudbuild --project=$P --location=$R \
    --uniform-bucket-level-access --public-access-prevention
  echo "bucket ${P}_cloudbuild created"
fi
# A build's source is a copy of the public repository: a month is plenty.
cat > "$TMP/lifecycle.json" <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 30}}]}
JSON
quiet gcloud storage buckets update gs://${P}_cloudbuild --lifecycle-file="$TMP/lifecycle.json"

say "2. The three accounts"
for sa in "staunlabor-build:Staunlabor Cloud Build (deploys)" \
          "staunlabor-run:Staunlabor services, no roles" \
          "github-deployer:GitHub deployer (starts builds)"; do
  name=${sa%%:*}; display=${sa#*:}
  if gcloud iam service-accounts describe "$name@$P.iam.gserviceaccount.com" --project=$P >/dev/null 2>&1; then
    echo "$name exists"
  else
    quiet gcloud iam service-accounts create "$name" --project=$P --display-name="$display"
    echo "$name created"
  fi
done
sleep 10 # a new account takes a moment before IAM accepts it as a member

say "3. What a build needs, and nothing else"
for role in roles/run.admin roles/logging.logWriter; do
  quiet gcloud projects add-iam-policy-binding $P --member=serviceAccount:$BUILD --role=$role --condition=None
done
quiet gcloud artifacts repositories add-iam-policy-binding $P --location=$R --project=$P \
  --member=serviceAccount:$BUILD --role=roles/artifactregistry.writer
quiet gcloud storage buckets add-iam-policy-binding gs://${P}_cloudbuild \
  --member=serviceAccount:$BUILD --role=roles/storage.objectViewer
quiet gcloud iam service-accounts add-iam-policy-binding $RUN --project=$P \
  --member=serviceAccount:$BUILD --role=roles/iam.serviceAccountUser
echo "$BUILD: deploys Cloud Run as $RUN, pushes images, writes its log, reads its source"

say "4. The Compute default account keeps nothing"
if gcloud projects get-iam-policy $P --format=json | python3 -c "
import json, sys
sys.exit(0 if any(b['role'] == 'roles/editor' and 'serviceAccount:$CE' in b['members'] for b in json.load(sys.stdin)['bindings']) else 1)"; then
  quiet gcloud projects remove-iam-policy-binding $P --member=serviceAccount:$CE --role=roles/editor --condition=None
  echo "roles/editor removed"
else
  echo "it had no roles/editor"
fi

say "5. GitHub's keyless sign-in, from runs of $REPO on main only"
if gcloud iam workload-identity-pools describe github --location=global --project=$P >/dev/null 2>&1; then
  echo "pool github exists"
else
  quiet gcloud iam workload-identity-pools create github --project=$P --location=global --display-name=GitHub
  echo "pool github created"
fi
if gcloud iam workload-identity-pools providers describe github --workload-identity-pool=github \
    --location=global --project=$P >/dev/null 2>&1; then
  echo "provider github exists"
else
  quiet gcloud iam workload-identity-pools providers create-oidc github --project=$P \
    --location=global --workload-identity-pool=github \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
    --attribute-condition="assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"
  echo "provider github created"
fi
for role in roles/cloudbuild.builds.editor roles/serviceusage.serviceUsageConsumer roles/storage.admin; do
  quiet gcloud projects add-iam-policy-binding $P --member=serviceAccount:$DEPLOYER --role=$role --condition=None
done
quiet gcloud iam service-accounts add-iam-policy-binding $BUILD --project=$P \
  --member=serviceAccount:$DEPLOYER --role=roles/iam.serviceAccountUser
quiet gcloud iam service-accounts add-iam-policy-binding $DEPLOYER --project=$P \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"
echo "$DEPLOYER: starts builds as $BUILD, uploads their source; signed in to by $REPO's runs on main"

say "6. The alert mails"
CHANNEL=$(gcloud beta monitoring channels list --project=$P --filter="displayName='Staunlabor alerts'" --format='value(name)' | head -1)
if [ -z "$CHANNEL" ]; then
  CHANNEL=$(gcloud beta monitoring channels create --project=$P --type=email \
    --display-name="Staunlabor alerts" --channel-labels=email_address="$ALERT_EMAIL" --format='value(name)')
fi
echo "channel $CHANNEL"
policy() { # display name, condition name, filter, what to do
  if [ -n "$(gcloud monitoring policies list --project=$P --filter="displayName='$1'" --format='value(name)')" ]; then
    echo "alert exists: $1"
    return
  fi
  python3 - "$TMP/alert.json" "$CHANNEL" "$1" "$2" "$3" "$4" <<'PY'
import json, sys
path, channel, name, condition, log_filter, doc = sys.argv[1:]
json.dump({
    "displayName": name,
    "combiner": "OR",
    "conditions": [{"displayName": condition, "conditionMatchedLog": {"filter": log_filter}}],
    "alertStrategy": {"notificationRateLimit": {"period": "300s"}, "autoClose": "86400s"},
    "notificationChannels": [channel],
    "documentation": {"content": doc, "mimeType": "text/markdown"},
}, open(path, "w"))
PY
  quiet gcloud monitoring policies create --project=$P --policy-from-file="$TMP/alert.json"
  echo "alert: $1"
}
ACTIVITY="logName=\"projects/$P/logs/cloudaudit.googleapis.com%2Factivity\""
policy "Staunlabor: deployed outside the build" \
  "A Cloud Run service changed by someone other than the build" \
  "$ACTIVITY AND protoPayload.serviceName=\"run.googleapis.com\" AND protoPayload.methodName=~\"(Create|Replace|Update|Delete)(Service|Job)\$\" AND NOT protoPayload.authenticationInfo.principalEmail=\"$BUILD\"" \
  "Every deploy goes through Cloud Build (deploy/README.md). A change by anybody else is either a hand-made fix or someone who should not be there: check the principal in the log entry."
policy "Staunlabor: service-account key created" \
  "A key for a service account was created or uploaded" \
  "$ACTIVITY AND protoPayload.serviceName=\"iam.googleapis.com\" AND protoPayload.methodName=~\"(Create|Upload)ServiceAccountKey\$\"" \
  "No account here uses keys: GitHub signs in through Workload Identity Federation and Cloud Run through its own credentials. A key is a lasting way in; delete it unless you made it."
policy "Staunlabor: access changed" \
  "The project's IAM policy changed" \
  "$ACTIVITY AND protoPayload.serviceName=\"cloudresourcemanager.googleapis.com\" AND protoPayload.methodName=\"SetIamPolicy\"" \
  "Who may do what in the project changed. Expected only when you changed it yourself."

say "7. The site's private way to the backend"
# The backend is --ingress=internal (cloudbuild.yaml), so its run.app URL
# answers only what arrives through the project's VPC; the web service gets
# there by Direct VPC egress into the default network. Enabling Compute makes
# that network (one auto-mode subnet per region); Private Google Access on
# this region's subnet is what carries a run.app request out of it. Without it
# the network has no way out at all (there is no Cloud NAT), so Caddy cannot
# reach the backend and every /api request fails.
quiet gcloud services enable compute.googleapis.com --project=$P
if [ "$(gcloud compute networks subnets describe default --region=$R --project=$P \
    --format='value(privateIpGoogleAccess)')" = "True" ]; then
  echo "Private Google Access is on for default/$R"
else
  quiet gcloud compute networks subnets update default --region=$R --project=$P \
    --enable-private-ip-google-access
  echo "Private Google Access turned on for default/$R"
fi

say "Done. GitHub's Actions variables:"
echo "  GCP_WIF_PROVIDER = projects/$PN/locations/global/workloadIdentityPools/github/providers/github"
echo "  GCP_DEPLOY_SA    = $DEPLOYER"
