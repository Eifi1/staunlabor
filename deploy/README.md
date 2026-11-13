# Deploying Staunlabor to Cloud Run (project `staunlabor`)

Two Cloud Run services behind one custom domain, **staunlabor.app**.
`staunlabor-web` (Caddy and the built site) serves the frontend and proxies
`/api/*` to `staunlabor-backend` (FastAPI), so the browser sees one origin and
CORS has nothing to allow. There is no database, no secret, no job and no
schedule; both services scale to zero, so the site costs nothing while nobody
looks at it.

```
        https://staunlabor.app   (Cloud Run domain mapping, TLS by Cloud Run;
                │                 DNS at Cloudflare, records DNS-only)
        staunlabor-web  (Caddy + site)        public, 256 MB, 0–3
          ├─ /api/* → staunlabor-backend       (TLS reverse proxy, same origin)
          └─ /*     → the site (try_files → index.html)
                │
        staunlabor-backend (FastAPI)           public run.app, 512 MB, 0–3
```

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
  * `staunlabor-run`, which both services run as: **no roles at all**. Neither
    service needs anything of GCP. Without it a service runs as the Compute
    default account.
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

## 5. Mail into the domain (Cloudflare Email Routing)

The imprint names `kontakt@staunlabor.app`. Cloudflare → Email Routing: onboard
`staunlabor.app` (it writes three MX records, an SPF TXT and a DKIM TXT), and
forward `kontakt@` to the operator's inbox; no catch-all. The site sends no
mail, so there is nothing else.

## Files here

| File | What it is |
| --- | --- |
| `cloudbuild.yaml` | The pipeline: two images, the backend, the web service |
| `Dockerfile.backend` | Python 3.14 with the locked environment, uvicorn on :8080, not root |
| `Dockerfile.web` | The site built with Node, then served by Caddy |
| `Caddyfile` | The site, `/api` proxied, caching and the headers |
| `setup-gcp.sh` | §1, the one-time setup |
