---
id: source-control
sidebar_label: Source Control
title: Source Control Connections
---

# Source Control Connections

STREAMINGPLUS integrates with source control providers to enable GitOps-driven pipeline management. A `SourceControlConnection` grants the platform read access to your repositories so that it can watch for changes and reconcile pipeline definitions automatically.

Once a source control connection is established, you can create `GitOpsSource` resources that point to specific repositories and paths, enabling fully declarative pipeline management through pull requests.

---

## Supported Providers

| Provider | App-based Auth | Token Auth | SSH Key Auth | Status |
|---|:---:|:---:|:---:|---|
| GitHub (github.com) | Yes (GitHub App) | Yes (PAT) | Yes | GA |
| GitLab SaaS (gitlab.com) | Yes (GitLab App) | Yes (Project token) | Yes | GA |
| GitLab Self-Managed | No | Yes (Group/Project token) | Yes | GA |
| Bitbucket Cloud | Yes (OAuth App) | Yes (App password) | Yes | GA |
| Azure DevOps | No | Yes (PAT) | No | GA |

---

## Connect GitHub

### Using a GitHub App (recommended)

GitHub Apps provide fine-grained permissions and do not expire like PATs. STREAMINGPLUS provides a managed GitHub App that you can install into your organization:

```bash
sp connections source-control add \
  --name github-org \
  --provider github \
  --type github-app \
  --installation-id 12345678 \
  --app-id 987654 \
  --private-key-path /path/to/private-key.pem
```

### Using a Personal Access Token

```bash
sp connections source-control add \
  --name github-org \
  --provider github \
  --type pat \
  --token ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --org myorg
```

Required PAT scopes: `repo`, `read:org`

:::tip
Use a **machine user** (bot account) PAT rather than a personal account PAT. This prevents disruption if the team member leaves the organization.
:::

---

## Connect GitLab SaaS

```bash
sp connections source-control add \
  --name gitlab-saas \
  --provider gitlab \
  --type project-token \
  --url https://gitlab.com \
  --token glpat-xxxxxxxxxxxxxxxxxxxx \
  --group mygroup
```

Required token scopes: `read_repository`, `read_api`

---

## Connect GitLab Self-Managed

```bash
sp connections source-control add \
  --name gitlab-internal \
  --provider gitlab \
  --type project-token \
  --url https://gitlab.internal.example.com \
  --token glpat-xxxxxxxxxxxxxxxxxxxx \
  --group mygroup \
  --ca-cert-path /path/to/internal-ca.crt
```

:::note
For self-managed GitLab instances with self-signed TLS certificates, provide the CA certificate with `--ca-cert-path`. Without it, TLS verification will fail and the connection will enter a `disconnected` state.
:::

---

## Connect Bitbucket Cloud

```bash
sp connections source-control add \
  --name bitbucket-workspace \
  --provider bitbucket \
  --type app-password \
  --username myuser \
  --app-password ATBB-xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --workspace myworkspace
```

Required app password permissions: `Repositories: Read`

---

## Connect Azure DevOps

```bash
sp connections source-control add \
  --name ado-org \
  --provider azure-devops \
  --type pat \
  --org myorg \
  --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Required PAT scopes: `Code: Read`

---

## Repository Access Grants

By default, a `SourceControlConnection` grants STREAMINGPLUS access to all repositories visible to the provided credentials. You can restrict access to specific repositories:

```bash
# Grant access to specific repositories only
sp connections source-control grant github-org \
  --repositories myorg/pipelines-config,myorg/data-platform-infra

# Revoke access to a repository
sp connections source-control revoke github-org \
  --repository myorg/legacy-pipelines
```

List currently accessible repositories:

```bash
sp connections source-control repos github-org
```

```
ORGANIZATION    REPOSITORY                 ACCESS     LAST SYNCED
myorg           pipelines-config           read       2m ago
myorg           data-platform-infra        read       2m ago
myorg           shared-schemas             read       5m ago
```

---

## GitOpsSource Resource

A `GitOpsSource` ties a source control connection to a specific repository path and branch, and tells STREAMINGPLUS which resource types to reconcile from that path.

```yaml
apiVersion: streamingplus.io/v1
kind: GitOpsSource
metadata:
  name: production-pipelines
  namespace: data-platform
spec:
  connection: github-org
  repository: myorg/pipelines-config
  branch: main
  path: environments/production
  recurse: true
  interval: 30s
  resources:
    - StreamingPipeline
    - StreamProcessor
    - DatabaseConnection
    - ObservabilityConnection
  prune: true
  validation:
    enforceSchemas: true
    dryRunOnPR: true
```

### Key fields

| Field | Description |
|---|---|
| `connection` | Name of the `SourceControlConnection` to use. |
| `repository` | Full repository path in `org/repo` format. |
| `branch` | Branch to watch. Supports `refs/tags/*` for tag-based releases. |
| `path` | Directory within the repository to scan for STREAMINGPLUS resources. |
| `recurse` | If `true`, scan subdirectories recursively. |
| `interval` | How frequently to poll for changes. Minimum: `15s`. |
| `prune` | If `true`, resources removed from Git are deleted from the cluster. |
| `validation.dryRunOnPR` | Post a dry-run validation comment on pull requests before merge. |

### Apply a GitOpsSource

```bash
kubectl apply -f gitops-source.yaml
# or
sp apply -f gitops-source.yaml
```

### Check GitOpsSource status

```bash
sp gitops sources list

NAME                   REPOSITORY                  BRANCH   STATUS    LAST-SYNC   RESOURCES
production-pipelines   myorg/pipelines-config       main     synced    15s ago     47
staging-pipelines      myorg/pipelines-config       staging  synced    22s ago     31
```

```bash
sp gitops sources describe production-pipelines
```

---

## Webhook Integration

For sub-second sync latency, configure a webhook in your source control provider to push change events to STREAMINGPLUS instead of relying on polling.

```bash
sp connections source-control webhook github-org
```

This command outputs a webhook URL and secret. Add them to your GitHub organization's webhook settings:

```
URL:    https://api.streamingplus.io/webhooks/github/<org-id>
Secret: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Events: push, pull_request
```

With webhooks configured, STREAMINGPLUS reconciles changes within seconds of a push rather than waiting for the next poll interval.
