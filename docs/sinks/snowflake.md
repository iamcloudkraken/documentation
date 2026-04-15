---
id: snowflake
sidebar_label: Snowflake
title: Snowflake Sink
---

# Snowflake Sink

The Snowflake sink uses **Snowpipe Streaming** to deliver records directly into Snowflake tables with second-level latency. Unlike classic Snowpipe (which polls staged files), Snowpipe Streaming uses a persistent channel per worker to push rows in near real time without intermediate staging files.

## How Snowpipe Streaming Works

```
Source Records
      │
      ▼
STREAMINGPLUS Worker (opens a Snowpipe Streaming channel)
      │  rows buffered in memory
      ▼
Snowpipe Streaming Ingest API  ──►  Snowflake Table
```

Each deployment worker holds one channel per target table. Channels are named deterministically from the deployment name and worker index so that on restart, the same worker resumes its channel and Snowflake can deduplicate any re-sent rows within the deduplication window (1 hour by default).

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `account` | string | Yes | Snowflake account identifier (e.g., `xy12345.us-east-1`) |
| `database` | string | Yes | Target Snowflake database |
| `schema` | string | Yes | Target schema within the database |
| `table` | string | Yes | Target table name |
| `connectionRef` | string | Yes | Name of a Snowflake `Connection` resource |
| `role` | string | No | Snowflake role to assume (default: role from connection) |
| `warehouse` | string | No | Warehouse for DDL operations (schema evolution only) |
| `batchConfig` | object | No | Flush interval and max rows per batch |
| `schemaManagement` | object | No | Auto-evolution settings |
| `writeMode` | string | No | `append` (default) or `upsert` |
| `upsertKeys` | list | No | Merge key columns for upsert mode |

## Batch Configuration

Snowpipe Streaming channels flush buffered rows periodically. Tune `batchConfig` based on your latency and throughput requirements:

```yaml
batchConfig:
  flushIntervalMs: 5000      # flush at least every 5 s
  maxBatchRows: 25000        # flush early if batch reaches 25k rows
  maxBatchSizeBytes: 52428800 # or 50 MB, whichever comes first
```

:::tip
For time-sensitive dashboards, lower `flushIntervalMs` to 1000–2000 ms. For bulk historical loads, raise it to 30000 ms and increase `maxBatchRows` to reduce Snowpipe Streaming API calls and cost.
:::

## Schema Management

```yaml
schemaManagement:
  autoEvolve: true
  nullableByDefault: true
```

When `autoEvolve` is enabled, STREAMINGPLUS runs `ALTER TABLE ADD COLUMN` DDL statements via the configured `warehouse` before flushing each batch that contains new columns.

:::warning
The Snowflake role used by the connection must have `CREATE TABLE` and `ALTER TABLE` privileges on the target schema when `autoEvolve` is enabled.
:::

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: events-to-snowflake
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - clickstream-events
    format: json
  transforms:
    - type: add-field
      field: _ingest_time
      value: "{{now()}}"
  sink:
    type: snowflake
    connectionRef: snowflake-prod
    account: xy12345.us-east-1
    database: ANALYTICS
    schema: RAW
    table: CLICKSTREAM_EVENTS
    role: STREAMINGPLUS_INGEST_ROLE
    warehouse: COMPUTE_WH
    writeMode: append
    batchConfig:
      flushIntervalMs: 5000
      maxBatchRows: 25000
      maxBatchSizeBytes: 52428800
    schemaManagement:
      autoEvolve: true
      nullableByDefault: true
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-prod
        topic: streamingplus.dead-letter.snowflake
      maxRetries: 5
      retryBackoffMs: 3000
```

## Creating the Connection

```bash
sp connections create snowflake-prod \
  --type snowflake \
  --account xy12345.us-east-1 \
  --user STREAMINGPLUS_USER \
  --secret-ref snowflake-private-key
```

STREAMINGPLUS authenticates using **key-pair authentication** (RSA private key). Password-based authentication is supported but not recommended for production.

## Snowflake Privileges

Grant the following to the Snowflake role used by the connection:

```sql
GRANT USAGE ON DATABASE ANALYTICS TO ROLE STREAMINGPLUS_INGEST_ROLE;
GRANT USAGE ON SCHEMA ANALYTICS.RAW TO ROLE STREAMINGPLUS_INGEST_ROLE;
GRANT INSERT ON TABLE ANALYTICS.RAW.CLICKSTREAM_EVENTS TO ROLE STREAMINGPLUS_INGEST_ROLE;

-- Only needed for schema auto-evolution:
GRANT CREATE TABLE ON SCHEMA ANALYTICS.RAW TO ROLE STREAMINGPLUS_INGEST_ROLE;
GRANT ALTER ON TABLE ANALYTICS.RAW.CLICKSTREAM_EVENTS TO ROLE STREAMINGPLUS_INGEST_ROLE;
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE STREAMINGPLUS_INGEST_ROLE;
```
