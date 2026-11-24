#!/usr/bin/env bash
# The log-based metrics the Grafana dashboard reads per route
# (deploy/grafana/README.md), in the project `staunlabor`, as one script that
# can be run again: a metric that exists is updated to this definition. The
# project's owner runs it, by hand, after the backend that writes the lines is
# deployed; a metric counts only entries that arrive after it was made.
#
#   bash deploy/grafana/create-log-metrics.sh
#
# Six metrics, none holding anything about a visitor:
#   staunlabor_api_latency      the backend's line (request_log.py): time in the
#                               app, by route template, method and status
#   staunlabor_api_requests     the same lines counted, by route, status, cold and
#                               kept: Grafana's query builder cannot count the
#                               requests in a distribution, only its percentiles
#                               and mean, so the per-route counts need a counter
#   staunlabor_api_cpu          the same lines: CPU per request, by route
#   staunlabor_api_cold         the first request of each new backend process:
#                               its time in the app, by route
#   staunlabor_run_no_instance  Cloud Run's own refusals for want of an instance
#                               (429 at the cap, 500 on a spike), by status; read
#                               from its request log, of which only the status is
#                               taken: the address and browser in those entries
#                               never reach the metric
#   staunlabor_web_sources      page views (not files, not /api, not bots) by
#                               the site the visitor came from: only that
#                               site's name, taken from the Referer in Cloud
#                               Run's request log; the address, the browser and
#                               the rest of the referring URL never reach the
#                               metric (Marcel, 2026-11-24: where visitors come
#                               from, without an analytics tool)
#
# User-defined log-based metrics are chargeable Cloud Monitoring metrics: 80
# bytes a point for a distribution, 8 for a counter, one point a minute for
# each combination of labels that saw a request in that minute; the first 150
# MiB a month are free per billing account (README, "What it costs").
#
# A label's name and type cannot change once a metric exists: to change one,
# delete the metric (`gcloud logging metrics delete NAME --project=staunlabor`),
# which loses its data, and run this again.
set -euo pipefail

P=staunlabor
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The backend's line, and nothing else: its marker field, on the backend's
# revisions (request_log.EVENT).
APP='resource.type="cloud_run_revision" AND resource.labels.service_name="staunlabor-backend" AND jsonPayload.event="api_request"'

metric() { # name; the definition (YAML) on stdin
  cat > "$TMP/$1.yaml"
  if gcloud logging metrics describe "$1" --project=$P >/dev/null 2>&1; then
    gcloud logging metrics update "$1" --project=$P --config-from-file="$TMP/$1.yaml" >/dev/null
    echo "updated $1"
  else
    gcloud logging metrics create "$1" --project=$P --config-from-file="$TMP/$1.yaml" >/dev/null
    echo "created $1"
  fi
}

# Buckets: exponential, a factor of 1.5 each, so a percentile read from them is
# within about a quarter of the true one. Time from 1 ms up to 190 s (the
# backend's timeout is 60 s); CPU from 0.1 ms up to 19 s.

metric staunlabor_api_latency <<YAML
description: "Time in the app per /api request (ms), from the backend's own line: by route template, method and status. A 429 here is a per-address budget's refusal."
filter: '$APP'
valueExtractor: EXTRACT(jsonPayload.duration_ms)
labelExtractors:
  route: EXTRACT(jsonPayload.route)
  method: EXTRACT(jsonPayload.method)
  status: EXTRACT(jsonPayload.status)
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: ms
  labels:
    - key: route
      valueType: STRING
      description: "The route's template as FastAPI matched it, or 'unmatched'; never the path as sent."
    - key: method
      valueType: STRING
      description: "The HTTP method, or OTHER."
    - key: status
      valueType: STRING
      description: "The status the app answered."
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 30
    growthFactor: 1.5
    scale: 1
YAML

metric staunlabor_api_requests <<YAML
description: "/api requests, counted from the backend's own line: by route template, status, whether it was the process's first (cold) and whether its answer was kept (no calculation)."
filter: '$APP'
labelExtractors:
  route: EXTRACT(jsonPayload.route)
  status: EXTRACT(jsonPayload.status)
  cold: EXTRACT(jsonPayload.cold)
  cached: EXTRACT(jsonPayload.cached)
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  unit: "1"
  labels:
    - key: route
      valueType: STRING
      description: "The route's template as FastAPI matched it, or 'unmatched'; never the path as sent."
    - key: status
      valueType: STRING
      description: "The status the app answered; a 429 is a per-address budget's refusal."
    - key: cold
      valueType: STRING
      description: "true for the first request a new backend process answered."
    - key: cached
      valueType: STRING
      description: "true when the answer was a kept one (answer_cache.py): no calculation."
YAML

metric staunlabor_api_cpu <<YAML
description: "CPU per /api request (ms), from the backend's own line, by route template. Overlapping requests share the CPU of their overlap equally (request_log.CpuShares)."
filter: '$APP'
valueExtractor: EXTRACT(jsonPayload.cpu_ms)
labelExtractors:
  route: EXTRACT(jsonPayload.route)
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: ms
  labels:
    - key: route
      valueType: STRING
      description: "The route's template as FastAPI matched it, or 'unmatched'; never the path as sent."
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 30
    growthFactor: 1.5
    scale: 0.1
YAML

metric staunlabor_api_cold <<YAML
description: "Time in the app (ms) of the first request each new backend process answered, by route template."
filter: '$APP AND jsonPayload.cold=true'
valueExtractor: EXTRACT(jsonPayload.duration_ms)
labelExtractors:
  route: EXTRACT(jsonPayload.route)
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: ms
  labels:
    - key: route
      valueType: STRING
      description: "The route's template as FastAPI matched it, or 'unmatched'; never the path as sent."
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 30
    growthFactor: 1.5
    scale: 1
YAML

# Cloud Run writes these when no instance can take a request: "The request was
# aborted because there was no available instance" (its troubleshooting page:
# 429 at max instances, 500 when traffic grows faster than it can scale). They
# never reach a container, so Cloud Run's request_count leaves them out. The
# service is the entry's resource label, which every log-based metric carries.
metric staunlabor_run_no_instance <<YAML
description: "Requests Cloud Run refused because no instance could take them, by status (429 at the instance cap, 500 on a sudden spike)."
filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name=("staunlabor-backend" OR "staunlabor-web") AND textPayload:"no available instance"'
labelExtractors:
  status: EXTRACT(httpRequest.status)
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  unit: "1"
  labels:
    - key: status
      valueType: STRING
      description: "The status Cloud Run answered: 429 or 500."
YAML

# Page views by the site they came from (Marcel, 2026-11-24): how the site is
# found, e.g. after a LinkedIn post, without an analytics tool. Read from Cloud
# Run's request log of the web service, which the privacy policy names; only
# the referring site's host reaches the metric ("linkedin.com"), never its
# path, the address or the browser. A page view is a GET answered 200 for a
# path without a file extension, outside /api: the SPA's pages, not their files.
# Left out: the probes for WordPress (the SPA answers any path with 200) and
# agents that say they are bots, crawlers or link previews. An empty source is
# no Referer at all: typed in, a bookmark, or an app that sends none (the
# LinkedIn app often does not); an app's own scheme (android-app://) gives the
# app's name. Few distinct sources, so few series: a counter costs 8 bytes a
# point.
metric staunlabor_web_sources <<YAML
description: "Page views of the web service (no files, no /api, no bots), by the site the visitor came from: only that site's host from the Referer, nothing else of the request."
filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="staunlabor-web" AND httpRequest.requestMethod="GET" AND httpRequest.status=200 AND httpRequest.requestUrl=~"^https?://[^/]+/[^.?]*([?].*)?\$" AND NOT httpRequest.requestUrl:"/api/" AND NOT httpRequest.requestUrl:"/wp" AND NOT httpRequest.userAgent=~"(?i)(bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|go-http|headless|monitor)"'
labelExtractors:
  source: REGEXP_EXTRACT(httpRequest.referer, "^[a-z-]+://(?:www[.])?([^/:?#]+)")
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  unit: "1"
  labels:
    - key: source
      valueType: STRING
      description: "The referring site's host without www, e.g. linkedin.com; empty when the browser sent no Referer."
YAML

echo
echo "Done. The metrics fill from now on; the dashboard's per-route panels stay empty until the first requests."
