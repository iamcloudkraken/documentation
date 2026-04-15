---
id: changelog
sidebar_label: Changelog
title: Changelog
---

# Changelog

All notable changes to STREAMINGPLUS are documented here. STREAMINGPLUS follows [Semantic Versioning](https://semver.org/).

---

## v1.3.0 — 2026-03-15

### Added

- **Sources GA**: All source connectors are now generally available: Kafka, Amazon Kinesis, Amazon S3, Google Pub/Sub, Azure Event Hubs, PostgreSQL CDC (via Debezium), MySQL CDC, MongoDB CDC, HTTP Push
- **Sinks GA**: All sink connectors are now generally available: Amazon S3, Google BigQuery, Snowflake, PostgreSQL, Apache Kafka, Elasticsearch / OpenSearch, HTTP / Webhook
- **Snowflake Sink**: New Snowpipe Streaming-based Snowflake sink with sub-second delivery latency and per-channel deduplication
- **Schema Registry Support**: Avro sources can now resolve schemas from Confluent Schema Registry, AWS Glue Schema Registry, and Apicurio Registry
- **BigQuery Storage Write API**: BigQuery sink now uses the Storage Write API v2 for exactly-once delivery (replaces legacy streaming inserts)
- **Elasticsearch Upsert**: Elasticsearch sink supports `writeMode: upsert` with optional Painless script for conditional updates
- **HTTP Sink HMAC Auth**: HTTP/Webhook sink now supports HMAC-SHA256 request signing (GitHub-compatible format)
- **GitOps PR Checks**: STREAMINGPLUS can now post deployment diff comments on GitHub Pull Requests and block merges until validation passes
- **SLO Burn Rate Alerts**: `AlertRule` resources now support burn-rate-based alerting for multi-window alerting (2-hour and 6-hour windows)
- **`sp connections observability`**: New CLI command group for connecting Datadog, Prometheus, Grafana Cloud, and PagerDuty
- **Azure UAMI Support**: Azure integration now uses User-Assigned Managed Identities (UAMI) via Azure AD Workload Identity

### Changed

- `sp apply` now renders a colored diff preview before applying changes; use `--no-diff` to skip
- GitOps reconcile default poll interval reduced from 60 seconds to 30 seconds
- Canary analysis metrics are now evaluated on every step (not just at step boundaries)
- Kafka sink `exactlyOnce: true` now automatically sets `maxInFlightRequestsPerConnection: 1`
- The `sp diagnostics bundle` command now includes the last 500 lines of Reconciler logs by default

### Fixed

- Canary analysis was incorrectly rolling back when the error rate was exactly equal to (not exceeding) the threshold
- ECR credential rotation failing for cross-account setups using assumed roles
- BigQuery sink failing to evolve schema when a new column name contained uppercase letters
- `sp gitops sync --force` was not resetting the poll timer, causing a redundant sync 30 seconds later
- PostgreSQL sink connection pool was not respecting `maxLifetimeMs`, causing stale connections after 30 minutes

---

## v1.2.0 — 2026-01-20

### Added

- **AKS Support**: Azure Kubernetes Service (AKS) clusters can now be connected as STREAMINGPLUS environments using User-Assigned Managed Identity
- **GitOps Kustomize**: The Reconciler now natively supports Kustomize overlays and bases. No separate Kustomize installation required
- **`sp gitops sync --force`**: New command to immediately trigger a reconcile cycle, bypassing the poll interval
- **PagerDuty Integration**: Native PagerDuty alerting integration with routing keys and escalation policy support
- **Pipeline Notifications**: Pipeline resources now support Slack, email, and webhook notifications for stage transitions and approval requests
- **Deployment `wait` command**: `sp deployments wait <name>` blocks until the deployment is healthy or the timeout is reached (useful in CI pipelines)
- **GitOps Prune**: `GitOpsSource` resources now support `prune: true` to delete resources that have been removed from Git
- **RBAC Service Accounts**: New `sp rbac service-accounts` command group for managing machine-to-machine API access without personal tokens

### Changed

- `sp deployments logs` now defaults to `--tail 100` (previously returned all logs, which could overwhelm terminals on busy services)
- Vault dynamic secret TTL can now be configured per-`Connection` resource using `vault.ttl`
- The `sp diff` command now highlights field-level changes (not just resource-level changes)
- Helm chart default worker replicas minimum increased from 1 to 2 for better availability

### Fixed

- GitOps source was not detecting file renames — renamed manifests were being applied as new resources without deleting the old ones
- `sp envs delete` was hanging when the environment had Deployments in `Terminating` state
- Snowflake sink was not retrying on `STATEMENT_TIMEOUT_IN_SECONDS` errors
- Pipeline approval gate timeout was not being enforced when the approver list was empty

---

## v1.1.0 — 2025-11-05

### Added

- **General Availability Release** — STREAMINGPLUS v1.1.0 is the first GA release
- **AWS Integration**: IRSA-based authentication for S3, Kinesis, MSK, Secrets Manager
- **GCP Integration**: Workload Identity Federation for BigQuery, GCS, Pub/Sub, Secret Manager
- **Azure Integration**: Managed Identity for Blob Storage, Event Hubs, Key Vault
- **Datadog Integration**: Auto-forwarding of metrics, logs, APM traces, and SLO sync
- **HashiCorp Vault Integration**: Kubernetes auth, KV v2, and Database dynamic secrets
- **GitHub Integration**: OIDC keyless deploy from GitHub Actions, GitOps repo sync, PR status checks
- **Delivery Pipelines**: Multi-stage promotion with rolling, canary, blue-green, and recreate strategies
- **Canary Analysis**: Metric-based canary promotion/rollback using Prometheus and Datadog
- **Approval Gates**: Manual approval gates in Pipelines with configurable approver groups and timeout
- **Terraform Provider v1.0**: `streamingplus_environment`, `streamingplus_deployment`, `streamingplus_connection` resources
- **RBAC**: Owner, Admin, Developer, Viewer roles with `RBACPolicy` for fine-grained access control
- **Audit Logging**: Immutable audit log for all API actions, exportable to S3 and Datadog
- **`sp` CLI v1.1.0**: Full CLI for all management operations
- **Python, Go, and Java SDKs**: Official client libraries for the STREAMINGPLUS API
- **SOC 2 Type II certification** completed
