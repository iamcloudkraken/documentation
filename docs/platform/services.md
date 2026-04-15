---
id: services
sidebar_label: Services
title: Platform Services
---

# Platform Services

STREAMINGPLUS is composed of a set of discrete, independently deployable services. Each service has a clearly defined responsibility, health endpoint, and configuration surface. This page provides a reference for all control plane services and their default configuration.

---

## Service Overview

| Service | Kubernetes Name | Purpose | Default Port |
|---|---|---|---|
| API Gateway | `sp-api` | Primary REST and gRPC API server for all external and internal clients | `8443` (TLS) |
| Scheduler | `sp-scheduler` | Assigns workloads to data plane clusters based on affinity and quotas | `9090` (internal gRPC) |
| Policy Engine | `sp-policy` | Evaluates OPA-based admission policies on all write operations | `8181` (internal HTTP) |
| GitOps Reconciler | `sp-sync` | Watches Git repositories and reconciles manifests into desired state | `8080` (webhook) |
| Metrics Collector | `sp-metrics` | Aggregates runtime metrics from agents; exposes Prometheus endpoint | `9100` |
| State Store | `sp-store` | etcd-backed persistent store for all desired and observed state | `2379` / `2380` |

---

## API Gateway (`sp-api`)

The API Gateway is the front door to the STREAMINGPLUS platform. Every `sp` CLI command, every CI/CD integration, and every STREAMINGPLUS UI interaction routes through `sp-api`.

### Responsibilities

- **Authentication** — Validates API tokens, OIDC JWTs, and service account tokens on every request.
- **Authorization** — Enforces RBAC policies defined in `RBACPolicy` resources.
- **Schema validation** — Rejects malformed resource manifests before they reach the store.
- **Admission control** — Calls `sp-policy` synchronously before committing writes.
- **Watch streams** — Provides long-lived streaming endpoints for CLI watch, UI live updates, and agent state delivery.
- **Rate limiting** — Per-token rate limits configurable in the control plane Helm values.

### Endpoints

| Path | Method | Description |
|---|---|---|
| `/healthz` | GET | Liveness probe. Returns `200 OK` when the server can accept requests. |
| `/readyz` | GET | Readiness probe. Returns `200 OK` when connected to the store and policy engine. |
| `/metrics` | GET | Prometheus metrics for the API server itself (request latency, error rates). |
| `/v1/...` | GET/POST/PUT/DELETE/PATCH | Resource CRUD operations. See the API Reference for full paths. |
| `/v1/watch/...` | GET (SSE) | Server-sent event stream for real-time resource change notifications. |

### Configuration

Key Helm values for `sp-api`:

```yaml
controlPlane:
  api:
    replicas: 2
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 2000m
        memory: 2Gi
    rateLimit:
      requestsPerMinutePerToken: 1000
    tls:
      enabled: true
      secretName: streamingplus-tls
    audit:
      enabled: true
      logLevel: metadata   # metadata | request | requestresponse
```

---

## Scheduler (`sp-scheduler`)

The Scheduler is responsible for placement decisions: given a `Pipeline` or `Deployment`, which data plane cluster should run it?

### Responsibilities

- **Cluster selection** — Evaluates `clusterTargets` defined on `Environment` resources.
- **Weight-based distribution** — Distributes workloads proportionally to configured weights when multiple clusters are targeted.
- **Resource-aware scheduling** — Checks live resource availability reported by agents before placing workloads.
- **Bin packing** — Optimizes cluster utilization by preferring clusters with available headroom.
- **Rescheduling** — Detects cluster failures and reschedules affected workloads to healthy clusters.
- **Leader election** — Runs in active-passive mode with leader election via etcd; the standby takes over within 10 seconds of leader failure.

### Scheduling Algorithm

```
For each unscheduled workload:
  1. Filter clusters by environment clusterTargets
  2. Filter out clusters below health threshold (< 80% healthy agents)
  3. Filter out clusters that would exceed quota after placement
  4. Score remaining clusters:
       - Weighted by clusterTarget.weight
       - Bonus for clusters with more headroom
       - Penalty for clusters running the same pipeline (spread)
  5. Select highest-scoring cluster
  6. Write assignment to sp-store
```

### Configuration

```yaml
controlPlane:
  scheduler:
    replicas: 2
    rescheduleOnFailureAfter: 30s
    healthThreshold: 0.8
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
```

---

## Policy Engine (`sp-policy`)

The Policy Engine embeds an Open Policy Agent (OPA) instance and acts as the platform's admission controller. It is called synchronously by `sp-api` on every write operation (create, update, delete).

### How Policies Are Evaluated

When a resource write request arrives at `sp-api`:

1. `sp-api` constructs an admission review object containing the requested resource, the caller's identity, and the current state of the resource (if an update).
2. The review is sent to `sp-policy` via an internal HTTP call.
3. `sp-policy` evaluates the request against all loaded policy bundles.
4. If any policy returns `deny`, `sp-api` rejects the request and returns the deny reasons to the caller.
5. If all policies pass, `sp-api` proceeds to write the resource.

### Built-in Policy Categories

| Category | Example Rules |
|---|---|
| **Schema** | All resources must have `metadata.name` matching `^[a-z0-9-]{1,63}$` |
| **Namespace isolation** | Resources in workspace A cannot reference resources in workspace B |
| **Environment protection** | Resources in environments tagged `protected: true` require 2+ approvers (via GitOps PR) |
| **Sink safety** | Public HTTP sinks are blocked in environments tagged `tier: production` |
| **SLO gate** | Deployments cannot proceed to production without an attached SLO |
| **Secret hygiene** | Inline credentials in `spec` are rejected; use `secretRef` instead |

### Custom Policies

Load your own OPA Rego policies by pointing `sp-policy` at a bundle URL:

```yaml
controlPlane:
  policy:
    bundleUrl: https://opa-bundles.example.com/streamingplus/v1/bundle.tar.gz
    bundlePollInterval: 60s
```

Or create `RBACPolicy` resources using the STREAMINGPLUS API, which are loaded dynamically without a bundle reload.

### Health Endpoints

| Path | Description |
|---|---|
| `/health` | Liveness probe |
| `/v1/policies` | Lists all loaded policies (internal, not exposed externally) |

### Configuration

```yaml
controlPlane:
  policy:
    replicas: 2
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
    audit:
      logDenials: true
```

---

## GitOps Reconciler (`sp-sync`)

`sp-sync` is the GitOps engine that keeps STREAMINGPLUS resources in sync with connected Git repositories. It watches `GitOpsSource` resources and drives continuous reconciliation.

### Reconciliation Lifecycle

```
Poll / webhook trigger
        │
        ▼
Fetch latest commit SHA from Git
        │
        ├── No change since last sync ──▶ Sleep until next interval
        │
        ▼
Clone / shallow fetch changed files
        │
        ▼
Parse and validate YAML manifests
        │
        ├── Validation error ──▶ Update GitOpsSource.status.lastError, stop
        │
        ▼
Compute diff vs. current sp-store state
        │
        ▼
Submit adds, updates, deletes to sp-api
        │
        ▼
Update GitOpsSource.status.lastSyncedCommit and lastSyncTime
```

### Sync Status

Query sync status for a GitOps source:

```bash
sp get gitopssource platform-gitops -o yaml
```

```yaml
status:
  lastSyncedCommit: "a3f91bc"
  lastSyncTime: "2026-04-14T09:00:00Z"
  phase: Synced
  conditions:
    - type: Ready
      status: "True"
```

### Webhook Support

Configure your Git provider to send push webhooks to `sp-sync` for near-instant reconciliation:

```
POST https://sp.example.com/webhooks/sync
Headers:
  X-SP-Source-Name: platform-gitops
  X-Hub-Signature-256: <HMAC>
```

### Configuration

```yaml
controlPlane:
  gitops:
    syncInterval: 60s
    webhookEnabled: true
    webhookHmacSecretRef:
      name: gitops-webhook-secret
      key: hmac-secret
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
```

---

## Metrics Collector (`sp-metrics`)

`sp-metrics` aggregates runtime telemetry from all connected `sp-agent` instances and exposes a consolidated Prometheus-compatible `/metrics` endpoint.

### Metrics Exposed

| Metric | Type | Description |
|---|---|---|
| `sp_pipeline_events_total` | Counter | Total events processed per pipeline |
| `sp_pipeline_bytes_total` | Counter | Total bytes processed per pipeline |
| `sp_pipeline_lag_seconds` | Gauge | Consumer lag for each pipeline (seconds behind head) |
| `sp_agent_connected` | Gauge | 1 if agent is connected to control plane, 0 otherwise |
| `sp_reconcile_duration_seconds` | Histogram | Time for the reconciler to process a change |
| `sp_reconcile_errors_total` | Counter | Total reconciliation errors |
| `sp_policy_eval_duration_seconds` | Histogram | OPA policy evaluation latency |
| `sp_api_requests_total` | Counter | API requests by method, path, and status code |
| `sp_api_request_duration_seconds` | Histogram | API request latency |

### Prometheus Integration

Enable a `ServiceMonitor` (requires Prometheus Operator):

```yaml
metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    namespace: monitoring
    labels:
      release: prometheus
    interval: 30s
```

### Grafana Dashboards

Import the official STREAMINGPLUS Grafana dashboard from the [dashboard repository](https://github.com/streamingplus/grafana-dashboards). Dashboard IDs:

| Dashboard | Grafana ID |
|---|---|
| Platform Overview | `19042` |
| Pipeline Detail | `19043` |
| Agent Health | `19044` |

### Configuration

```yaml
metrics:
  enabled: true
  port: 9100
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
```

---

## State Store (`sp-store`)

`sp-store` is an etcd cluster that persists all STREAMINGPLUS desired state and observed state. It is accessed exclusively by `sp-api` and `sp-scheduler` — no other component reads from or writes to etcd directly.

### Production Recommendations

- Run a **3-node etcd cluster** for quorum and fault tolerance.
- Use **dedicated SSD-backed storage** with at least 20 GB provisioned.
- Enable **etcd automatic compaction** to prevent unbounded growth:

```yaml
persistence:
  etcd:
    autoCompactionRetention: "1h"
    quotaBackendBytes: 8589934592   # 8 GB
```

### Backup

Back up etcd regularly using the built-in `sp admin etcd backup` command:

```bash
sp admin etcd backup --output s3://my-bucket/sp-backups/
```

Restore from backup:

```bash
sp admin etcd restore --from s3://my-bucket/sp-backups/snapshot-2026-04-14.db
```

---

## Next Steps

- [Architecture](./architecture.md) — How all these services fit together in a deployment topology.
- [Data Model](./data-model.md) — YAML reference for all resource types stored in `sp-store`.
- [Authentication](./auth.md) — How identity and access control are enforced across services.
