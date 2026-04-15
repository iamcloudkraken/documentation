---
id: postgres
sidebar_label: PostgreSQL
title: PostgreSQL Sink
---

# PostgreSQL Sink

The PostgreSQL sink writes records to a PostgreSQL-compatible database. It supports append, upsert (INSERT ... ON CONFLICT DO UPDATE), and replace (TRUNCATE + INSERT) write modes, with configurable connection pooling.

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `host` | string | Yes | Database hostname or IP |
| `port` | integer | No | Port number (default: `5432`) |
| `database` | string | Yes | Target database name |
| `schema` | string | No | Target schema (default: `public`) |
| `table` | string | Yes | Target table name |
| `connectionRef` | string | Yes | Reference to a PostgreSQL `Connection` resource |
| `writeMode` | string | No | `append`, `upsert`, or `replace` (default: `append`) |
| `upsertKeys` | list | No | Conflict key columns (required for `upsert` mode) |
| `batchSize` | integer | No | Rows per INSERT batch (default: `1000`) |
| `flushIntervalMs` | integer | No | Max time between flushes in ms (default: `5000`) |
| `sslMode` | string | No | SSL mode: `disable`, `require`, `verify-ca`, `verify-full` |

## Write Modes

| Mode | SQL Semantics | Use Case |
|------|--------------|----------|
| `append` | `INSERT INTO table ...` | Event logs, audit tables, immutable ledgers |
| `upsert` | `INSERT INTO table ... ON CONFLICT (keys) DO UPDATE SET ...` | CDC / change events, maintaining latest state |
| `replace` | `TRUNCATE TABLE; INSERT INTO table ...` | Full table refresh from a batch source |

:::warning
`replace` mode issues a `TRUNCATE` statement before each flush. During the truncation window, downstream readers of the table will see an empty table. Only use this mode when brief unavailability is acceptable or the table is write-only.
:::

## Upsert Configuration

```yaml
spec:
  sink:
    type: postgres
    connectionRef: pg-prod
    host: db.internal
    database: analytics
    table: user_profiles
    writeMode: upsert
    upsertKeys:
      - user_id
    batchSize: 500
    flushIntervalMs: 10000
```

The generated SQL for each batch uses PostgreSQL's `ON CONFLICT` clause:

```sql
INSERT INTO public.user_profiles (user_id, name, email, updated_at)
VALUES ($1, $2, $3, $4), ...
ON CONFLICT (user_id)
DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;
```

## Connection Pooling

:::note
STREAMINGPLUS manages an internal connection pool per deployment worker. The pool size is controlled by `connectionPool.maxConnections`. The default is `5` per worker. Set this to match your PostgreSQL server's `max_connections` limit divided by the number of concurrent workers.
:::

```yaml
spec:
  sink:
    type: postgres
    connectionRef: pg-prod
    host: db.internal
    database: analytics
    table: events
    connectionPool:
      maxConnections: 10
      minIdle: 2
      connectionTimeoutMs: 5000
      idleTimeoutMs: 600000
      maxLifetimeMs: 1800000
```

For high-throughput deployments, consider placing **PgBouncer** in front of PostgreSQL and pointing the `host` at the PgBouncer endpoint. STREAMINGPLUS is compatible with PgBouncer in `transaction` pooling mode.

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: cdc-to-postgres
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - db.public.orders
    format: debezium-json
  transforms:
    - type: unwrap-debezium
    - type: drop-fields
      fields:
        - __deleted
        - __source_ts_ms
  sink:
    type: postgres
    connectionRef: pg-prod
    host: pg-primary.internal
    port: 5432
    database: warehouse
    schema: public
    table: orders
    sslMode: verify-full
    writeMode: upsert
    upsertKeys:
      - order_id
    batchSize: 1000
    flushIntervalMs: 5000
    connectionPool:
      maxConnections: 10
      minIdle: 2
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-prod
        topic: streamingplus.dead-letter.postgres
      maxRetries: 5
      retryBackoffMs: 1000
```

## Creating the Connection

```bash
sp connections create pg-prod \
  --type postgres \
  --host pg-primary.internal \
  --database warehouse \
  --secret-ref pg-credentials
```

The secret referenced by `--secret-ref` must contain `username` and `password` keys.
