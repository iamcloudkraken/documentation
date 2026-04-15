---
id: monitoring
sidebar_label: Monitoring
title: Monitoring
---

# Monitoring

STREAMINGPLUS provides built-in monitoring capabilities including dashboards, SLO tracking, alerting rules, and CLI status commands. All metrics are exposed via a Prometheus-compatible `/metrics` endpoint.

## Built-in Dashboards

The STREAMINGPLUS web console includes the following pre-built dashboards:

| Dashboard | Description |
|-----------|-------------|
| **Platform Overview** | Cluster health, control plane status, resource counts |
| **Deployment Throughput** | Records/sec per deployment, source lag, sink write latency |
| **Sink Health** | Error rates, retry counts, dead-letter queue depth per sink |
| **Pipeline Status** | Active pipeline runs, stage durations, approval queue |
| **GitOps Sync** | Sync status, drift events, last sync timestamp per environment |
| **SLO Burn Rate** | Current burn rate vs budget for all defined SLOs |
| **Audit Activity** | Recent API actions, user activity heatmap |

Access dashboards at: `https://<your-streamingplus-domain>/dashboards`

Or connect your own Grafana instance using the STREAMINGPLUS Grafana plugin (available in Grafana Labs marketplace).

## sp status Commands

```bash
# Overall platform health
sp status

# Specific environment health
sp status --env production

# Single deployment status
sp deployments status payments-processor --env production

# Watch in real time
sp deployments status payments-processor --env production --watch

# Status of all sinks in an environment
sp status --env production --component sinks

# Pipeline run status
sp pipelines status payments-release-pipeline --env production
```

## SLO Definitions

Define SLOs as STREAMINGPLUS resources:

```yaml
apiVersion: streamingplus.io/v1
kind: SLO
metadata:
  name: payments-sink-availability
  namespace: production
spec:
  description: "Payments sink successfully writes at least 99.9% of records"
  target: 99.9          # percentage
  window: 30d           # rolling window
  indicator:
    type: ratio
    goodMetric: |
      sum(increase(streamingplus_sink_records_written_total{deployment="payments-processor",env="production"}[5m]))
    totalMetric: |
      sum(increase(streamingplus_sink_records_attempted_total{deployment="payments-processor",env="production"}[5m]))
  alerting:
    burnRateThresholds:
      - severity: critical
        burnRate: 14.4    # exhausts error budget in 2 hours
        for: 5m
      - severity: warning
        burnRate: 3.0     # exhausts error budget in 10 days
        for: 30m
  integrations:
    datadog:
      sync: true
      tags:
        - "team:data-platform"
    prometheusRule:
      enabled: true
```

Apply and inspect SLOs:

```bash
sp apply -f slo.yaml
sp slos list --env production
sp slos status payments-sink-availability --env production
sp slos burn-rate payments-sink-availability --env production --window 1h
```

## Alerting Rules

Define alert rules as `AlertRule` resources:

```yaml
apiVersion: streamingplus.io/v1
kind: AlertRule
metadata:
  name: high-sink-error-rate
  namespace: production
spec:
  description: "Alert when sink error rate exceeds 1%"
  condition: |
    (
      sum(rate(streamingplus_sink_records_failed_total{env="production"}[5m]))
      /
      sum(rate(streamingplus_sink_records_attempted_total{env="production"}[5m]))
    ) > 0.01
  for: 5m
  severity: critical
  labels:
    team: data-platform
    component: sink
  annotations:
    summary: "Sink error rate exceeds 1% in production"
    runbook: "https://wiki.example.com/runbooks/sink-error-rate"
  notify:
    slack:
      channel: "#data-platform-alerts"
      mention: "@oncall-data"
    pagerduty:
      integrationKeySecretRef: pagerduty-integration-key
    email:
      recipients:
        - data-platform@example.com
---
apiVersion: streamingplus.io/v1
kind: AlertRule
metadata:
  name: consumer-lag-critical
  namespace: production
spec:
  description: "Alert when Kafka consumer lag exceeds 100k records"
  condition: |
    streamingplus_source_consumer_lag{env="production"} > 100000
  for: 10m
  severity: warning
  notify:
    slack:
      channel: "#data-platform-alerts"
```

## Prometheus Integration

STREAMINGPLUS exposes metrics at:

```
http://<worker-pod-ip>:9090/metrics
http://<control-plane-pod-ip>:9090/metrics
```

Enable a `ServiceMonitor` (for Prometheus Operator) via Helm values:

```yaml
metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
    scrapeTimeout: 10s
    labels:
      release: prometheus    # match your Prometheus Operator selector
```

## Key Metrics Reference

| Metric | Type | Description |
|--------|------|-------------|
| `streamingplus_sink_records_written_total` | Counter | Records successfully written to sink |
| `streamingplus_sink_records_failed_total` | Counter | Records that failed after all retries |
| `streamingplus_sink_write_latency_seconds` | Histogram | Write latency distribution |
| `streamingplus_source_records_consumed_total` | Counter | Records read from source |
| `streamingplus_source_consumer_lag` | Gauge | Current consumer group lag (Kafka sources) |
| `streamingplus_gitops_drift_detected_total` | Counter | Number of drift events detected |
| `streamingplus_gitops_sync_duration_seconds` | Histogram | Time taken to sync a GitOps source |
| `streamingplus_pipeline_stage_duration_seconds` | Histogram | Duration of each pipeline stage |
| `streamingplus_control_plane_api_requests_total` | Counter | Total API requests to the Control Plane |
