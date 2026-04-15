---
id: data-model
sidebar_label: Data Model
title: Data Model
---

# Data Model

STREAMINGPLUS uses a declarative resource model. Every resource is described using the same four top-level fields:

```yaml
apiVersion: streamingplus.io/v1
kind: <ResourceType>
metadata:
  name: <name>
  namespace: <workspace>       # maps to your STREAMINGPLUS workspace
  environment: <env-name>      # optional: scopes to a specific environment
  labels: {}                   # arbitrary key/value labels
  annotations: {}              # arbitrary key/value annotations
spec:
  # Resource-specific fields
status:
  # Populated by the platform; do not set manually
```

Resources are managed with the `sp` CLI:

```bash
sp apply -f resource.yaml       # create or update
sp get <kind>/<name>            # read
sp delete <kind>/<name>         # delete
sp describe <kind>/<name>       # rich status output
```

---

## Resource Types

### Environment

Defines a logical deployment environment (e.g., `dev`, `staging`, `production`). Environments are the primary partition for resource scoping, quota enforcement, and cluster targeting.

```yaml
apiVersion: streamingplus.io/v1
kind: Environment
metadata:
  name: production
  namespace: acme-corp
  labels:
    tier: production
    region: us-east-1
spec:
  description: "Production environment — US East"
  clusterTargets:
    - name: prod-us-east-1
      weight: 70
    - name: prod-us-west-2
      weight: 30
  quotas:
    maxPipelines: 100
    maxConnections: 200
    maxCpuMillicores: 32000
    maxMemoryMi: 65536
  policies:
    - name: require-slo
    - name: no-public-sinks
  annotations:
    owner: platform-team@example.com
```

---

### Deployment

Represents a versioned, managed rollout of a streaming application. A Deployment groups related Pipelines and Connections and manages their lifecycle as a unit.

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: order-events-pipeline
  namespace: acme-corp
  environment: production
spec:
  description: "Processes order events from Kafka to the data warehouse"
  version: "2.3.1"
  strategy:
    type: RollingUpdate       # RollingUpdate | Canary | Recreate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  resources:
    - kind: Pipeline
      name: order-events-transform
    - kind: SourceConnection
      name: orders-kafka-source
    - kind: SinkConnection
      name: warehouse-sink
  sloRef:
    name: order-pipeline-slo
  annotations:
    git-commit: "a3f91bc"
    deployed-by: "ci-bot"
```

---

### Secret

Stores encrypted credentials that can be referenced by Connections and other resources. Secret values are encrypted at rest using AES-256-GCM and are never returned in API responses (only their metadata).

```yaml
apiVersion: streamingplus.io/v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: acme-corp
spec:
  type: Opaque        # Opaque | TLS | BasicAuth | APIKey | OAuth2ClientCredentials
  data:
    username: "<base64-encoded value>"
    password: "<base64-encoded value>"
    # For TLS type:
    # tls.crt: "<base64 PEM>"
    # tls.key: "<base64 PEM>"
```

When using the CLI, you can create secrets from environment variables or files without base64-encoding manually:

```bash
sp create secret kafka-credentials \
  --from-literal=username=my-user \
  --from-literal=password=my-pass
```

---

### Pipeline

The central processing unit. A Pipeline wires a `SourceConnection` to a `SinkConnection` through an ordered list of transforms. Pipelines scale horizontally.

```yaml
apiVersion: streamingplus.io/v1
kind: Pipeline
metadata:
  name: order-events-transform
  namespace: acme-corp
  environment: production
spec:
  description: "Filters, enriches, and routes order events"
  source:
    connectionRef: orders-kafka-source
    options:
      consumerGroup: "sp-order-pipeline"
      fromOffset: latest
  transforms:
    - name: drop-test-orders
      type: filter
      expression: "event.source != 'load-test'"
    - name: add-processing-metadata
      type: enrich
      fields:
        processed_at: "{{ now() }}"
        pipeline_version: "2.3.1"
    - name: reshape-payload
      type: map
      template: |
        {
          "order_id": event.id,
          "customer": event.customer_id,
          "total_usd": event.amount / 100,
          "processed_at": event.processed_at
        }
  sink:
    connectionRef: warehouse-sink
    options:
      batchSize: 500
      flushInterval: 5s
  deadLetterQueue:
    connectionRef: dlq-s3-sink
    maxRetries: 3
    retryBackoff: exponential
  scaling:
    minReplicas: 2
    maxReplicas: 10
    targetLagSeconds: 30
```

---

### SLO

Defines a Service Level Objective for a pipeline or deployment. SLOs are evaluated continuously and feed into the Policy Engine (e.g., to gate production deployments) and alerting.

```yaml
apiVersion: streamingplus.io/v1
kind: SLO
metadata:
  name: order-pipeline-slo
  namespace: acme-corp
  environment: production
spec:
  description: "Order pipeline must process events with < 60s end-to-end latency at p99"
  targets:
    - name: end-to-end-latency
      type: latency
      percentile: p99
      thresholdSeconds: 60
      complianceWindow: 30d
      minimumCompliance: 0.999    # 99.9%
    - name: throughput
      type: throughput
      minimumEventsPerSecond: 1000
    - name: error-rate
      type: errorRate
      maximumErrorRatePct: 0.1
  alerting:
    notifyOnBreach: true
    channels:
      - type: slack
        webhookSecretRef: slack-webhook-secret
      - type: pagerduty
        integrationKeySecretRef: pd-integration-key
```

---

### RBACPolicy

Fine-grained access control resource. `RBACPolicy` resources bind subjects (users, groups, service accounts) to roles with optional resource and environment scopes.

```yaml
apiVersion: streamingplus.io/v1
kind: RBACPolicy
metadata:
  name: data-team-pipeline-access
  namespace: acme-corp
spec:
  description: "Grants the data team read/write access to pipelines in non-production environments"
  bindings:
    - subjects:
        - kind: Group
          name: data-engineering
        - kind: User
          name: alice@example.com
      role: PipelineEditor
      scope:
        environments:
          - dev
          - staging
        kinds:
          - Pipeline
          - SourceConnection
          - SinkConnection
    - subjects:
        - kind: ServiceAccount
          name: ci-bot
      role: Deployer
      scope:
        environments:
          - production
        kinds:
          - Deployment

---
# Built-in roles:
# - Viewer:          Read-only access to all resource types
# - PipelineEditor:  Read/write on Pipelines, Connections; read on Environments
# - Deployer:        Apply Deployments; read-only otherwise
# - Admin:           Full access to all resource types in the workspace
# - SuperAdmin:      Full access including workspace and billing management
```

---

### GitOpsSource

Connects a Git repository to STREAMINGPLUS for automated reconciliation. Manifests in the configured path are applied automatically when commits land on the target branch.

```yaml
apiVersion: streamingplus.io/v1
kind: GitOpsSource
metadata:
  name: platform-infra-repo
  namespace: acme-corp
spec:
  description: "Main GitOps source for all production streaming infrastructure"
  url: https://github.com/acme-corp/streaming-infra.git
  branch: main
  path: ./environments/production
  syncInterval: 60s
  secretRef:
    name: github-deploy-key
    key: ssh-private-key
  webhook:
    enabled: true
    hmacSecretRef:
      name: github-webhook-secret
      key: hmac-secret
  targetEnvironments:
    - production
  pruneOrphanedResources: true
```

---

### SourceConnection

Describes an inbound data stream. The `spec.type` field determines which connector is used; all other `spec.config` fields are connector-specific.

```yaml
apiVersion: streamingplus.io/v1
kind: SourceConnection
metadata:
  name: orders-kafka-source
  namespace: acme-corp
  environment: production
spec:
  type: kafka                   # kafka | kinesis | pubsub | s3 | http | pulsar | nats
  description: "Order events from the MSK production cluster"
  config:
    bootstrapServers: "b-1.msk-prod.amazonaws.com:9094"
    topic: "orders.v2"
    securityProtocol: SASL_SSL
    saslMechanism: SCRAM-SHA-512
  secretRef:
    name: kafka-credentials
  healthCheck:
    enabled: true
    intervalSeconds: 30
```

---

### SinkConnection

Describes an outbound data destination. Like `SourceConnection`, `spec.type` selects the connector.

```yaml
apiVersion: streamingplus.io/v1
kind: SinkConnection
metadata:
  name: warehouse-sink
  namespace: acme-corp
  environment: production
spec:
  type: bigquery               # bigquery | redshift | postgres | s3 | pubsub | kinesis | kafka | http | log
  description: "Google BigQuery — analytics dataset"
  config:
    project: acme-analytics
    dataset: streaming_events
    table: order_events
    createDisposition: CREATE_IF_NEEDED
    writeDisposition: WRITE_APPEND
    partitionField: processed_at
    partitionType: DAY
  secretRef:
    name: bigquery-service-account
  healthCheck:
    enabled: true
    intervalSeconds: 60
```

---

## Status Fields

Every resource has a `status` field populated by the platform. Do not set `status` manually — it will be overwritten. The typical structure:

```yaml
status:
  phase: Running           # Pending | Running | Degraded | Failed | Terminating
  observedGeneration: 5    # Generation that was last successfully reconciled
  conditions:
    - type: Ready
      status: "True"
      lastTransitionTime: "2026-04-14T09:00:00Z"
      reason: ReconcileSuccess
      message: "All resources reconciled successfully"
    - type: Scheduled
      status: "True"
      lastTransitionTime: "2026-04-14T08:59:50Z"
      reason: ClusterAssigned
      message: "Assigned to cluster prod-us-east-1"
  clusterAssignment: prod-us-east-1
  lastSyncedAt: "2026-04-14T09:00:00Z"
```

---

## Naming Conventions

| Field | Constraints |
|---|---|
| `metadata.name` | Lowercase alphanumeric and hyphens; 1–63 characters; must start and end with alphanumeric |
| `metadata.namespace` | Your workspace slug; set automatically if using `sp apply` within a workspace context |
| `metadata.environment` | Must match an existing `Environment` resource name in the workspace |
| Label keys | `[prefix/]name` format; prefix must be a valid DNS subdomain |
| Label values | Alphanumeric, hyphens, underscores, dots; max 63 characters |

---

## Next Steps

- [Architecture](./architecture.md) — How resources flow from YAML to running infrastructure.
- [Authentication](./auth.md) — How secrets and service accounts are used in the platform.
- [CLI Reference](../reference/cli.md) — Full `sp` CLI documentation for managing these resources.
- [API Reference](../api/overview.md) — REST/gRPC API for all resource types.
