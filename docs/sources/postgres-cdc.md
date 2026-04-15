---
id: postgres-cdc
sidebar_label: PostgreSQL CDC
title: PostgreSQL CDC Source
---

# PostgreSQL CDC Source

The PostgreSQL CDC source captures row-level changes (inserts, updates, deletes) from a PostgreSQL database using **logical replication**. It uses the `pgoutput` logical decoding plugin, which is built into PostgreSQL 10+ and requires no additional extensions.

Delivery guarantee: **exactly-once** when paired with a transactional sink. The source tracks LSN (Log Sequence Number) positions as checkpoints, enabling precise recovery without re-replaying already-processed changes.

---

## How It Works

STREAMINGPLUS connects to PostgreSQL as a replication client and consumes from a **replication slot**. The `pgoutput` plugin decodes WAL (Write-Ahead Log) entries into a structured change event format that STREAMINGPLUS enriches with schema metadata.

Each change event contains:
- `before` — the row state before the change (for UPDATE and DELETE)
- `after` — the row state after the change (for INSERT and UPDATE)
- `op` — the operation type: `r` (read/snapshot), `c` (create/insert), `u` (update), `d` (delete)
- `source` — metadata including table name, schema, LSN, transaction ID, and timestamp

---

## Database Prerequisites

### 1. Set `wal_level` to `logical`

```sql
-- Check current setting
SHOW wal_level;

-- Update in postgresql.conf
ALTER SYSTEM SET wal_level = logical;

-- Reload configuration (requires superuser)
SELECT pg_reload_conf();

-- Verify (requires restart if changed from replica or minimal)
SHOW wal_level;
```

:::warning
Changing `wal_level` requires a PostgreSQL server restart if the current value is `replica` or `minimal`. Plan for a maintenance window on production systems.
:::

### 2. Create a replication user

```sql
-- Create user with replication privilege
CREATE USER sp_replication WITH REPLICATION LOGIN PASSWORD 'strong-password';

-- Grant SELECT on tables to capture
GRANT USAGE ON SCHEMA public TO sp_replication;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO sp_replication;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO sp_replication;

-- Grant access to the replication slot (if pre-creating it)
GRANT pg_use_reserved_connections TO sp_replication;
```

### 3. Create a publication

```sql
-- Publish all tables in a schema
CREATE PUBLICATION sp_publication FOR ALL TABLES;

-- Or publish specific tables only
CREATE PUBLICATION sp_publication FOR TABLE
  public.orders,
  public.customers,
  public.payments;
```

### 4. Set replica identity for UPDATE/DELETE capture

By default, PostgreSQL only includes the primary key columns in `before` images for UPDATE and DELETE. To capture full row images:

```sql
-- Full before-image for a specific table
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Default (primary key only) — sufficient for most use cases
ALTER TABLE public.orders REPLICA IDENTITY DEFAULT;
```

---

## Required Properties

| Property | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `connection` | string | Yes | — | Name of the registered `DatabaseConnection` for the PostgreSQL instance. |
| `publication` | string | Yes | — | Name of the PostgreSQL publication to subscribe to. |
| `slotName` | string | Yes | — | Name of the replication slot. Created automatically if it does not exist. |
| `tables` | list[string] | Yes | — | List of tables to capture in `schema.table` format. |

## Optional Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `snapshotMode` | string | `initial` | See snapshot modes table below. |
| `includeSchemaChanges` | bool | `false` | Emit DDL change events when tables are altered. |
| `heartbeatInterval` | duration | `30s` | How often to send heartbeat messages to keep the replication slot active. |
| `maxBatchSize` | int | `2048` | Maximum change events per batch. |
| `decimalHandling` | string | `precise` | How to handle NUMERIC/DECIMAL types: `precise`, `double`, `string`. |
| `temporalPrecision` | string | `adaptive` | Timestamp precision: `adaptive`, `microseconds`, `nanoseconds`. |
| `toastHandlingMode` | string | `include` | How to handle TOAST columns: `include`, `skip`, `include-null`. |

---

## Snapshot Modes

| Mode | Description |
|---|---|
| `initial` | Take a consistent snapshot of all tables before starting to stream changes. Use for initial loads. |
| `initial-only` | Take a snapshot and stop. No streaming of ongoing changes. |
| `never` | Skip the snapshot entirely. Only capture changes that occur after the slot is created. |
| `always` | Take a new snapshot every time the pipeline starts. Useful for development or full reloads. |
| `exported` | Use an exported snapshot from an external process (advanced, for coordinated migrations). |

:::note
The `initial` snapshot is taken within a single transaction using `REPEATABLE READ` isolation, ensuring consistency. For very large tables, the snapshot may take a significant amount of time. Use `snapshotFetchSize` to control memory usage during the snapshot phase.
:::

---

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: postgres-orders-cdc
  namespace: data-platform
spec:
  source:
    type: postgres-cdc
    postgresCdc:
      connection: rds-analytics
      publication: sp_publication
      slotName: sp_orders_slot
      tables:
        - public.orders
        - public.customers
        - public.payments
        - public.order_items

      snapshotMode: initial
      includeSchemaChanges: false
      heartbeatInterval: 10s

      decimalHandling: precise
      temporalPrecision: adaptive

      snapshotFetchSize: 10240
      snapshotMaxThreads: 4

      toastHandlingMode: include

      slot:
        dropOnStop: false         # Keep slot alive when pipeline is paused
        maxRetainedChanges: 0     # 0 = unlimited (bounded by wal_keep_size)

      errorHandling:
        retryableErrors:
          - connection_exception
          - insufficient_resources
        maxRetries: 5
        retryBackoff: 30s
```

---

## Change Event Schema

Each change event emitted by the PostgreSQL CDC source follows this structure:

```json
{
  "before": {
    "id": 12345,
    "status": "pending",
    "amount": 99.99
  },
  "after": {
    "id": 12345,
    "status": "completed",
    "amount": 99.99
  },
  "op": "u",
  "ts_ms": 1718000000000,
  "source": {
    "db": "analytics",
    "schema": "public",
    "table": "orders",
    "lsn": "0/3A3F150",
    "txId": 758,
    "ts_ms": 1718000000000
  }
}
```

---

## CLI Quickstart

```bash
sp pipelines create postgres-orders-cdc \
  --source postgres-cdc \
  --connection rds-analytics \
  --publication sp_publication \
  --slot sp_orders_slot \
  --tables public.orders,public.customers \
  --snapshot-mode initial \
  --namespace data-platform
```

Check replication lag:

```bash
sp sources status postgres-orders-cdc
```

```
SLOT               LSN             LAG-BYTES   EVENTS/SEC   SNAPSHOT
sp_orders_slot     0/3A3F150       0           1,203        complete
```
