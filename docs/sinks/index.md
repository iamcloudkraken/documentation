---
id: index
sidebar_label: Overview
title: Sinks Overview
---

# Sinks

A **Sink** is a destination to which STREAMINGPLUS delivers processed data. Sinks are declared as part of a `Deployment` resource and connect directly to your chosen storage, database, messaging, or HTTP target.

Each sink type exposes its own configuration schema under `spec.sink` and enforces its delivery semantics at the platform level — your application code never needs to implement retry or deduplication logic.

## Supported Sinks

| Sink | Type | Delivery Guarantee | Status |
|------|------|--------------------|--------|
| [Amazon S3](./s3) | Object Storage | At-least-once | GA |
| [Google BigQuery](./bigquery) | Data Warehouse | Exactly-once | GA |
| [Snowflake](./snowflake) | Data Warehouse | At-least-once | GA |
| [PostgreSQL](./postgres) | Relational Database | Exactly-once (upsert) | GA |
| [Apache Kafka](./kafka) | Message Queue | Exactly-once | GA |
| [Elasticsearch](./elasticsearch) | Search / Analytics | At-least-once | GA |
| [HTTP / Webhook](./http) | HTTP Endpoint | At-least-once | GA |

:::note
"Exactly-once" delivery requires that the target system supports idempotent writes or transactions. See each sink page for configuration details.
:::

## Common Sink Configuration Fields

All sink resources share the following top-level fields under `spec.sink`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | The sink type identifier (e.g., `s3`, `bigquery`, `kafka`) |
| `connectionRef` | string | Yes | Name of a `Connection` resource holding credentials |
| `errorHandling` | object | No | Dead-letter queue and error topic configuration |
| `bufferConfig` | object | No | Flush interval and buffer size tuning |

## Error Handling

Every sink supports a `deadLetterSink` sub-field. When a record cannot be delivered after all retries, it is routed to the dead-letter destination rather than dropped silently.

```yaml
spec:
  sink:
    type: s3
    # ... sink-specific config ...
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-dlq-connection
        topic: streamingplus.dead-letter
      maxRetries: 5
      retryBackoffMs: 1000
```

## Connecting Credentials

Sinks reference a `Connection` resource for credentials. Create a connection before referencing it in a deployment:

```bash
sp connections create s3-prod \
  --type s3 \
  --secret-ref aws-s3-credentials
```

Then reference it in your deployment YAML:

```yaml
spec:
  sink:
    type: s3
    connectionRef: s3-prod
```

## Monitoring Sink Health

Use the `sp status` command to inspect the health of a running sink:

```bash
sp deployments status my-deployment --sink
```

Built-in metrics for all sinks (exposed at `/metrics`):

- `streamingplus_sink_records_written_total` — records successfully written
- `streamingplus_sink_records_failed_total` — records that failed after all retries
- `streamingplus_sink_write_latency_seconds` — histogram of write latency
- `streamingplus_sink_buffer_utilization` — current buffer fill ratio

:::tip
Set up a Datadog or Prometheus alert on `streamingplus_sink_records_failed_total > 0` to catch delivery failures before they affect downstream consumers.
:::
