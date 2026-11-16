# Deploying Staunlabor to Cloud Run (project `staunlabor`)

Two Cloud Run services behind one custom domain, **staunlabor.app**.
`staunlabor-web` (Caddy and the built site) serves the frontend and proxies
`/api/*` to `staunlabor-backend` (FastAPI), so the browser sees one origin and
CORS has nothing to allow. The account layer keeps its rows in the database
`staunlabor` on keksdose's shared Cloud SQL instance, its feedback files in a
bucket, and runs one job a deploy (the migrations) and one call a day (§6);
both services scale to zero, so the site costs nothing while nobody looks at
it.

```
        https://staunlabor.app   (Cloud Run domain mapping, TLS by Cloud Run;
                │                 DNS at Cloudflare, records DNS-only)
        staunlabor-web  (Caddy + site)        public, 256 MB, 0–3
          ├─ /api/* → staunlabor-backend       (TLS reverse proxy, same origin,
          │                                     out through the VPC)
          └─ /*     → the site (try_files → index.html)
                │   Direct VPC egress, all traffic → default network,
                │   europe-west4 subnet with Private Google Access
        staunlabor-backend (FastAPI)           ingress internal, 512 MB, 0–3
          ├─ database staunlabor on keksdose-db (Cloud SQL, shared; §6)
          └─ bucket staunlabor-feedback-files   (feedback's files; §6)
```

The backend's run.app URL answers only what arrives through the project's
VPC; anybody else gets a 404 from Cloud Run. With the edge token Caddy sets,
that is what keeps the request budget honest (§4).

Region **europe-west4** (the Netherlands) throughout, as the privacy policy
says.

## 1. One-time setup

The project exists (`staunlabor`, billing linked; Run, Cloud Build, Artifact
Registry, IAM, IAM Credentials, STS, Logging and Monitoring enabled). The rest
is one script, safe to run again:

```bash
bash deploy/setup-gcp.sh            # the alert mails go to the project's owner, or name an address
```

* **The image repository** `staunlabor` and **the build's source bucket**
  `gs://staunlabor_cloudbuild`, both in europe-west4; the bucket forgets a
  source after 30 days.
* **Three accounts**, each with only what it does:
  * `staunlabor-build`, the account `cloudbuild.yaml` runs as: deploys Cloud
    Run (`run.admin`) as `staunlabor-run` (`serviceAccountUser` on it alone),
    pushes images (`artifactregistry.writer` on the repository), writes its log,
    reads its source (`objectViewer` on the source bucket).
  * `staunlabor-run`, which both services ran as until §6: **one grant**,
    reading the secret `staunlabor-edge-token`, and nothing else of GCP.
    Without it a service runs as the Compute default account. Since §6 it is
    the backend's and the migrate job's alone, with the database's secrets, the
    instance and the bucket; the web service runs as `staunlabor-web`.
  * `github-deployer`, which GitHub signs in as: starts a build
    (`cloudbuild.builds.editor`, `serviceUsageConsumer`) as `staunlabor-build`
    (`serviceAccountUser` on it alone) and uploads its source (`storage.admin`;
    the project holds no bucket with anything in it but sources. Should one
    ever hold data, condition it out as Kurvenschmiede does).
* **The Compute default account** loses `roles/editor`, if the project gave it.
* **GitHub's sign-in, without a key** (Workload Identity Federation): the pool
  `github` and its OIDC provider `github`, whose condition admits only runs of
  `Eifi1/staunlabor` on `refs/heads/main`.
* **Three alert mails** (Cloud Monitoring, one email channel, log-matched): a
  Cloud Run service changed by anyone but the build, a key created for a
  service account (no account here uses keys), and a change to the project's
  access. They prevent nothing; they make misuse visible.
* **The site's private way to the backend:** the Compute API, which makes the
  `default` network, and Private Google Access on its europe-west4 subnet.
  The web service leaves through it (`--vpc-egress=all-traffic`), so its
  requests to the backend count as internal. The network holds no machine and
  costs nothing.
* **The edge token**: `staunlabor-edge-token`, 32 random bytes made by the
  script and never printed, readable by `staunlabor-run` and, since §6, by
  `staunlabor-web`, the web service's own account.
  Caddy sends it to the backend, which trusts its proxies only with it (§4). To
  change it, add a version (`gcloud secrets versions add`) and deploy: both
  services read `latest` at start.

Then, on GitHub (Eifi1/staunlabor → Settings):

* **Secrets and variables → Actions → Variables**: `GCP_WIF_PROVIDER` and
  `GCP_DEPLOY_SA`, as the script prints them at the end.
* **Environments → `production`**: Marcel as the required reviewer, so a
  deploy waits for his click; on a public repository GitHub has it on the free
  plan.

## 2. Deploy

Actions → **Deploy** → Run workflow (a commit, tag or branch; blank is main),
or from a checkout, as the project's owner:

```bash
gcloud builds submit --project=staunlabor --config deploy/cloudbuild.yaml \
  --substitutions=_TAG="$(git rev-parse --short HEAD)" .
```

Images are tagged by commit, never by version: `release.yml` owns versions and
tags, this owns shipping.

## 3. Domain

Once, after the first deploy:

1. **Verify the domain** for the account that maps it:
   `gcloud domains verify staunlabor.app` opens Search Console, which asks for a
   TXT record at Cloudflare. `gcloud domains list-user-verified` says when it
   took.
2. **Map it** to the web service:

   ```bash
   gcloud beta run domain-mappings create --project=staunlabor \
     --service=staunlabor-web --domain=staunlabor.app --region=europe-west4
   ```
3. **The records at Cloudflare**: the four **A** and four **AAAA** records the
   mapping prints for the apex, as **DNS only (grey cloud)**. Cloud Run issues
   the certificate, and a proxied record would stop it from validating; the
   privacy policy also says web traffic does not pass through Cloudflare.
   `.app` is HSTS-preloaded, so nothing works over plain HTTP even while the
   certificate is pending (a few minutes to an hour).

## 4. Verify

```bash
curl -s https://staunlabor.app/api/v1/health      # {"status":"ok","version":"…"}
```

**The caller's address.** The request budget (90 computations per ten seconds per
address, `staunlabor/security.py`) reads the caller's address
`STAUNLABOR_TRUSTED_PROXY_HOPS` entries from the right of `X-Forwarded-For`
(`cloudbuild.yaml`: 3), never the left-most entry, which the client writes.
Three proxies append to it: the web service's Cloud Run front end (the
caller), Caddy (its peer, Cloud Run's internal `169.254.x.x` hop, kept because
the Caddyfile trusts it) and the backend's front end (the web service's
egress). If one reader's budget runs out for everyone, the count is one off.

The count is only true of that path. While the backend's run.app URL was
public, a direct request got one entry appended, not three, and the third from
the right was the caller's own to write: with a fresh fake per request, 150
parallel requests were all answered (2026-11-13). Two things close it, each on
its own:

* **The edge token** (server-kit's `vouched_hops`, the rule every sibling app
  shares): Caddy sets `X-Staunlabor-Edge` to the secret `staunlabor-edge-token`
  (`setup-gcp.sh` §8), and only a request carrying it counts three proxies; any
  other is counted from the one entry its own front end appended, the caller.
  Without the secret configured every request shares one budget, which limits
  too much, never too little.
* **The internal ingress**: the backend answers nothing that did not come
  through the project's VPC.

After every change to the network, the proxies or the secret,
run these three (150 parallel requests each, `xargs -P 25`):

| Request | Expected |
| --- | --- |
| straight to the backend's run.app URL | every one a 404 |
| through the site, a fresh fake `X-Forwarded-For` each | 90 answered, the rest 429 |
| through the site, no header | 90 answered, the rest 429 |

```bash
B=$(gcloud run services describe staunlabor-backend --project=staunlabor \
  --region=europe-west4 --format='value(status.url)')
for url in "$B" https://staunlabor.app; do
  seq 1 150 | xargs -P 25 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
    -H 'X-Forwarded-For: 203.0.113.{}, 198.51.100.1' "$url/api/v1/experiments/chair" | sort | uniq -c
  sleep 11   # the budget's ten-second window
done
```

Measured on 2026-11-13, after the change: 150 × 404 direct, 90 × 200 and
60 × 429 through the site, with and without the header. Direct VPC egress did
not change the hop count.

## 5. Mail into the domain (Cloudflare Email Routing)

The imprint names `kontakt@staunlabor.app`. Cloudflare → Email Routing: onboard
`staunlabor.app` (it writes three MX records, an SPF TXT and a DKIM TXT), and
forward `kontakt@` to the operator's inbox; no catch-all. What the site sends
goes through Resend from its own subdomains (§6), which leave the root's SPF to
Email Routing.

## 6. The account layer

The backend mounts server-kit's account routes, feedback and the translation
review on a database of its own, `staunlabor` on keksdose's shared instance
`keksdose:europe-west4:keksdose-db` (PostgreSQL 16), as Kurvenschmiede's and
Kastlan's are. It **refuses to start on Cloud Run** (`main.check_deployment`)
without the signing key, the allow-list, the jobs token, the second factor's
keys and the feedback bucket; Cloud Run then keeps serving the revision before.

**Once, before the first deploy of the account routes, in this order:**

1. **Marcel: the second factor's key**, which seals every account's
   authenticator secret (AES-256-GCM, each value bound to its row):

   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32), end='')" \
     | gcloud secrets create staunlabor-totp-keys --project=staunlabor \
         --replication-policy=user-managed --locations=europe-west4 --data-file=-
   ```

   Keep it like the database: a lost key leaves every account with two-factor
   sign-in on unable to sign in by code (a passkey still works, and the person
   can switch it off by the password alone). To rotate, put a new key in
   front, separated by a comma (`new,old`): the newest seals, every one opens.
   Nothing re-seals by itself, so the old key stays while any account set up
   under it still has the second factor on.
2. **`bash deploy/setup-accounts.sh`**, safe to run again. It turns on the Cloud
   SQL Admin and Cloud Scheduler APIs and makes:
   * **the web service's own account** `staunlabor-web`, which reads the edge
     token and nothing else; `staunlabor-run` is the backend's and the migrate
     job's alone from now on;
   * **the secrets**, from random bytes, never printed: `staunlabor-db-url-app`
     and `staunlabor-db-url-owner`
     (`postgresql+asyncpg://<role>:<password>@/staunlabor?host=/cloudsql/keksdose:europe-west4:keksdose-db`),
     `staunlabor-jwt-secret` and `staunlabor-jobs-token`, each readable by
     `staunlabor-run` alone, as are `staunlabor-totp-keys` and, once it exists,
     `staunlabor-resend-api-key`;
   * **`roles/cloudsql.client` in the project `keksdose`** for `staunlabor-run`
     (the backend and the job connect as it) and `staunlabor-build`;
   * **the bucket** `staunlabor-feedback-files` (europe-west4, private, uniform
     access, seven days' soft delete): on Cloud Run a directory goes with the
     instance, and a report's screenshot with it. `staunlabor-run` has
     `roles/storage.objectUser` on it alone; the editor and viewer bindings a
     new bucket gets are removed, and `github-deployer`'s `storage.admin`, which
     the build's source upload needs, carries a condition that leaves this
     bucket out (Kurvenschmiede's "The uploads bucket"). Whoever decides what
     code runs as the app still reads what the app reads: the protection is who
     may change the code and run the deploy;
   * **the daily call**: the Cloud Scheduler job `staunlabor-accounts-daily`,
     03:30 Europe/Zurich, `POST https://staunlabor.app/api/v1/ops/accounts/daily`
     with `X-Jobs-Token` from `staunlabor-jobs-token`, through the site, so it
     needs no way past the backend's internal ingress. Server-kit's
     `account_jobs_router` erases the accounts whose deletion was asked 30 days
     ago (their feedback anonymised, their files removed), deletes ended
     sessions, expired links, invitations never taken up and spent passkey
     challenges once they are 30 days done with, and sweeps the uploads no
     report named for a day (`accounts.jobs_deps`). The privacy policy promises
     the erasure on its day, so the job runs from the first deploy of the
     account routes. A changed token needs the job deleted and the script run
     again. Made before the first deploy of the account routes, it is paused
     (`gcloud scheduler jobs pause`) until that deploy, so that it calls no
     route the live site does not have yet; the verification below resumes it.
3. **Marcel: `bash deploy/apply-roles.sh`**, which runs `deploy/roles.sql` as the
   instance's `postgres` user (it asks for the password, nothing else) through a
   local `cloud-sql-proxy`: the database, an owner role `staunlabor_owner` (owns
   the schema, runs the migrations; `CONNECTION LIMIT 2`) and the app role
   `staunlabor_app` (`SELECT, INSERT, UPDATE, DELETE` and the sequences, the
   same by default privileges for what the owner makes later;
   `CONNECTION LIMIT 12`: the pool draws 1 + 1 at three instances, six, and a
   rollout runs the old revision beside the new one, so the cap is twice
   that; a cap, not a reservation). Only these two
   may connect to `staunlabor`. Nothing else on the instance is touched. Safe
   to run again: it sets the passwords to the secrets' again.
4. **Marcel: `bash deploy/bootstrap-admin.sh`**, the first admin before the
   site opens. The account layer makes the first account to register the admin
   if its address is on the allow-list, and nothing proves the address is the
   registrant's (signing in needs no verified one); the list is no secret
   (`cloudbuild.yaml`, the imprint). So the script builds the schema as the
   owner (`alembic upgrade head`, which the deploy's job then finds done) and
   makes the operator's account as the admin, as the app's role
   (`python -m staunlabor.bootstrap`): it asks for the address, the name and
   the password (twice, not echoed), with the registration form's rules and
   the deployment's twelve bcrypt rounds. With one account in the database the
   first-admin path is closed for good, and everybody after comes by
   invitation. It changes nothing once any account exists. The address stays
   unconfirmed until the settings' mail confirms it.

**Every deploy** (`cloudbuild.yaml`) then builds the images, upserts and runs
the job `staunlabor-migrate` (`alembic upgrade head` as the owner;
`Dockerfile.backend` copies `alembic.ini` and `alembic/`), and only when it
succeeded deploys the backend with the instance, the secrets and:

| Variable | From |
| --- | --- |
| `STAUNLABOR_DATABASE_URL` | `staunlabor-db-url-app` |
| `STAUNLABOR_JWT_SECRET` | `staunlabor-jwt-secret` |
| `STAUNLABOR_JOBS_TOKEN` | `staunlabor-jobs-token` |
| `STAUNLABOR_TOTP_KEYS` | `staunlabor-totp-keys` |
| `STAUNLABOR_RESEND_API_KEY` | `staunlabor-resend-api-key`, with `_MAIL_BACKEND=resend` only |
| `STAUNLABOR_REGISTRATION_ALLOWLIST` | `_REGISTRATION_ALLOWLIST`: who may claim the empty database as its admin |
| `STAUNLABOR_WEBAUTHN_RP_ID` | `staunlabor.app` |
| `STAUNLABOR_MAIL_BACKEND` | `_MAIL_BACKEND` |
| `STAUNLABOR_FEEDBACK_BUCKET` | `_FEEDBACK_BUCKET` |

**Mail through Resend** (`_MAIL_BACKEND: resend`), in the Resend account the
sibling apps send from: `staunlabor.app` in region **Ireland (eu-west-1)**, as
the privacy policy says, its records at Cloudflare DNS-only beside §5's routing
records (CNAME `send` → `send.forge.rmta.net`, CNAME `rsend` →
`rsend-euw1.forge.rmta.net`, the DKIM TXT under `resend._domainkey`; checked
2026-11-16). Click and open tracking stay off: they would route the one-time
links through a redirect. The key, "Sending access" for this domain only, is
`staunlabor-resend-api-key`, stored without reaching the shell history
(`read -rs KEY && printf '%s' "$KEY" | gcloud secrets create staunlabor-resend-api-key --project=staunlabor --replication-policy=user-managed --locations=europe-west4 --data-file=-; unset KEY`),
then the script again, which grants it to `staunlabor-run`. It must exist
before a deploy that mounts it. Replies go to `kontakt@staunlabor.app` (§5),
not the kit's `support@`. Should Resend ever be dropped, `_MAIL_BACKEND:
console` sends nothing and logs each account mail's kind alone, never its link
or address; an admin's answer then shows an invitation's or a reset's link
once, and a person's own reset request reaches nobody. Signing in needs no
verified address, so the first admin gets in either way.

**The first admin** is made before the first deploy (step 4); after it, sign in
at `https://staunlabor.app/login`. The allow-list (`_REGISTRATION_ALLOWLIST`)
then grants nothing, but the backend still refuses to start without one.

**Verify** after the deploy, besides §4:

```bash
gcloud run jobs executions list --job=staunlabor-migrate --project=staunlabor --region=europe-west4 --limit=1
gcloud scheduler jobs resume staunlabor-accounts-daily --project=staunlabor --location=europe-west4   # the first time
gcloud scheduler jobs run staunlabor-accounts-daily --project=staunlabor --location=europe-west4
gcloud logging read 'resource.labels.service_name="staunlabor-backend" AND textPayload:"ops/accounts/daily"' \
  --project=staunlabor --limit=3 --freshness=10m       # one 200
```

## Files here

| File | What it is |
| --- | --- |
| `cloudbuild.yaml` | The pipeline: two images, the migrations, the backend, the web service |
| `Dockerfile.backend` | Python 3.14 with the locked environment and the migrations, uvicorn on :8080, not root |
| `Dockerfile.web` | The site built with Node, then served by Caddy |
| `Caddyfile` | The site, `/api` proxied, caching and the headers |
| `setup-gcp.sh` | §1, the one-time setup |
| `setup-accounts.sh` | §6, what the account layer needs of GCP |
| `apply-roles.sh`, `roles.sql` | §6, the database and its two roles on the shared instance |
| `bootstrap-admin.sh` | §6, the schema and the first admin, before the site opens |
