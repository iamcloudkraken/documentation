---
id: elasticsearch
sidebar_label: Elasticsearch
title: Elasticsearch Sink
---

# Elasticsearch Sink

The Elasticsearch sink indexes records into an Elasticsearch (or OpenSearch) cluster. It supports basic authentication, API key authentication, document ID templating, and upsert semantics via the Elasticsearch Bulk API.

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hosts` | list | Yes | One or more Elasticsearch node URLs |
| `index` | string | Yes | Target index name (supports `{{field}}` templates) |
| `connectionRef` | string | Yes | Reference to an Elasticsearch `Connection` resource |
| `documentId` | string | No | Record field or template to use as `_id` (default: auto-generated UUID) |
| `writeMode` | string | No | `index` (default) or `upsert` |
| `upsertScript` | string | No | Painless script for partial document update (upsert mode) |
| `routing` | string | No | Field name for custom shard routing |
| `pipeline` | string | No | Elasticsearch ingest pipeline to run on index |
| `batchConfig` | object | No | Bulk batch size and flush interval |
| `tls` | object | No | TLS/certificate configuration |

## Authentication

### Basic Authentication

```yaml
apiVersion: streamingplus.io/v1
kind: Connection
metadata:
  name: elasticsearch-prod
spec:
  type: elasticsearch
  hosts:
    - https://es-cluster.internal:9200
  auth:
    type: basic
    secretRef: es-basic-credentials   # must contain `username` and `password`
  tls:
    caCertSecretRef: es-ca-cert
    insecureSkipVerify: false
```

### API Key Authentication

```yaml
apiVersion: streamingplus.io/v1
kind: Connection
metadata:
  name: elasticsearch-prod
spec:
  type: elasticsearch
  hosts:
    - https://es-cluster.internal:9200
  auth:
    type: api-key
    secretRef: es-api-key-secret   # must contain `apiKey` field (base64-encoded `id:key`)
  tls:
    caCertSecretRef: es-ca-cert
```

Create the connection via CLI:

```bash
# Basic auth
sp connections create elasticsearch-prod \
  --type elasticsearch \
  --hosts https://es-cluster.internal:9200 \
  --auth-type basic \
  --secret-ref es-basic-credentials

# API key
sp connections create elasticsearch-prod \
  --type elasticsearch \
  --hosts https://es-cluster.internal:9200 \
  --auth-type api-key \
  --secret-ref es-api-key-secret
```

## Document ID Configuration

Setting a stable document ID is critical for deduplication and upsert semantics. STREAMINGPLUS supports field references and template expressions:

```yaml
sink:
  type: elasticsearch
  index: user-events
  documentId: "{{.user_id}}-{{.event_id}}"   # composite ID from two fields
```

:::tip
Always set `documentId` when using `writeMode: upsert`. Without a stable `_id`, each record will create a new document instead of updating an existing one.
:::

## Upsert Configuration

In upsert mode, STREAMINGPLUS uses the Elasticsearch Bulk API `update` action with `doc_as_upsert: true`:

```yaml
spec:
  sink:
    type: elasticsearch
    connectionRef: elasticsearch-prod
    index: user-profiles
    documentId: "{{.user_id}}"
    writeMode: upsert
    upsertScript: |
      if (ctx._source.updated_at == null || ctx._source.updated_at < params.updated_at) {
        ctx._source.putAll(params);
      }
```

When `upsertScript` is provided, STREAMINGPLUS uses a `script` update instead of `doc_as_upsert`, passing the record fields as `params`. This enables conditional updates (only update if the incoming record is newer).

## Dynamic Index Routing

Like the Kafka sink, the `index` field supports template expressions:

```yaml
sink:
  type: elasticsearch
  index: "logs-{{.service_name}}-{{.date}}"
  documentId: "{{.trace_id}}"
```

This produces indices like `logs-checkout-2024-06-15`.

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: logs-to-elasticsearch
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - application-logs
    format: json
  transforms:
    - type: parse-timestamp
      field: timestamp
      format: RFC3339
    - type: add-field
      field: date
      value: "{{formatTime .timestamp \"2006-01-02\"}}"
  sink:
    type: elasticsearch
    connectionRef: elasticsearch-prod
    index: "logs-{{.service_name}}-{{.date}}"
    documentId: "{{.trace_id}}-{{.log_sequence}}"
    writeMode: index
    pipeline: log-enrichment-pipeline
    batchConfig:
      maxBatchSizeBytes: 5242880   # 5 MB bulk request limit
      flushIntervalMs: 5000
      maxBatchDocs: 2000
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-prod
        topic: streamingplus.dead-letter.elasticsearch
      maxRetries: 5
      retryBackoffMs: 2000
```

## OpenSearch Compatibility

The Elasticsearch sink is compatible with OpenSearch 1.x and 2.x. Set `flavor: opensearch` in the connection spec if you are targeting an OpenSearch cluster:

```yaml
spec:
  type: elasticsearch
  flavor: opensearch
  hosts:
    - https://opensearch.internal:9200
```
