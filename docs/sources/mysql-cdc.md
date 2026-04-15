---
id: mysql-cdc
sidebar_label: MySQL CDC
title: MySQL CDC
---

# MySQL CDC

Capture row-level INSERT, UPDATE, and DELETE events from MySQL 5.7+ and MariaDB 10.3+ by tailing the binary log (binlog).

| Property | Value |
|----------|-------|
| Delivery guarantee | Exactly once |
| Minimum MySQL version | 5.7 |
| Minimum MariaDB version | 10.3 |
| Replication format | ROW |

## MySQL Prerequisites

```sql
-- my.cnf configuration required:
-- [mysqld]
-- log-bin=mysql-bin
-- binlog-format=ROW
-- server-id=1

-- Create a dedicated CDC user
CREATE USER 'sp_cdc'@'%' IDENTIFIED BY 'strong-password';
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT
  ON *.* TO 'sp_cdc'@'%';
FLUSH PRIVILEGES;
```

## Required Properties

| Property | Description |
|----------|-------------|
| `hostname` | MySQL host |
| `port` | MySQL port (default: `3306`) |
| `database.include.list` | Databases to capture |
| `table.include.list` | Tables to capture, e.g. `shop.orders` |
| `username` | Replication user |
| `password` | Secret reference |
| `server-id` | Unique ID for this connector (must not conflict with other replicas) |

## Full Example

```yaml
apiVersion: streamingplus.io/v1
kind: SourceConnection
metadata:
  name: mysql-orders-cdc
spec:
  type: mysql-cdc
  properties:
    hostname: prod-mysql.example.com
    port: 3306
    database.include.list: shop
    table.include.list: shop.orders,shop.customers
    username: sp_cdc
    password: ${secret:mysql-cdc-password}
    server-id: 5400
    snapshot.mode: initial
```

:::warning
Each MySQL CDC connector must use a unique `server-id` that doesn't conflict with your existing MySQL replica topology.
:::
