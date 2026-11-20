# Watching the load in Grafana Cloud

When a post brings visitors, this dashboard says where the site gives way: the
backend's one core, cold starts, the per-address budget, the instance cap, the
static files or the database. It runs in Keksdose's Grafana Cloud stack (the
free plan, shared by both sites) and reads Google Cloud Monitoring live;
Grafana stores none of it.

| File | What it is |
| --- | --- |
| `staunlabor-dashboard.json` | The dashboard: one row per bottleneck, 30 panels, all queries in PromQL |
| `create-log-metrics.sh` | The four log-based metrics the per-route panels read; the owner runs it |
| `../../backend/staunlabor/request_log.py` | The backend's one line per `/api` request they are made from |

Every command below is the project owner's to run. Nothing here is run by CI,
by the deploy or by an agent.

## What reaches Grafana, and what never does

Cloud Run counts and times requests **per service**, never per route
(`request_count` has a `route` label that is "always empty"), so it cannot say
whose calculation holds the backend's core. The backend therefore writes one
JSON line per `/api` request to standard output, which Cloud Run's logging
agent parses into `jsonPayload` (`severity` becomes the entry's severity):

```json
{"severity":"INFO","message":"POST /api/v1/experiments/elephant 200 149 ms","event":"api_request","route":"/api/v1/experiments/elephant","method":"POST","status":200,"duration_ms":149.3,"cpu_ms":147.0,"cold":false,"budget_refused":false}
```

| Field | Holds |
| --- | --- |
| `route` | The route's **template** as FastAPI matched it (`/api/v1/admin/experiments/checks/{exhibit}`), or `unmatched`; never the path as sent, never the query |
| `method`, `status` | The method (`OTHER` for one no route has) and the status the client got (500 when the app raised) |
| `duration_ms` | From the request entering the app to the last byte handed to the server |
| `cpu_ms` | Process CPU while the request was in flight, **shared equally among the requests in flight at the same time**: exact for a request that ran alone, and the shares add up to what the process used. `thread_time` would miss the engine, which FastAPI runs in worker threads (a 175 ms cannon call showed 1.3 ms) |
| `cold` | The first request this process answered |
| `budget_refused` | A 429 from the app itself: only the per-address budgets answer one (`security.py`, the kit's windows on the account routes); Cloud Run's own 429 never reaches the container |
| `event` | `api_request`, the marker the log metrics select by |

No address, user agent, referrer, query, body, cookie or identifier is read or
written; `backend/tests/unit/test_request_log.py` sends all of them and asserts
the line holds none.

The Grafana account gets **`roles/monitoring.viewer` and nothing else**:
metric values, never log entries. Do not give it `roles/logging.viewer`: Cloud
Run's request log holds every visitor's IP address and browser, which would
make Grafana Labs a processor of personal data that the privacy policy does not
name. The log-based metrics are read in Google's project, and what leaves it is
counts and durations by route, method and status.

## Set-up, in order

### 1. Deploy the backend that writes the line

The usual deploy (`../README.md` §2). Then check that the lines arrive:

```bash
gcloud logging read 'resource.labels.service_name="staunlabor-backend" AND jsonPayload.event="api_request"' \
  --project=staunlabor --limit=3 --freshness=10m --format='value(jsonPayload.message)'
```

### 2. The log-based metrics

```bash
bash deploy/grafana/create-log-metrics.sh
```

Safe to run again (it updates what exists). A log-based metric counts only
entries that arrive after it was made, so make them before the post, not
during it.

| Metric (`logging.googleapis.com/user/…`) | Kind | From | Labels |
| --- | --- | --- | --- |
| `staunlabor_api_latency` | distribution, ms | the backend's line: `duration_ms` | `route`, `method`, `status` |
| `staunlabor_api_cpu` | distribution, ms | the backend's line: `cpu_ms` | `route` |
| `staunlabor_api_cold` | distribution, ms | the backend's line with `cold=true`: `duration_ms` | `route` |
| `staunlabor_run_no_instance` | counter | Cloud Run's entries with "no available instance" | `status` |

Each also carries the entry's resource labels (`service_name`,
`revision_name`, …) and the `log` label every log-based metric gets.

### 3. The stack: Keksdose's

Both sites share one Grafana Cloud stack, the one Keksdose runs on the free
plan (`https://sinceresorbet1955.grafana.net`, region `prod-eu-central-0`;
Keksdose's `docs/observability.md` §0). Marcel chose it on 2026-11-20
("Keksdose kann genutzt werden"). The stack's 10,000 free series hold
Keksdose's own app metrics, which it pushes over OTLP. This dashboard adds
none: its data source reads Cloud Monitoring at query time and stores nothing.
**Do not add the "GCP" integration or any Alloy agent** to the stack. Those
copy metrics into Grafana Cloud's own store, where they count against
Keksdose's series.

### 4. Read access for Keksdose's reader

The stack already has a Google Cloud Monitoring data source, uid
`keksdose-gcp`. It signs in as `grafana-monitoring@keksdose.iam.gserviceaccount.com`
with a key Keksdose made in 2026-07, and that account holds
`roles/monitoring.viewer` in keksdose. One binding lets the same account read
this project's metrics too. So this project makes no key of its own, and
row 6's database panels, which read keksdose's Cloud SQL, need no grant in
keksdose:

```bash
gcloud projects add-iam-policy-binding staunlabor \
  --member=serviceAccount:grafana-monitoring@keksdose.iam.gserviceaccount.com \
  --role=roles/monitoring.viewer --condition=None
```

Marcel ran it on 2026-11-20. `setup-gcp.sh`'s "access changed" mail follows,
as expected. What the binding means:

* **What the account can read.** It reads every metric of both projects and
  nothing else: request rates, latencies and instance counts. It reads no log
  entry, nothing personal, and can change nothing. Whoever stole Keksdose's key
  would see this site's load too.
* **The key is Keksdose's to rotate**, in the data source's secure settings.
  This dashboard follows without a step of its own.
* **To withdraw the access**, run the same command with
  `remove-iam-policy-binding`.
* **If Keksdose ever deletes the account or moves stacks**, this dashboard
  needs a reader of its own. `grafana-reader@staunlabor.iam.gserviceaccount.com`
  was made for that on 2026-11-20, before Keksdose's stack was chosen. It holds
  `roles/monitoring.viewer` here and has no key, and the way above does not use
  it. If it is needed again:
  * make a key for it into a file only you can read,
    `(umask 077 && gcloud iam service-accounts keys create grafana-reader.json --iam-account=grafana-reader@staunlabor.iam.gserviceaccount.com --project=staunlabor)`;
  * upload the key as a new data source (Google JWT File, default project
    `staunlabor`), then delete the file;
  * give the account `roles/monitoring.viewer` in keksdose for row 6.

  If it is not needed, remove it with
  `gcloud iam service-accounts delete grafana-reader@staunlabor.iam.gserviceaccount.com --project=staunlabor`.

**Why a key and not Workload Identity Federation.** Grafana Cloud offers
federation for this data source, but only through the stack's own sign-in. The
stack's SSO would have to go through an OIDC provider that a workload identity
pool in GCP trusts. That means an OAuth client, the stack's SSO settings and a
pool and provider to keep, for one read-only data source. Its credentials also
live in the signed-in person's session, so Grafana alerting, scheduled reports
and public dashboards do not work with it (Grafana's "Google authentication"
docs). The key can only read metrics: whoever stole it would see request rates
and latencies, nothing personal and nothing they could change. Grafana keeps
it encrypted in the data source's secure settings.

### 5. The dashboard

1. Make a folder **Staunlabor** (**Dashboards → New → New folder**).
2. Import the dashboard into it (**Dashboards → New → Import → Upload
   dashboard JSON file**): `deploy/grafana/staunlabor-dashboard.json`.
3. At the top, pick in **Cloud Monitoring** the Google Cloud Monitoring data
   source with uid `keksdose-gcp`.
4. Leave **Project** at `staunlabor` and **Cloud SQL project** at `keksdose`.

The panels refer to the data source only through that variable, so the import
asks nothing and works with any name.

Keksdose's dashboards are in its folder **Keksdose**. Its import script
(`scripts/grafana-import.py`) writes only there and only its own uids. This
dashboard's uid is `staunlabor-load`, so neither overwrites the other.

### 6. Check it before a post

`../README.md` §4's check sends 250 parallel questions through the site and
ends in about 70 refusals: within about three minutes they appear in row 3 as
`/api/v1/experiments/sphere` refused by the budget, and the backend's instances,
CPU and latency move in rows 1 and 2. Cloud Monitoring shows a minute's data
up to two minutes later (Cloud SQL's up to 165 s), so the dashboard always
trails by that much.

## Which is it?

Read the rows top to bottom; each answers one question.

| Row | It is this when … | Panels | Levers (each a decision of its own) |
| --- | --- | --- | --- |
| 1. **CPU**: one calculation at a time (1 vCPU, one worker, at most 8 instances; kept answers cost none, `answer_cache`) | backend CPU near 100 % and *p95 time in the app* far above *CPU per call*; *requests in flight* above 1 | CPU utilization; latency; requests in flight; **CPU used by route** (stacked, in cores) says whose calculation it is | dearer routes made cheaper; more instances. A second vCPU does little for one worker: the engine is pure Python and holds the GIL |
| 2. **Cold starts** (one backend instance always on since 2026-11-20) | new instances, startup latency and *waiting before an instance takes the request* rise together | instances by state; startup latency; pending latency (both beta metrics); **cold requests by route** and their time | `--min-instances=1` (an instance always on) |
| 3. **The budget** (180 calculations per 10 s per address, per instance; kept answers are free) | refusals rise while CPU is fine | refused by the budget, by route; the refused share | the budget in `security.py`. The line names no address, so this cannot tell one busy visitor from many behind one office or proxy; refusals that come with a post's spike point to the latter |
| 4. **The instance cap** (8 for the backend, 10 for the web) | instances sit at the cap, Cloud Run *recommends* more, *refused for want of an instance* appears | instances against the cap; recommended instances by driver; Cloud Run's own 429 (at the cap) and 500 (a spike faster than scaling) | `--max-instances` |
| 5. **Static files** (Caddy, no CDN) | the web service's CPU or latency rises while the backend is quiet | web CPU; web latency (includes the proxied `/api`, compare row 1); bytes sent; files against `/api`; response classes | more web instances; a CDN. Not Cloudflare's proxy: the privacy policy says web traffic does not pass through Cloudflare |
| 6. **The database** (`/experiments/checks`, pool 1 + 1, shared Cloud SQL) | `/experiments/checks` slows while CPU is fine; connection latency or refusals rise | its time in the app (it reads the table once a minute per instance, `LIST_TTL_S`); Cloud Run's connection latency and counts; connections to `staunlabor` by state and the shared instance's CPU (these two need the keksdose grant) | a longer `LIST_TTL_S`; the pool |

The **At a glance** row on top has requests per second for each service, both
p95 latencies, and every 429 and 5xx per minute, including Cloud Run's own
refusals, which never reach a container and so are missing from Cloud Run's
`request_count`.

*CPU per call* is a fair share: when requests overlap, cheap ones are charged
part of the dear ones' CPU (four overlapping calls: a `chair` that costs 8 ms
alone showed 53 ms). For a route's true cost, read the bar gauge over a quiet
hour.

## What it costs

From Google's pricing page (Google Cloud Observability, read 2026-11-20) and
Grafana's (grafana.com/pricing, the same day).

| Item | Price | Here |
| --- | --- | --- |
| Grafana Cloud Free | 10k active metric series, 50 GB logs and 50 GB traces a month, 14 days' retention, 3 active users | this dashboard ingests nothing into Grafana Cloud, so it uses none of it (the series are Keksdose's pushed app metrics); the data source is one of Grafana's own |
| Cloud Run's and Cloud SQL's metrics | non-chargeable Google Cloud metrics | free |
| The backend's lines in Cloud Logging | $0.50/GiB beyond the first **50 GiB per project a month**, 30 days' storage included; the `_Default` bucket keeps 30 days | a line is about 250 bytes: a million requests are a quarter of a GiB. Free |
| The four log-based metrics | chargeable custom metrics: **$0.2580/MiB** beyond the first **150 MiB per billing account a month**; a distribution point counts **80 bytes**, a counter point **8**; one point a minute per label combination that saw a request in that minute | a post's day, 4 hours with 30 busy combinations on two distributions: 2 × 30 × 240 × 80 B ≈ 1.1 MiB. A combination busy every minute of a month is 3.3 MiB (≈ $0.85 once past the free 150): twenty on two distributions, around the clock, ≈ 132 MiB, still free |
| Reading the metrics (Monitoring API) | **$0.50 per million time series returned** beyond the first **million per billing account a month** (since 2025-10-02); console reads are free | one refresh returns about 100–300 series, depending on how many routes saw requests: at the 1-minute refresh about 15,000 an hour, so some 66 free hours a month. Left open around the clock, about $5 a month. Grafana queries only while a browser shows the dashboard: it has no alert rules, and Keksdose's alert rules read only its own pushed metrics |
| The binding, Keksdose's reader and its key, the Resource Manager API | free | |

The two free allotments are per **billing account**, and staunlabor and keksdose
bill to the same one (checked 2026-11-20). So their chargeable metrics share
them, and so do this dashboard's reads and those of Keksdose's
`keksdose-platform-gcp` dashboard. Google's
metric `time_series_billed_for_queries_count` (pricing page) shows the reads
billed.

## What was checked, and what was not

* **Metric types**, against Google's metric lists
  (`docs.cloud.google.com/monitoring/api/metrics_gcp_p_z` and `…_c`,
  2026-11-20), with their resource types and labels:
  `run.googleapis.com/` `request_count`, `request_latencies`,
  `request_latency/pending` (beta), `container/cpu/utilizations`,
  `container/instance_count` (`state`), `container/max_request_concurrencies`
  (`state`), `container/startup_latencies` (beta),
  `container/network/sent_bytes_count` (`kind`),
  `scaling/recommended_instances` (`scaling_driver`),
  `infrastructure/cloudsql/connection_latencies`, `…/connection_request_count`,
  `…/connection_refused_count`; `cloudsql.googleapis.com/`
  `database/postgresql/num_backends_by_state` (`database`, `state`),
  `database/cpu/utilization`.
* **PromQL names** follow Google's rule (the first `/` becomes `:`, every other
  `/` and `.` becomes `_`; a distribution adds `_bucket`, `_count`, `_sum`);
  the rule is from Google's PromQL docs, the names were derived, not listed.
  `logging_googleapis_com:user_<name>` for the log-based metrics is that rule
  applied; Google gives no example of it.
* **The queries were never run** against the project: no read access to its
  metrics from where they were written. A panel that stays empty after step 6
  most likely has a label or name wrong; Grafana's query inspector shows
  Google's error.
* **Cloud Run's refusals**: the message and the statuses (429 at the cap, 500
  on a spike) are from Cloud Run's troubleshooting page; that the entry carries
  them in `textPayload` and `httpRequest.status` was not seen in a live entry.
  When one comes, check it with
  `gcloud logging read 'textPayload:"no available instance"' --project=staunlabor --limit=1`.
* **Grafana's side**: the query model (`queryType: promQL`, `promQLQuery
  {projectName, expr, step}`) and the plugin id `stackdriver` are from the
  data source's source (`grafana/grafana-cloudmonitoring-datasource`); the
  key, roles and APIs from Grafana's configuration docs.

## The privacy policy

The line holds nothing about a visitor, and Grafana receives counts and
durations, so the policy's sentences stay true: the hosting provider still logs
each request with the address and browser (Cloud Run's request log, as before),
the server still keeps the address in memory only, the request logs still go
after 30 days (the `_Default` bucket's retention; the metrics are aggregates,
not logs), and no tracking or analytics tool watches a visitor. Should the
policy one day say so, a sentence such as "the server counts requests and
measures their duration per route, without any detail about you" would cover
it; nothing requires it.

Unchanged by this: uvicorn's own access log already writes a line per request
with the path and query, from Cloud Run's internal address, never the
visitor's (it trusts forwarded headers from the loopback only). With the new line
it says nothing the dashboards need; `--no-access-log` in
`Dockerfile.backend` would halve the backend's log volume.
