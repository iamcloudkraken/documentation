---
id: observability
sidebar_label: Observability Backends
title: Observability Backend Connections
---

# Observability Backend Connections

STREAMINGPLUS forwards metrics, logs, and distributed traces from all managed workloads to one or more external observability backends. An `ObservabilityConnection` resource stores the endpoint configuration and authentication credentials for each backend.

You can connect multiple backends simultaneously — for example, sending metrics to Prometheus and traces to Honeycomb while logs go to Elastic.

---

## Supported Backends

| Backend | Metrics | Logs | Traces | Status |
|---|:---:|:---:|:---:|---|
| Prometheus (remote write) | Yes | No | No | GA |
| Grafana Cloud | Yes | Yes | Yes | GA |
| Datadog | Yes | Yes | Yes | GA |
| OpenTelemetry Collector | Yes | Yes | Yes | GA |
| Amazon CloudWatch | Yes | Yes | No | GA |
| Google Cloud Monitoring | Yes | Yes | No | GA |
| Splunk | No | Yes | Yes | GA |
| Elastic (ELK Stack) | Yes | Yes | Yes | GA |
| Honeycomb | No | No | Yes | Beta |

---

## What Gets Forwarded Automatically

Once an `ObservabilityConnection` is active, STREAMINGPLUS automatically forwards the following signals from all managed workloads without any additional configuration:

### Metrics

- Pipeline throughput (records/sec, bytes/sec per source and sink)
- Consumer group lag (for Kafka-backed pipelines)
- Processing latency (p50, p95, p99 per operator)
- JVM / runtime heap usage and GC pause times
- Checkpoint duration and size (for stateful pipelines)
- Connection health (`streamingplus_connection_health`)
- Deployment restart counts and error rates

### Logs

- Structured JSON logs from all pipeline operators
- Agent lifecycle events (start, stop, upgrade, crash)
- Policy violation events
- Checkpoint and state management logs

### Traces

- End-to-end distributed traces from source ingestion to sink write
- Operator-level spans with latency breakdown
- Schema validation spans
- External call spans (database lookups, HTTP enrichments)

---

## Connect Prometheus

STREAMINGPLUS uses the **Prometheus Remote Write** protocol to forward metrics. Point it at any Prometheus-compatible endpoint (Prometheus, Thanos, Cortex, Mimir, VictoriaMetrics).

```bash
sp connections observability add \
  --name prometheus-prod \
  --type prometheus \
  --remote-write-url https://prometheus.internal.example.com/api/v1/write \
  --username sp-writer \
  --password "$(cat /run/secrets/prometheus-password)"
```

For bearer token authentication:

```bash
sp connections observability add \
  --name prometheus-prod \
  --type prometheus \
  --remote-write-url https://prometheus.internal.example.com/api/v1/write \
  --bearer-token "$(cat /run/secrets/prometheus-token)"
```

### Custom metric labels

Add static labels to all metrics forwarded to this backend:

```bash
sp connections observability configure prometheus-prod \
  --extra-labels env=production,cluster=prod-eks-us-east,team=data-platform
```

---

## Connect Grafana Cloud

Grafana Cloud uses the **Grafana Agent** protocol (Prometheus remote write + Loki + Tempo) for unified metrics, logs, and traces.

```bash
sp connections observability add \
  --name grafana-cloud-prod \
  --type grafana-cloud \
  --metrics-url https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push \
  --logs-url https://logs-prod-006.grafana.net/loki/api/v1/push \
  --traces-url https://tempo-prod-04-eu-west-0.grafana.net:443 \
  --username 123456 \
  --api-key glc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

After connecting, STREAMINGPLUS automatically provisions a set of Grafana dashboards in your Grafana Cloud organization:

- **STREAMINGPLUS Overview** — fleet-level health
- **Pipeline Detail** — per-pipeline throughput, lag, and latency
- **Cluster Resources** — CPU, memory, and network per cluster
- **Alert Summary** — firing alerts across all managed workloads

:::tip
Import the STREAMINGPLUS dashboards manually using the dashboard IDs listed in the [Grafana Dashboard Reference](../reference/grafana-dashboards) if you prefer to manage Grafana separately.
:::

---

## Connect Datadog

```bash
sp connections observability add \
  --name datadog-prod \
  --type datadog \
  --site datadoghq.com \
  --api-key dd_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

For EU-region Datadog:

```bash
sp connections observability add \
  --name datadog-eu \
  --type datadog \
  --site datadoghq.eu \
  --api-key dd_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## OpenTelemetry Collector

Use OpenTelemetry when you want to centralize signal routing through your own collector before forwarding to multiple backends.

```yaml
apiVersion: streamingplus.io/v1
kind: ObservabilityConnection
metadata:
  name: otel-collector
  namespace: platform
spec:
  type: opentelemetry
  openTelemetry:
    endpoint: https://otel-collector.internal.example.com:4317
    protocol: grpc                  # grpc or http/protobuf
    compression: gzip
    tls:
      insecureSkipVerify: false
      caSecretRef:
        name: otel-ca-cert
        key: ca.crt
    headers:
      X-Team-ID: data-platform
      X-Environment: production
    signals:
      metrics: true
      logs: true
      traces: true
    batchTimeout: 5s
    exportTimeout: 30s
```

Apply the connection:

```bash
kubectl apply -f otel-connection.yaml
# or
sp apply -f otel-connection.yaml
```

---

## Connect Amazon CloudWatch

```bash
sp connections observability add \
  --name cloudwatch-prod \
  --type cloudwatch \
  --region us-east-1 \
  --role-arn arn:aws:iam::123456789012:role/streamingplus-cloudwatch-writer \
  --log-group /streamingplus/production \
  --namespace STREAMINGPLUS/Production
```

---

## Connect Google Cloud Monitoring

```bash
sp connections observability add \
  --name gcp-monitoring-prod \
  --type google-cloud-monitoring \
  --project my-gcp-project \
  --workload-identity \
  --gcp-service-account sp-metrics@my-gcp-project.iam.gserviceaccount.com
```

---

## Connect Splunk

```bash
sp connections observability add \
  --name splunk-prod \
  --type splunk \
  --hec-url https://splunk.internal.example.com:8088/services/collector \
  --hec-token splunk-hec-token-xxxxxxxxxxxx \
  --index streamingplus-prod \
  --source-type _json
```

---

## Managing Observability Connections

```bash
# List all observability connections
sp connections observability list

# Describe a connection
sp connections observability describe grafana-cloud-prod

# Test a connection (sends a test metric/log/trace)
sp connections observability test grafana-cloud-prod

# Remove a connection
sp connections observability delete prometheus-prod
```

:::warning
Deleting an `ObservabilityConnection` immediately stops all signal forwarding to that backend. Gaps in your monitoring data will appear. Ensure you have an alternate backend configured before removing a connection.
:::
