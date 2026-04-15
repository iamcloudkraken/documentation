---
id: kafka
sidebar_label: Apache Kafka
title: Apache Kafka Sink
---

# Apache Kafka Sink

The Kafka sink publishes processed records to one or more Kafka topics. It supports configurable partitioning strategies, compression, and exactly-once delivery using Kafka transactions.

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bootstrapServers` | string | Yes | Comma-separated list of broker addresses |
| `topic` | string | Yes | Target topic (supports `{{field_name}}` template) |
| `connectionRef` | string | Yes | Reference to a Kafka `Connection` resource |
| `partitioner` | string | No | Partitioning strategy (see table below) |
| `partitionKey` | string | No | Record field used as the partition key |
| `compression` | string | No | `none`, `gzip`, `snappy`, `lz4`, `zstd` (default: `snappy`) |
| `acks` | string | No | Producer ack level: `0`, `1`, `all` (default: `all`) |
| `exactlyOnce` | boolean | No | Enable transactional exactly-once delivery (default: `false`) |
| `batchConfig` | object | No | Batch size and linger time tuning |

## Partitioner Modes

| Partitioner | Description | Use Case |
|-------------|-------------|----------|
| `round-robin` | Distributes records evenly across partitions | Even load balancing, no ordering needed |
| `hash` | Hashes `partitionKey` field to select partition | Order-preserving per key (e.g., per user ID) |
| `sticky` | Batches records to the same partition until the batch is full | Maximizes batch efficiency and throughput |
| `explicit` | Reads partition number directly from a record field | When upstream assigns partitions explicitly |
| `random` | Randomly selects a partition | Testing; not recommended for production |

## Exactly-Once Configuration

When `exactlyOnce: true`, STREAMINGPLUS enables Kafka producer transactions. This requires:
- Kafka broker version 2.5 or higher
- `transactional.id` set per producer instance (managed automatically by STREAMINGPLUS)
- The destination topic must have `min.insync.replicas >= 2`

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: exactly-once-kafka-sink
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-source
    topics:
      - raw-payments
    format: json
    consumerGroup: sp-payments-processor
  transforms:
    - type: enrich
      lookupRef: fx-rates-table
      joinField: currency
  sink:
    type: kafka
    connectionRef: kafka-sink
    bootstrapServers: broker1:9092,broker2:9092,broker3:9092
    topic: enriched-payments
    partitioner: hash
    partitionKey: payment_id
    compression: snappy
    acks: all
    exactlyOnce: true
    batchConfig:
      maxBatchSizeBytes: 1048576   # 1 MB
      lingerMs: 5
      maxInFlightRequestsPerConnection: 1  # required for exactly-once
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-sink
        topic: streamingplus.dead-letter.payments
      maxRetries: 3
      retryBackoffMs: 500
```

:::warning
With `exactlyOnce: true`, `maxInFlightRequestsPerConnection` must be `1` to prevent out-of-order retries that would break the idempotency guarantee. STREAMINGPLUS sets this automatically when `exactlyOnce` is enabled.
:::

## Dynamic Topic Routing

The `topic` field supports Go-style template expressions using record field values. This allows routing different records to different topics:

```yaml
sink:
  type: kafka
  topic: "events.{{.event_type}}.{{.region}}"
  partitioner: hash
  partitionKey: user_id
```

A record with `event_type=purchase` and `region=eu-west` would be routed to topic `events.purchase.eu-west`.

:::note
Ensure that the dynamic topics exist before routing records to them. STREAMINGPLUS does not auto-create topics. Use the `sp connections test` command to validate broker connectivity and topic existence.
:::

## Compression Comparison

| Codec | CPU Cost | Compression Ratio | Best For |
|-------|----------|-------------------|----------|
| `none` | None | 1x | Low-latency pipelines where CPU is constrained |
| `gzip` | High | 4–6x | Archival, bandwidth-limited links |
| `snappy` | Low | 2–3x | General purpose (default) |
| `lz4` | Very low | 2–3x | High-throughput real-time pipelines |
| `zstd` | Medium | 4–5x | Best ratio at moderate CPU cost (Kafka 2.1+) |

## SASL/TLS Authentication

Configure authentication in the `Connection` resource rather than the sink spec:

```bash
sp connections create kafka-prod \
  --type kafka \
  --bootstrap-servers broker1:9092,broker2:9092 \
  --sasl-mechanism SCRAM-SHA-512 \
  --secret-ref kafka-sasl-credentials \
  --tls-enabled \
  --tls-ca-cert-ref kafka-ca-cert
```
