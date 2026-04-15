---
id: kafka
sidebar_label: Apache Kafka
title: Apache Kafka Source
---

# Apache Kafka Source

The Kafka source connects to one or more Apache Kafka clusters and reads records from one or more topics. It supports exactly-once processing semantics via Kafka transactions and STREAMINGPLUS checkpointing.

---

## Core Properties

| Property | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `connection` | string | Yes | — | Name of the registered `ClusterConnection` or Kafka broker endpoint. Use a named connection for managed clusters. |
| `topic` | string or list | Yes | — | Topic name or list of topic names to consume. Supports regex with `topic-pattern`. |
| `topic-pattern` | string | No | — | Java regex pattern. Mutually exclusive with `topic`. |
| `consumerGroup` | string | Yes | — | Kafka consumer group ID. STREAMINGPLUS appends a unique suffix per deployment instance. |
| `valueFormat` | string | Yes | — | Deserialization format for the record value: `json`, `avro`, `protobuf`, `csv`, `raw`. |
| `keyFormat` | string | No | `raw` | Deserialization format for the record key. |
| `bootstrapServers` | string | No | — | Comma-separated broker list. Use only when not referencing a named connection. |
| `partitions` | list[int] | No | — | Consume specific partitions only. Omit to consume all partitions. |

---

## Startup Modes

The startup mode controls which offsets the consumer starts reading from when the pipeline first starts or after a full state reset.

| Mode | Description | Related Properties |
|---|---|---|
| `latest-offset` | Start reading from the latest offset at startup. Records produced before pipeline start are skipped. | None |
| `earliest-offset` | Start reading from the earliest available offset. Replays all retained records. | None |
| `group-offsets` | Resume from committed consumer group offsets. Falls back to `latest-offset` if no offsets are committed. | None |
| `timestamp` | Start reading from the first record at or after a specified timestamp. | `startTimestamp` |
| `specific-offsets` | Start reading from explicitly specified partition offsets. | `specificOffsets` |

```yaml
startupMode: timestamp
startTimestamp: "2024-01-15T00:00:00Z"
```

```yaml
startupMode: specific-offsets
specificOffsets:
  "payments.raw/0": 10000
  "payments.raw/1": 9500
  "payments.raw/2": 11200
```

---

## Security Configuration

### PLAINTEXT (no auth, development only)

```yaml
security:
  protocol: PLAINTEXT
```

:::warning
Do not use `PLAINTEXT` in production. All data is transmitted unencrypted without authentication.
:::

### TLS only (encryption, no auth)

```yaml
security:
  protocol: SSL
  ssl:
    truststoreSecretRef:
      name: kafka-truststore
      key: truststore.jks
    truststorePassword:
      secretRef:
        name: kafka-truststore-password
        key: password
```

### SASL/SSL (SCRAM or PLAIN auth with TLS)

```yaml
security:
  protocol: SASL_SSL
  sasl:
    mechanism: SCRAM-SHA-512        # PLAIN | SCRAM-SHA-256 | SCRAM-SHA-512
    username: sp-consumer
    password:
      secretRef:
        name: kafka-sasl-credentials
        key: password
  ssl:
    truststoreSecretRef:
      name: kafka-truststore
      key: truststore.jks
    truststorePassword:
      secretRef:
        name: kafka-truststore-password
        key: password
```

### Mutual TLS (mTLS — client certificate auth)

```yaml
security:
  protocol: SSL
  ssl:
    truststoreSecretRef:
      name: kafka-truststore
      key: truststore.jks
    truststorePassword:
      secretRef:
        name: kafka-truststore-password
        key: password
    keystoreSecretRef:
      name: kafka-client-keystore
      key: keystore.jks
    keystorePassword:
      secretRef:
        name: kafka-client-keystore-password
        key: password
    keyPassword:
      secretRef:
        name: kafka-client-keystore-password
        key: key-password
```

---

## Key and Value Field Inclusion

By default, only the record value is deserialized and passed to downstream operators. Enable key and metadata field inclusion to access additional fields:

```yaml
kafka:
  includeKey: true
  keyField: __kafka_key
  includePartition: true
  partitionField: __kafka_partition
  includeOffset: true
  offsetField: __kafka_offset
  includeTimestamp: true
  timestampField: __kafka_timestamp
  includeHeaders: true
  headersField: __kafka_headers
```

When enabled, these metadata fields are injected as top-level fields in the deserialized record schema.

---

## Error Handling

| Property | Values | Default | Description |
|---|---|---|---|
| `parse-error-policy` | `fail`, `skip`, `dead-letter` | `fail` | What to do when a record cannot be deserialized. |
| `fail-on-missing-field` | `true`, `false` | `true` | Whether to fail the pipeline when a required schema field is absent in a record. |
| `deadLetterTopic` | string | — | Kafka topic to write unparseable records to when `parse-error-policy: dead-letter`. |
| `maxConsecutiveErrors` | int | `10` | Stop the pipeline after this many consecutive parse errors. |

:::warning
Setting `parse-error-policy: skip` silently drops malformed records. Always use `dead-letter` with a configured `deadLetterTopic` so that problematic records can be inspected and reprocessed rather than lost permanently.
:::

---

## Schema Registry

Integrate with Confluent Schema Registry or any Schema Registry API-compatible endpoint for Avro, Protobuf, or JSON Schema formats:

```yaml
schemaRegistry:
  connection: confluent-sr-prod
  subjectStrategy: topic-name         # topic-name | record-name | topic-record-name
  keySubject: payments.raw-key        # override key subject (optional)
  valueSubject: payments.raw-value    # override value subject (optional)
  compatibilityMode: backward
```

---

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: payment-events-pipeline
  namespace: data-platform
spec:
  source:
    type: kafka
    kafka:
      connection: prod-kafka-us-east
      topic: payments.raw
      consumerGroup: sp-payment-pipeline
      valueFormat: avro
      keyFormat: raw
      startupMode: group-offsets

      security:
        protocol: SASL_SSL
        sasl:
          mechanism: SCRAM-SHA-512
          username: sp-consumer
          password:
            secretRef:
              name: kafka-sasl-credentials
              key: password
        ssl:
          truststoreSecretRef:
            name: kafka-truststore
            key: truststore.jks
          truststorePassword:
            secretRef:
              name: kafka-truststore-password
              key: password

      schemaRegistry:
        connection: confluent-sr-prod
        subjectStrategy: topic-name

      includeKey: true
      keyField: __kafka_key
      includeTimestamp: true
      timestampField: event_time

      errorHandling:
        parseErrorPolicy: dead-letter
        deadLetterTopic: payments.raw.dlq
        failOnMissingField: false
        maxConsecutiveErrors: 50

      consumerProperties:
        max.poll.records: "500"
        fetch.max.bytes: "52428800"
        session.timeout.ms: "30000"
```

---

## CLI Quickstart

Create a Kafka source for a new pipeline:

```bash
sp pipelines create payment-events-pipeline \
  --source kafka \
  --connection prod-kafka-us-east \
  --topic payments.raw \
  --format avro \
  --consumer-group sp-payment-pipeline \
  --startup-mode group-offsets \
  --namespace data-platform
```

Check source consumer lag:

```bash
sp sources lag payment-events-pipeline
```

```
TOPIC           PARTITION   LAG     CONSUMER-OFFSET   LOG-END-OFFSET
payments.raw    0           0       5823491           5823491
payments.raw    1           12      5819834           5819846
payments.raw    2           0       5821203           5821203
```

Reset consumer offsets (drain first):

```bash
sp pipelines pause payment-events-pipeline
sp sources reset payment-events-pipeline --to latest
sp pipelines resume payment-events-pipeline
```
