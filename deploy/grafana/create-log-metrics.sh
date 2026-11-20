#!/usr/bin/env bash
# The log-based metrics the Grafana dashboard reads per route
# (deploy/grafana/README.md), in the project `staunlabor`, as one script that
# can be run again: a metric that exists is updated to this definition. The
# project's owner runs it, by hand, after the backend that writes the lines is
# deployed; a metric counts only entries that arrive after it was made.
#
#   bash deploy/grafana/create-log-metrics.sh
#
# Four metrics, none holding anything about a visitor:
#   staunlabor_api_latency      the backend's line (request_log.py): time in the
#                               app, by route template, method and status
#   staunlabor_api_cpu          the same lines: CPU per request, by route
#   staunlabor_api_cold         the first request of each new backend process:
#                               its time in the app, by route
#   staunlabor_run_no_instance  Cloud Run's own refusals for want of an instance
#                               (429 at the cap, 500 on a spike), by status; read
#                               from its request log, of which only the status is
#                               taken: the address and browser in those entries
#                               never reach the metric
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

echo
echo "Done. The metrics fill from now on; the dashboard's per-route panels stay empty until the first requests."
