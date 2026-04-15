---
id: index
sidebar_label: Overview
title: Sources
---

# Sources

A **source** is the entry point for data into a STREAMINGPLUS pipeline. Sources connect to external systems, read event streams or data records, and emit them as a continuous stream of typed messages that downstream operators can process.

Sources are defined declaratively as part of a `StreamingPipeline` resource or as standalone `StreamSource` resources that can be shared across pipelines.

---

## Supported Sources

| Source | Delivery Guarantee | CDC | Status |
|---|---|:---:|---|
| [Apache Kafka](./kafka) | Exactly-once | No | GA |
| [Amazon Kinesis](./kinesis) | At-least-once | No | GA |
| [Amazon S3](./s3) | At-least-once | No | GA |
| [Google Pub/Sub](./pubsub) | At-least-once | No | GA |
| [Azure Event Hubs](./eventhub) | At-least-once | No | GA |
| [PostgreSQL CDC](./postgres-cdc) | Exactly-once | Yes | GA |
| [MySQL CDC](./mysql-cdc) | At-least-once | Yes | GA |
| [HTTP / Webhook](./http) | At-least-once | No | GA |

### Delivery Guarantee Definitions

| Guarantee | Description |
|---|---|
| **Exactly-once** | Each record is processed exactly once, even in the event of failure and recovery. Requires checkpointing and idempotent sinks. |
| **At-least-once** | Records may be re-delivered after failure. Downstream operators and sinks should be idempotent. |

:::note
Exactly-once delivery requires that both the source and the sink support transactional semantics. When mixing an exactly-once source with an at-least-once sink, the effective guarantee is at-least-once.
:::

---

## Creating a Source

### Inline source (within a pipeline)

The most common pattern is to define the source inline within a `StreamingPipeline`:

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: payment-events
  namespace: data-platform
spec:
  source:
    type: kafka
    kafka:
      connection: prod-kafka
      topic: payments.raw
      consumerGroup: sp-payment-pipeline
      valueFormat: json
```

### Standalone source (shared across pipelines)

Define a `StreamSource` resource to reuse the same source configuration across multiple pipelines:

```yaml
apiVersion: streamingplus.io/v1
kind: StreamSource
metadata:
  name: payments-kafka
  namespace: data-platform
spec:
  type: kafka
  kafka:
    connection: prod-kafka
    topic: payments.raw
    consumerGroup: sp-payment-pipeline
    valueFormat: json
```

Reference it from a pipeline:

```yaml
spec:
  source:
    ref:
      name: payments-kafka
      namespace: data-platform
```

### CLI quickstart

```bash
sp sources create \
  --name payments-kafka \
  --type kafka \
  --connection prod-kafka \
  --topic payments.raw \
  --format json \
  --namespace data-platform
```

---

## Schema Registry

For Avro, Protobuf, or JSON Schema-encoded messages, STREAMINGPLUS integrates with a schema registry to resolve and validate schemas at read time.

```yaml
spec:
  source:
    type: kafka
    kafka:
      connection: prod-kafka
      topic: payments.raw
      valueFormat: avro
      schemaRegistry:
        connection: confluent-sr-prod
        subjectStrategy: topic-name     # topic-name | record-name | topic-record-name
        compatibilityMode: backward
```

Schema registry connections are registered separately:

```bash
sp connections schema-registries add \
  --name confluent-sr-prod \
  --url https://schema-registry.internal.example.com \
  --username sr-user \
  --password "$(cat /run/secrets/sr-password)"
```

---

## Source Monitoring

All sources automatically emit the following metrics to connected observability backends:

| Metric | Description |
|---|---|
| `sp_source_records_read_total` | Total records read from the source since pipeline start. |
| `sp_source_read_rate` | Current read rate (records/sec). |
| `sp_source_lag` | Current lag behind the tip of the source (where applicable). |
| `sp_source_bytes_read_total` | Total bytes read from the source. |
| `sp_source_errors_total` | Total parse or connectivity errors encountered. |
| `sp_source_last_read_timestamp` | Timestamp of the most recently read record. |

---

## Next Steps

- [Apache Kafka source](./kafka)
- [Amazon Kinesis source](./kinesis)
- [PostgreSQL CDC source](./postgres-cdc)
- [HTTP / Webhook source](./http)
