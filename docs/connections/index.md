---
id: index
sidebar_label: Overview
title: Connections
---

# Connections

Connections are **named resources** in STREAMINGPLUS that represent external systems your platform integrates with. They encapsulate authentication credentials, endpoint configuration, and health-check metadata in a single reusable object. Once registered, a connection can be referenced by name across pipelines, deployments, GitOps sources, and observability configurations — without embedding secrets inline.

Connections are managed through the `sp` CLI and stored encrypted in the STREAMINGPLUS control plane. Credential rotation, access grants, and health status are all surfaced through the same unified interface.

---

## Connection Types

| Type | Resource Kind | Status |
|---|---|---|
| [Kubernetes Clusters](./clusters) | `ClusterConnection` | ![GA](https://img.shields.io/badge/GA-brightgreen) |
| [Container Registries](./registries) | `RegistryConnection` | ![GA](https://img.shields.io/badge/GA-brightgreen) |
| [Network Connectivity](./network) | `NetworkConnection` | ![GA](https://img.shields.io/badge/GA-brightgreen) |
| [Observability Backends](./observability) | `ObservabilityConnection` | ![GA](https://img.shields.io/badge/GA-brightgreen) |
| [Source Control](./source-control) | `SourceControlConnection` | ![GA](https://img.shields.io/badge/GA-brightgreen) |
| [Databases](./databases) | `DatabaseConnection` | ![Beta](https://img.shields.io/badge/Beta-blue) |

---

## Managing Connections

### List all connections

```bash
sp connections list
```

Example output:

```
NAME                  TYPE          STATUS        AGE
prod-eks-us-east      cluster       connected     14d
staging-gke           cluster       connected     7d
ecr-prod              registry      connected     21d
grafana-cloud         observability connected     10d
github-org            source-control connected    30d
rds-analytics         database      degraded      3d
```

### Describe a connection

```bash
sp connections describe <connection-name>
```

```bash
sp connections describe prod-eks-us-east
```

Output includes endpoint metadata, last health-check timestamp, associated labels, and access grant summary.

### Delete a connection

```bash
sp connections delete <connection-name>
```

:::warning
Deleting a connection that is actively referenced by a pipeline or deployment will cause reconciliation errors. Always remove or update dependent resources before deleting a connection.
:::

```bash
sp connections delete rds-analytics --force
```

The `--force` flag removes the connection record even if dependent resources exist. Dependent resources will enter a `degraded` state until their connection reference is updated.

---

## Connection States

Every connection maintains a lifecycle state that reflects the health of the underlying integration. STREAMINGPLUS continuously probes each connection and updates its state accordingly.

| State | Description |
|---|---|
| `connected` | The connection is healthy and all health checks are passing. |
| `degraded` | The connection is reachable but one or more health checks are failing. Dependent resources may still function with reduced reliability. |
| `disconnected` | The connection cannot be reached. All dependent resources are affected. Investigate credentials, network policies, or the remote system. |
| `pending` | The connection was recently created or updated and health checks have not yet completed. Typically resolves within 30–60 seconds. |

### Monitoring connection state

You can filter connections by state using the `--status` flag:

```bash
sp connections list --status degraded
sp connections list --status disconnected
```

Set up alerts when a connection enters a degraded or disconnected state by integrating with your observability backend. STREAMINGPLUS automatically emits the `streamingplus_connection_health` metric to any connected Prometheus or OpenTelemetry backend.

---

## Connection Labels

All connections support arbitrary labels for organizational purposes. Labels can be used to filter connections in the CLI and to constrain pipeline scheduling to specific environments.

```bash
sp connections label prod-eks-us-east env=production region=us-east-1
```

```bash
sp connections list --selector env=production
```

---

## Access Control

Connections are owned by an organization and can be shared across teams using access grants. By default, only the team that created the connection can reference it in workloads.

```bash
sp connections grant prod-eks-us-east --team platform-team --role viewer
sp connections grant prod-eks-us-east --team data-engineering --role editor
```

Roles:

| Role | Permissions |
|---|---|
| `viewer` | List and describe the connection. Cannot use in new deployments. |
| `editor` | Full read/write. Can reference in deployments. Cannot delete. |
| `admin` | Full control including deletion and access management. |

---

## Secret Storage

Credentials stored in connections are encrypted at rest using AES-256-GCM and are never returned in plaintext through any API or CLI command. To rotate credentials, use the `sp connections update` command for each connection type.

:::tip
STREAMINGPLUS integrates with external secret managers (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) for organizations that prefer to manage credentials outside the control plane. See the [Secrets Integration](../integrations/secrets) guide for details.
:::

---

## Next Steps

- [Register a Kubernetes cluster](./clusters)
- [Connect a container registry](./registries)
- [Set up observability backends](./observability)
- [Connect source control for GitOps](./source-control)
