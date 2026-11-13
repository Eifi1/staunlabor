# Deploying Staunlabor to Cloud Run (project `staunlabor`)

Two Cloud Run services behind one custom domain, **staunlabor.app**.
`staunlabor-web` (Caddy and the built site) serves the frontend and proxies
`/api/*` to `staunlabor-backend` (FastAPI), so the browser sees one origin and
CORS has nothing to allow. There is no database, no job and no schedule, and
one secret, the edge token (§4); both services scale to zero, so the site costs
nothing while nobody looks at it.

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
  * `staunlabor-run`, which both services run as: **one grant**, reading the
    secret `staunlabor-edge-token`, and nothing else of GCP. Without it a
    service runs as the Compute default account.
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
* **The edge token**, the one secret: `staunlabor-edge-token`, 32 random bytes
  made by the script and never printed, readable by `staunlabor-run` alone.
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
