---
id: databases
sidebar_label: Databases
title: Database Connections
---

# Database Connections

:::note
Database connections are currently in **Beta**. The API surface and YAML schema may change in future minor releases. Feedback is welcome via the [community forum](https://community.streamingplus.io).
:::

STREAMINGPLUS uses database connections to provide streaming pipelines with authenticated, pooled access to relational databases. `DatabaseConnection` resources are referenced by pipeline operators for CDC sources, enrichment lookups, and sink writes.

---

## Supported Services

| Service | Provider | Auth Methods | Connection Pooling | Status |
|---|---|---|:---:|---|
| Amazon RDS (PostgreSQL, MySQL, MariaDB) | AWS | IAM auth, static credentials | Yes | Beta |
| Amazon Aurora (PostgreSQL, MySQL) | AWS | IAM auth, static credentials | Yes | Beta |
| Google Cloud SQL (PostgreSQL, MySQL, SQL Server) | GCP | Workload Identity, IAM, static | Yes | Beta |
| Azure Database (PostgreSQL, MySQL, SQL Server) | Azure | Managed Identity, static | Yes | Beta |
| Self-hosted PostgreSQL | Any | Password, mTLS client cert | Yes | Beta |
| Self-hosted MySQL / MariaDB | Any | Password | Yes | Beta |

---

## Register an Amazon RDS Database (IAM Auth)

IAM database authentication is strongly preferred over static passwords for RDS and Aurora. Credentials are short-lived (15-minute tokens) generated automatically by STREAMINGPLUS.

```bash
sp connections databases add \
  --name rds-analytics \
  --provider aws-rds \
  --engine postgres \
  --host analytics.cluster-xyz.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --database analytics \
  --iam-auth \
  --role-arn arn:aws:iam::123456789012:role/streamingplus-rds-connect \
  --iam-user sp_pipeline_user \
  --region us-east-1
```

### Prerequisites for RDS IAM auth

Enable IAM authentication on the RDS instance:

```bash
aws rds modify-db-instance \
  --db-instance-identifier analytics \
  --enable-iam-database-authentication \
  --apply-immediately
```

Create the database user with `rds_iam` role:

```sql
CREATE USER sp_pipeline_user WITH LOGIN;
GRANT rds_iam TO sp_pipeline_user;
GRANT CONNECT ON DATABASE analytics TO sp_pipeline_user;
GRANT USAGE ON SCHEMA public TO sp_pipeline_user;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO sp_pipeline_user;
```

:::tip
Use IAM database authentication whenever possible. It eliminates long-lived database passwords, integrates with AWS CloudTrail for audit logging, and supports automatic credential rotation without any pipeline downtime.
:::

---

## Register an Amazon RDS Database (Static Credentials)

```bash
sp connections databases add \
  --name rds-dev \
  --provider aws-rds \
  --engine postgres \
  --host dev.cluster-xyz.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --database devdb \
  --username sp_user \
  --password "$(aws secretsmanager get-secret-value --secret-id rds/dev/sp-password --query SecretString --output text)"
```

---

## Register a Google Cloud SQL Database (Workload Identity)

STREAMINGPLUS uses the **Cloud SQL Auth Proxy** pattern with Workload Identity when connecting to Cloud SQL, eliminating the need for public IP access or static service account keys.

```bash
sp connections databases add \
  --name cloudsql-prod \
  --provider cloud-sql \
  --engine postgres \
  --instance my-gcp-project:us-central1:prod-postgres \
  --database analytics \
  --workload-identity \
  --gcp-service-account sp-db@my-gcp-project.iam.gserviceaccount.com \
  --iam-user sp_pipeline_user
```

Grant the service account the `cloudsql.instanceUser` IAM role:

```bash
gcloud projects add-iam-policy-binding my-gcp-project \
  --member="serviceAccount:sp-db@my-gcp-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.instanceUser"

gcloud projects add-iam-policy-binding my-gcp-project \
  --member="serviceAccount:sp-db@my-gcp-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

---

## Register an Azure Database

```bash
sp connections databases add \
  --name azure-db-prod \
  --provider azure-database \
  --engine postgres \
  --host prod-postgres.postgres.database.azure.com \
  --port 5432 \
  --database analytics \
  --managed-identity \
  --client-id 00000000-0000-0000-0000-000000000000
```

---

## Register a Self-Hosted Database

```bash
sp connections databases add \
  --name self-hosted-postgres \
  --provider self-hosted \
  --engine postgres \
  --host postgres.internal.example.com \
  --port 5432 \
  --database analytics \
  --username sp_user \
  --password "$(cat /run/secrets/db-password)" \
  --ssl-mode verify-full \
  --ca-cert-path /path/to/ca.crt
```

---

## Grant Pipeline Access to a Database

By default, database connections are not available to all pipelines. Use access grants to authorize specific namespaces or pipelines:

```yaml
apiVersion: streamingplus.io/v1
kind: DatabaseAccessGrant
metadata:
  name: analytics-db-grant
  namespace: data-platform
spec:
  connection: rds-analytics
  allowedNamespaces:
    - data-platform
    - reporting
  allowedPipelines:
    - payment-enricher
    - clickstream-aggregator
  permissions:
    - SELECT
    - INSERT
    - UPDATE
  schemas:
    - public
    - reporting
```

```bash
sp apply -f database-access-grant.yaml
```

---

## Connection Pooling Configuration

STREAMINGPLUS maintains a connection pool per `DatabaseConnection` to avoid exhausting database connection limits. The pool is shared across all pipeline operators that reference the same connection within a cluster.

```yaml
apiVersion: streamingplus.io/v1
kind: DatabaseConnection
metadata:
  name: rds-analytics
  namespace: platform
spec:
  provider: aws-rds
  engine: postgres
  host: analytics.cluster-xyz.us-east-1.rds.amazonaws.com
  port: 5432
  database: analytics
  iamAuth:
    enabled: true
    roleArn: arn:aws:iam::123456789012:role/streamingplus-rds-connect
    iamUser: sp_pipeline_user
    region: us-east-1
  pool:
    minConnections: 2
    maxConnections: 20
    acquireTimeout: 5s
    idleTimeout: 10m
    maxLifetime: 30m
    testOnBorrow: true
    testQuery: "SELECT 1"
  ssl:
    mode: verify-full
    caSecretRef:
      name: rds-ca-cert
      key: ca.crt
```

| Pool Parameter | Default | Description |
|---|---|---|
| `minConnections` | `1` | Minimum connections kept open in the pool. |
| `maxConnections` | `10` | Maximum connections per pool instance. |
| `acquireTimeout` | `5s` | Maximum time to wait for a connection from the pool. |
| `idleTimeout` | `10m` | Time before idle connections are closed. |
| `maxLifetime` | `30m` | Maximum age of any connection in the pool. |
| `testOnBorrow` | `false` | Run `testQuery` before returning a connection to verify it is alive. |

:::warning
Set `maxConnections` conservatively. STREAMINGPLUS runs multiple operator pods per pipeline, and each pod maintains its own pool. Total connections = `maxConnections` × `operatorReplicas`. Exceeding the database's `max_connections` limit will cause connection errors across all dependent pipelines.
:::

---

## Listing and Describing Database Connections

```bash
sp connections databases list
```

```
NAME                  PROVIDER      ENGINE     STATUS      POOL-USED   AGE
rds-analytics         aws-rds       postgres   connected   8/20        14d
cloudsql-prod         cloud-sql     postgres   connected   3/10        7d
azure-db-prod         azure-db      postgres   connected   2/10        3d
self-hosted-postgres  self-hosted   postgres   degraded    0/10        1d
```

```bash
sp connections databases describe rds-analytics
```

```
Name:           rds-analytics
Provider:       aws-rds
Engine:         postgres
Host:           analytics.cluster-xyz.us-east-1.rds.amazonaws.com
Port:           5432
Database:       analytics
Auth:           IAM (role: arn:aws:iam::123456789012:role/streamingplus-rds-connect)
Status:         connected
Pool:           8 / 20 connections active
Last Query:     1s ago
SSL Mode:       verify-full
```
