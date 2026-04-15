---
id: overview
sidebar_label: Overview
title: GitOps Overview
---

# GitOps Overview

STREAMINGPLUS uses a **pull-based GitOps model** to manage streaming infrastructure. Rather than pushing deployments imperatively, you declare the desired state of your environment in a Git repository. The STREAMINGPLUS Reconciler continuously monitors the repository and applies any changes to the live cluster — automatically, safely, and with full audit history.

## How the Pull-Based Model Works

```
┌──────────────────────────────────────────────────────────┐
│                    Git Repository                         │
│  environments/production/                                 │
│    ├── deployments/payments.yaml                         │
│    ├── connections/kafka.yaml                            │
│    └── slos/payments-availability.yaml                  │
└─────────────────────────┬────────────────────────────────┘
                          │  poll / webhook
                          ▼
┌──────────────────────────────────────────────────────────┐
│              STREAMINGPLUS Reconciler                     │
│  1. Fetch current Git HEAD                               │
│  2. Compare desired state (Git) vs live state (cluster)  │
│  3. Compute diff                                         │
│  4. Apply changes (create / update / delete resources)   │
│  5. Report status back to Git (commit status check)      │
└─────────────────────────┬────────────────────────────────┘
                          │  apply resources
                          ▼
┌──────────────────────────────────────────────────────────┐
│              Live Cluster (Kubernetes)                    │
│  STREAMINGPLUS Operators reconcile resource state        │
└──────────────────────────────────────────────────────────┘
```

The Reconciler runs on a configurable interval (default: 60 seconds for polling; near-instant for webhook-triggered syncs).

## Pull vs Push Comparison

| Aspect | Pull (GitOps) | Push (Imperative) |
|--------|--------------|-------------------|
| Source of truth | Git repository | CI pipeline state |
| Drift detection | Automatic (continuous) | Manual or periodic |
| Rollback mechanism | `git revert` | Re-run old pipeline |
| Audit trail | Git commit history | CI logs (often ephemeral) |
| Cluster credentials in CI | Not required | Required |
| Multi-cluster | Single repo, multiple targets | One pipeline per cluster |
| Access control | Git branch protection | CI system permissions |

:::note
In pull-based GitOps, the CI pipeline only needs write access to the Git repository — never to the cluster. The Reconciler running inside the cluster pulls changes and applies them, so cluster credentials never leave the cluster boundary.
:::

## Connecting a GitOps Source

```bash
sp gitops connect \
  --repo https://github.com/my-org/streamingplus-config \
  --branch main \
  --path ./environments/production \
  --env production \
  --poll-interval 60s \
  --install-webhook
```

Options:

| Flag | Description |
|------|-------------|
| `--repo` | Git repository URL (HTTPS or SSH) |
| `--branch` | Branch to track (default: `main`) |
| `--path` | Subdirectory containing manifests |
| `--env` | STREAMINGPLUS environment to sync into |
| `--poll-interval` | How often to poll (default: `60s`) |
| `--install-webhook` | Install a GitHub/GitLab webhook for push-triggered syncs |
| `--prune` | Delete resources removed from Git (default: `false`) |

:::warning
Set `--prune` with care. When enabled, removing a manifest from Git will delete the corresponding live resource (e.g., a running Deployment). Always test prune in a staging environment first.
:::

## Supported Manifest Formats

The Reconciler supports the following manifest formats in the repository:

| Format | File Extension | Notes |
|--------|---------------|-------|
| STREAMINGPLUS YAML | `.yaml`, `.yml` | Native `streamingplus.io/v1` resources |
| Kustomize | `kustomization.yaml` | Overlays and patches supported |
| Helm chart values | `values.yaml` + chart reference | Renders chart before applying |
| JSON | `.json` | Equivalent to YAML |

## Drift Detection

STREAMINGPLUS continuously compares the live state of each resource against the desired state in Git. When a difference is detected (drift), the Reconciler can:

1. **Alert** — send a notification to Slack, PagerDuty, or email
2. **Auto-remediate** — immediately apply the desired state from Git (default for `Deployment` resources)
3. **Block** — hold and wait for manual approval (configurable per resource type)

:::note
Drift is detected at the resource level, not just at the file level. If someone manually edits a live `Deployment` via `kubectl` or `sp`, the Reconciler will detect the change within one poll interval and revert it to match Git.
:::

Configure drift behavior per resource:

```yaml
apiVersion: streamingplus.io/v1
kind: GitOpsSource
metadata:
  name: production-config
spec:
  repo: https://github.com/my-org/streamingplus-config
  branch: main
  path: ./environments/production
  drift:
    detection: true
    notification:
      slack:
        channel: "#data-platform-alerts"
    remediation: auto   # auto | manual | block
```

## Checking Sync Status

```bash
sp gitops status --env production
sp gitops diff --env production   # show pending changes
sp gitops sync --env production   # trigger an immediate sync
```
