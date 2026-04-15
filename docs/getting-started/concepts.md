---
id: concepts
sidebar_label: Core Concepts
title: Core Concepts
---

# Core Concepts

Understanding STREAMINGPLUS starts with its vocabulary. This page defines the core concepts you will encounter throughout the platform — in the CLI, the API, the UI, and the documentation.

---

## The Resource Model

STREAMINGPLUS uses a **declarative resource model** inspired by Kubernetes. Every piece of infrastructure is described as a YAML manifest with four required top-level fields:

```yaml
apiVersion: streamingplus.io/v1
kind: <ResourceType>
metadata:
  name: my-resource
  environment: dev          # optional, scopes the resource to an environment
spec:
  # Resource-specific configuration
```

Resources are applied with `sp apply`, deleted with `sp delete`, and listed with `sp get`. The platform continuously **reconciles** the actual state of your infrastructure to match what is described in your manifests.

---

## Core Concepts

### Control Plane

The **Control Plane** is the brain of STREAMINGPLUS. It is a set of Kubernetes-native services that you deploy once (either as SaaS or self-hosted via Helm) and that manage all connected data plane clusters.

The control plane is responsible for:
- Accepting and validating API requests from the `sp` CLI and REST/gRPC clients.
- Evaluating resource changes against the Policy Engine.
- Scheduling workloads to appropriate data plane clusters.
- Running the GitOps Reconciler to watch connected Git repositories.
- Storing desired state in its internal etcd-backed store.

**You interact with the control plane through the `sp` CLI or the STREAMINGPLUS API.**

---

### Data Plane

The **Data Plane** is where your actual streaming workloads run. Each data plane cluster runs the `sp-agent` — a lightweight DaemonSet that:
- Maintains a persistent mTLS gRPC connection to the control plane.
- Receives reconciled desired state and applies it locally.
- Reports observed state (health, metrics, events) back to the control plane.
- Provisions cloud-native streaming resources (Kafka topics, Kinesis streams, Pub/Sub subscriptions) on behalf of the platform.

You can have any number of data plane clusters — across clouds, regions, or on-premises data centers — all managed from a single control plane.

---

### Environments

An **Environment** is a logical partition within a workspace. It maps to a scoped set of credentials, policies, resource quotas, and cluster targets. Typical environments include `dev`, `staging`, and `production`.

Resources are always scoped to an environment. An environment definition looks like:

```yaml
apiVersion: streamingplus.io/v1
kind: Environment
metadata:
  name: production
spec:
  clusterTargets:
    - name: prod-us-east
      weight: 70
    - name: prod-eu-west
      weight: 30
  quotas:
    maxPipelines: 50
    maxConnections: 100
  policies:
    - name: require-slo
    - name: no-public-endpoints
```

---

### Deployments

A **Deployment** represents a versioned rollout of a streaming application. It is the highest-level abstraction for packaging a set of related resources (pipelines, connections, transforms) and managing their lifecycle.

Deployments support:
- **Rolling updates** — new versions roll out gradually, with health checks gating promotion.
- **Canary** — route a percentage of traffic to the new version before full rollout.
- **Rollback** — revert to the previous version with a single CLI command.

```bash
sp deployment rollout status my-deployment
sp deployment rollback my-deployment --revision 3
```

---

### GitOps Sources

A **GitOps Source** connects STREAMINGPLUS to a Git repository. Once configured, the GitOps Reconciler watches the repository for changes and automatically applies matching YAML manifests to the target environment when commits land on the configured branch.

A GitOps Source manifest:

```yaml
apiVersion: streamingplus.io/v1
kind: GitOpsSource
metadata:
  name: platform-gitops
spec:
  url: https://github.com/acme-corp/streaming-infra.git
  branch: main
  path: ./environments/production
  syncInterval: 60s
  secretRef:
    name: github-deploy-key
```

GitOps Sources support:
- HTTPS with token authentication.
- SSH with deploy keys.
- Webhook-triggered sync (in addition to polling).

---

### Connections

A **Connection** is a configuration object that describes how STREAMINGPLUS communicates with an external data system. There are two subtypes:

**SourceConnection** — Describes an inbound data stream. Examples:
- A Kafka topic on MSK
- A Kinesis stream
- An HTTP webhook endpoint
- A file watch on S3

**SinkConnection** — Describes an outbound data destination. Examples:
- A PostgreSQL table
- A Pub/Sub topic
- An S3 bucket prefix
- A webhook URL
- A log output (for development)

Connections hold credentials by reference (via `SecretRef`) and define protocol-specific configuration. They are reusable across multiple pipelines.

---

### Pipelines

A **Pipeline** is the central processing unit of STREAMINGPLUS. It wires a source to a sink through an ordered sequence of **transforms**.

Pipelines support:
- **Filter** — Drop events matching a CEL expression.
- **Enrich** — Add computed fields to events.
- **Map** — Reshape event structure with a JSONata or jq expression.
- **Aggregate** — Window-based aggregation (tumbling, sliding, session windows).
- **Branch** — Conditional routing to multiple sinks.
- **Dead Letter Queue (DLQ)** — Route failed events to a secondary sink.

Pipelines scale horizontally. Each pipeline can be configured with `minReplicas` and `maxReplicas`, and STREAMINGPLUS autoscales based on throughput and lag metrics.

---

### Reconciler

The **Reconciler** (also called the GitOps Reconciler or `sp-sync`) is the component that continuously compares **desired state** (what you declared in YAML) against **observed state** (what the data plane agents report) and drives the system toward convergence.

The reconciliation loop:
1. Reads the current desired state from the control plane store.
2. Reads the current observed state from all connected agents.
3. Computes a diff.
4. Generates and dispatches operations to close the gap.
5. Waits for agents to report back completion.
6. Updates observed state.

Reconciliation runs continuously. If an agent crashes, a cluster becomes unreachable, or a resource drifts from its declared state (e.g., a Kafka topic is manually deleted), the reconciler will detect and heal the drift automatically.

---

## Quick Reference Table

| Concept | Kind | What It Does |
|---|---|---|
| **Control Plane** | N/A (platform component) | Central API, scheduler, policy, and GitOps engine |
| **Data Plane** | N/A (platform component) | Per-cluster agent that runs workloads |
| **Environment** | `Environment` | Logical partition with cluster targets and quotas |
| **Deployment** | `Deployment` | Versioned rollout of a streaming application |
| **GitOps Source** | `GitOpsSource` | Git repository wired for automatic reconciliation |
| **Source Connection** | `SourceConnection` | Inbound data stream configuration |
| **Sink Connection** | `SinkConnection` | Outbound data destination configuration |
| **Pipeline** | `Pipeline` | Source → Transforms → Sink processing unit |
| **Reconciler** | N/A (platform component) | Continuously converges desired and observed state |
| **Secret** | `Secret` | Encrypted credential referenced by connections |
| **SLO** | `SLO` | Service Level Objective for a pipeline or deployment |
| **RBAC Policy** | `RBACPolicy` | Fine-grained access control for platform resources |

---

## Concept Relationships

```
Organization
└── Workspace
    ├── Environment (dev / staging / prod)
    │   ├── Deployment
    │   │   ├── Pipeline
    │   │   │   ├── SourceConnection
    │   │   │   ├── Transforms
    │   │   │   └── SinkConnection
    │   │   └── SLO
    │   └── RBACPolicy
    ├── GitOpsSource (watches Git, reconciles Environments)
    └── Secret (referenced by Connections)
```

---

## Next Steps

- [Architecture](../platform/architecture.md) — Learn how the control plane components and data plane agents work together.
- [Data Model](../platform/data-model.md) — Full YAML reference for every resource type.
- [GitOps Guide](../gitops/overview.md) — Configure your Git repository as the source of truth.
- [CLI Reference](../reference/cli.md) — All `sp` commands explained.
