---
id: bigquery
sidebar_label: Google BigQuery
title: Google BigQuery Sink
---

# Google BigQuery Sink

The BigQuery sink uses the **Storage Write API** (formerly known as the BigQuery Storage Write API v2) to deliver records with high throughput and low latency. Unlike legacy streaming inserts, the Storage Write API supports committed streams with exactly-once semantics and avoids per-row deduplication costs.

## How It Works

STREAMINGPLUS opens a committed write stream per partition worker. Each stream appends proto-encoded rows in batches and finalizes the stream on graceful shutdown. On restart, the sink resumes from the last committed offset, ensuring no data is lost or duplicated.

```
Kafka / Source ──► STREAMINGPLUS Worker ──► Storage Write API (committed stream) ──► BigQuery Table
```

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `projectId` | string | Yes | GCP project that owns the destination dataset |
| `datasetId` | string | Yes | BigQuery dataset name |
| `tableId` | string | Yes | Target table name |
| `connectionRef` | string | Yes | Reference to a GCP `Connection` resource |
| `writeMode` | string | No | `append` (default) or `upsert` |
| `upsertKeys` | list | No | Column(s) used as merge key for upsert mode |
| `schemaManagement` | object | No | Schema auto-evolution settings |
| `batchConfig` | object | No | Row batch size and flush interval |

## Schema Management

STREAMINGPLUS can automatically evolve the BigQuery table schema as your source data changes:

```yaml
schemaManagement:
  autoEvolve: true          # add new columns automatically
  dropMissingColumns: false # never remove columns (safe default)
  nullableByDefault: true   # new columns are NULLABLE
```

:::warning
Setting `dropMissingColumns: true` will cause STREAMINGPLUS to issue `ALTER TABLE DROP COLUMN` statements. This is destructive and cannot be undone without a backup. Only enable this in development environments.
:::

When `autoEvolve` is enabled, STREAMINGPLUS compares the inferred schema of each micro-batch against the live BigQuery table schema and issues `ALTER TABLE ADD COLUMN` as needed before writing the batch.

## Write Modes

### Append Mode

Records are appended to the table as new rows. This is the default and highest-throughput mode. Use it when:
- Your table is partitioned and you query by partition
- Downstream consumers handle deduplication
- You are building event logs or audit trails

```yaml
spec:
  sink:
    type: bigquery
    connectionRef: gcp-prod
    projectId: my-gcp-project
    datasetId: analytics
    tableId: user_events
    writeMode: append
```

### Upsert Mode

Records are merged into the target table using the BigQuery `MERGE` statement. Use it when:
- Your source emits change events (CDC)
- You want a "latest state" table updated in near-real-time

```yaml
spec:
  sink:
    type: bigquery
    connectionRef: gcp-prod
    projectId: my-gcp-project
    datasetId: analytics
    tableId: user_profiles
    writeMode: upsert
    upsertKeys:
      - user_id
    batchConfig:
      flushIntervalMs: 30000   # merge every 30 s
      maxBatchRows: 10000
```

:::note
Upsert mode uses a staging table internally. Each flush cycle writes a batch to the staging table and then executes a `MERGE` into the target. This incurs slightly higher BigQuery compute costs compared to append mode.
:::

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: cdc-to-bigquery
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - db.public.users
    format: debezium-json
  transforms:
    - type: unwrap-debezium
    - type: cast
      fields:
        created_at: TIMESTAMP
        updated_at: TIMESTAMP
  sink:
    type: bigquery
    connectionRef: gcp-prod
    projectId: my-gcp-project
    datasetId: analytics
    tableId: users
    writeMode: upsert
    upsertKeys:
      - id
    schemaManagement:
      autoEvolve: true
      dropMissingColumns: false
      nullableByDefault: true
    batchConfig:
      flushIntervalMs: 15000
      maxBatchRows: 5000
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-prod
        topic: streamingplus.dead-letter.bigquery
      maxRetries: 3
```

## IAM Requirements

The GCP service account or workload identity must have the following BigQuery roles:

- `roles/bigquery.dataEditor` — write rows and run `MERGE`
- `roles/bigquery.jobUser` — create BigQuery jobs (needed for upsert merge statements)

See the [GCP Integration](../integrations/gcp) page for Workload Identity Federation setup.
