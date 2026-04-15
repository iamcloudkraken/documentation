---
id: datadog
sidebar_label: Datadog
title: Datadog Integration
---

# Datadog Integration

STREAMINGPLUS integrates with Datadog to automatically forward metrics, logs, APM traces, and SLO data. Once enabled, all STREAMINGPLUS signals are available in your Datadog account with no additional instrumentation required.

## Enabling the Integration

```bash
sp integrations enable datadog \
  --api-key YOUR_DATADOG_API_KEY \
  --site datadoghq.com \
  --env production
```

This installs a lightweight Datadog DogStatsD sidecar in your STREAMINGPLUS environment and configures metric forwarding. Logs and traces are forwarded via the Datadog Agent running on each node.

:::tip
Store the Datadog API key in a Kubernetes secret and reference it with `--api-key-secret-ref datadog-api-key` instead of passing it as a plain argument, to avoid exposing it in shell history.
:::

## Auto-Sent Signals

Once enabled, STREAMINGPLUS automatically forwards the following signals to Datadog:

| Signal Type | Examples |
|-------------|---------|
| Infrastructure Metrics | CPU, memory, pod restarts, GC pressure |
| Sink Metrics | `streamingplus.sink.records_written`, `streamingplus.sink.write_latency_p99` |
| Source Metrics | `streamingplus.source.records_consumed`, `streamingplus.source.consumer_lag` |
| Pipeline Metrics | `streamingplus.pipeline.stage_duration`, `streamingplus.pipeline.errors_total` |
| GitOps Metrics | `streamingplus.gitops.drift_detected`, `streamingplus.gitops.sync_duration` |
| Deployment Events | Deployment start, rollout complete, rollback triggered |
| Logs | Structured JSON logs from all STREAMINGPLUS components |
| APM Traces | Distributed traces through source → transform → sink |

## Custom Metrics

STREAMINGPLUS exposes a Prometheus-compatible `/metrics` endpoint. You can configure the Datadog Agent to scrape this endpoint and forward additional custom metrics:

```yaml
# datadog-agent-values.yaml (Helm override)
datadog:
  prometheusScrape:
    enabled: true
    serviceEndpoints:
      - url: http://streamingplus-metrics.production.svc.cluster.local:9090/metrics
        namespace: streamingplus
        metrics:
          - "streamingplus_*"
```

Custom metrics are prefixed with `streamingplus.` in Datadog.

## SLO Sync

Define SLOs in STREAMINGPLUS and have them automatically synced to Datadog as Metric-Based SLOs:

```yaml
apiVersion: streamingplus.io/v1
kind: SLO
metadata:
  name: payments-sink-availability
  namespace: production
spec:
  description: "Payments sink writes successfully at least 99.9% of the time"
  target: 99.9
  window: 30d
  indicator:
    type: ratio
    goodMetric: streamingplus_sink_records_written_total{deployment="payments-sink"}
    totalMetric: streamingplus_sink_records_attempted_total{deployment="payments-sink"}
  integrations:
    datadog:
      sync: true
      tags:
        - "team:data-platform"
        - "env:production"
```

Apply the SLO:

```bash
sp apply -f slo.yaml
```

STREAMINGPLUS will create (or update) the corresponding Datadog SLO via the Datadog API and keep them in sync.

## Alerting

Pre-built Datadog monitors are available as a STREAMINGPLUS Terraform module:

```hcl
module "streamingplus_datadog_monitors" {
  source  = "streamingplus/datadog-monitors/aws"
  version = "~> 1.0"

  env             = "production"
  alert_recipients = ["@pagerduty-data-platform"]
  thresholds = {
    sink_error_rate   = 0.01   # alert if > 1% errors
    consumer_lag      = 50000  # alert if lag > 50k records
    pipeline_p99_ms   = 5000   # alert if p99 latency > 5 s
  }
}
```

## Dashboard

Install the STREAMINGPLUS Datadog integration tile from the Datadog Marketplace to get pre-built dashboards for:
- Sink throughput and error rates
- Consumer group lag per topic
- Pipeline stage latency breakdown
- GitOps sync status and drift events
