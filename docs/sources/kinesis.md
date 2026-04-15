---
id: kinesis
sidebar_label: Amazon Kinesis
title: Amazon Kinesis Source
---

# Amazon Kinesis Source

The Amazon Kinesis source reads records from one or more Kinesis Data Streams. It supports both IAM Roles for Service Accounts (IRSA) and static credential authentication, and provides configurable starting position modes for replay and recovery scenarios.

Delivery guarantee: **at-least-once**. Kinesis does not support transactional semantics, so records may be re-delivered after checkpoint recovery.

---

## Required Properties

| Property | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `stream` | string | Yes | — | Name of the Kinesis Data Stream. |
| `region` | string | Yes | — | AWS region where the stream resides (e.g., `us-east-1`). |
| `valueFormat` | string | Yes | — | Deserialization format: `json`, `avro`, `raw`. |
| `consumerType` | string | No | `polling` | Read mode: `polling` (GetRecords API) or `enhanced-fan-out` (RegisterStreamConsumer API). |
| `consumerName` | string | No | — | Required when `consumerType: enhanced-fan-out`. The registered consumer name. |

---

## Authentication

### IRSA (recommended)

Use IAM Roles for Service Accounts to avoid static credentials. The Kubernetes service account running the pipeline pod assumes an IAM role with `kinesis:GetRecords`, `kinesis:GetShardIterator`, `kinesis:DescribeStream`, and `kinesis:ListShards` permissions.

```yaml
auth:
  type: irsa
  roleArn: arn:aws:iam::123456789012:role/streamingplus-kinesis-reader
```

IAM policy for the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kinesis:GetRecords",
        "kinesis:GetShardIterator",
        "kinesis:DescribeStream",
        "kinesis:DescribeStreamSummary",
        "kinesis:ListShards",
        "kinesis:ListStreams",
        "kinesis:SubscribeToShard",
        "kinesis:RegisterStreamConsumer",
        "kinesis:DeregisterStreamConsumer"
      ],
      "Resource": "arn:aws:kinesis:us-east-1:123456789012:stream/my-stream"
    }
  ]
}
```

### Static credentials (not recommended for production)

```yaml
auth:
  type: static
  accessKeyId:
    secretRef:
      name: kinesis-credentials
      key: access-key-id
  secretAccessKey:
    secretRef:
      name: kinesis-credentials
      key: secret-access-key
```

---

## Starting Position Modes

| Mode | Description | Related Properties |
|---|---|---|
| `LATEST` | Start reading from the tip of the stream. Records added before pipeline start are skipped. | None |
| `TRIM_HORIZON` | Start from the oldest available record in the stream (up to 7-day retention). | None |
| `AT_TIMESTAMP` | Start reading from the first record at or after a given timestamp. | `startTimestamp` |
| `AT_SEQUENCE_NUMBER` | Start reading from a specific sequence number (per shard). | `startSequenceNumbers` |
| `AFTER_SEQUENCE_NUMBER` | Start reading immediately after a given sequence number (per shard). | `startSequenceNumbers` |

```yaml
startingPosition: AT_TIMESTAMP
startTimestamp: "2024-06-01T00:00:00Z"
```

```yaml
startingPosition: AT_SEQUENCE_NUMBER
startSequenceNumbers:
  shardId-000000000000: "49590338271490256608559692540925702759324208523137515522"
  shardId-000000000001: "49590338271490256608559692540925702759324208523137515523"
```

---

## Enhanced Fan-Out

Enhanced fan-out provides dedicated throughput of 2 MB/sec per shard per consumer, bypassing the 2 MB/sec shared limit of the polling API. It is recommended for production workloads with high throughput requirements.

```yaml
consumerType: enhanced-fan-out
consumerName: streamingplus-payment-pipeline
```

:::note
Enhanced fan-out consumers must be registered with the Kinesis stream before the pipeline starts. STREAMINGPLUS handles this automatically when `consumerType: enhanced-fan-out` is set. Up to 20 registered consumers per stream are supported by AWS.
:::

---

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: kinesis-clickstream
  namespace: data-platform
spec:
  source:
    type: kinesis
    kinesis:
      stream: clickstream-events
      region: us-east-1
      valueFormat: json
      consumerType: enhanced-fan-out
      consumerName: sp-clickstream-pipeline
      startingPosition: LATEST

      auth:
        type: irsa
        roleArn: arn:aws:iam::123456789012:role/streamingplus-kinesis-reader

      checkpointInterval: 10s
      maxRecordsPerPoll: 1000
      pollInterval: 200ms

      errorHandling:
        parseErrorPolicy: dead-letter
        deadLetterStreamArn: arn:aws:kinesis:us-east-1:123456789012:stream/clickstream-dlq
```

---

## CLI Quickstart

```bash
sp pipelines create kinesis-clickstream \
  --source kinesis \
  --stream clickstream-events \
  --region us-east-1 \
  --format json \
  --consumer-type enhanced-fan-out \
  --role-arn arn:aws:iam::123456789012:role/streamingplus-kinesis-reader \
  --namespace data-platform
```

Check shard progress:

```bash
sp sources status kinesis-clickstream
```

```
SHARD                       POSITION                      LAG (ms)
shardId-000000000000        49590338271490...515522       120
shardId-000000000001        49590338271490...515523       85
shardId-000000000002        49590338271490...515524       95
```
