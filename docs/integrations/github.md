---
id: github
sidebar_label: GitHub
title: GitHub Integration
---

# GitHub Integration

STREAMINGPLUS integrates with GitHub for two primary use cases:

1. **OIDC Keyless Deploy** — GitHub Actions workflows authenticate to STREAMINGPLUS without storing API tokens, using short-lived OIDC tokens issued by GitHub.
2. **GitOps Repo Sync** — STREAMINGPLUS continuously monitors a GitHub repository for manifest changes and reconciles them against the live environment.

## OIDC Keyless Deploy with GitHub Actions

### Setup: sp connect Command

```bash
sp connect github \
  --org my-github-org \
  --env production
```

This registers GitHub's OIDC provider with your STREAMINGPLUS environment and creates a trust policy that allows tokens from your GitHub organization.

### GitHub Actions Workflow YAML

```yaml
name: Deploy to STREAMINGPLUS

on:
  push:
    branches:
      - main

permissions:
  id-token: write    # required for OIDC token request
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sp CLI
        run: |
          curl -sSL https://releases.streamingplus.io/install.sh | sh
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Authenticate via OIDC
        run: sp login --oidc --env production

      - name: Apply manifests
        run: sp apply -f ./manifests/ --env production

      - name: Wait for rollout
        run: sp deployments wait my-service --env production --timeout 300s
```

:::note
The `sp login --oidc` command requests a JWT from GitHub's OIDC endpoint (`https://token.actions.githubusercontent.com`) and exchanges it for a STREAMINGPLUS access token. No secrets need to be configured in the repository.
:::

## GitOps Repo Sync

Connect a GitHub repository as a GitOps source. STREAMINGPLUS will poll or receive webhooks from the repository and apply any changes to the target environment.

```bash
sp gitops connect \
  --repo https://github.com/my-org/streamingplus-config \
  --branch main \
  --path ./environments/production \
  --env production \
  --install-webhook    # installs a GitHub webhook for push notifications
```

## Required GitHub App Permissions

When installing the STREAMINGPLUS GitHub App (required for webhook-based sync and PR status checks), the following permissions are needed:

| Permission | Level | Reason |
|-----------|-------|--------|
| `contents` | Read | Read manifests from the repository |
| `pull_requests` | Write | Post deployment status comments on PRs |
| `statuses` | Write | Set commit status checks (pass/fail) |
| `metadata` | Read | Required for all GitHub Apps |
| `actions` | Read | Verify Actions workflow runs (for OIDC audit) |
| `checks` | Write | Create check runs for manifest validation |
| `webhooks` | Write | Manage push and PR webhooks |

## PR-Based Deploy Previews

When a pull request is opened against the GitOps source branch, STREAMINGPLUS can:
- Validate the manifests (`sp diff` equivalent)
- Post a comment with the planned changes
- Create a preview environment (if configured)

Enable PR checks in the GitOps source:

```yaml
apiVersion: streamingplus.io/v1
kind: GitOpsSource
metadata:
  name: production-config
spec:
  repo: https://github.com/my-org/streamingplus-config
  branch: main
  path: ./environments/production
  prChecks:
    enabled: true
    commentOnPR: true
    createPreviewEnv: false   # set true to spin up ephemeral environments
```

## Audit: Tracing GitHub Actions Deploys

Every deployment triggered by a GitHub Actions workflow includes the GitHub workflow run ID and commit SHA in the STREAMINGPLUS audit log:

```bash
sp audit events \
  --env production \
  --filter "source=github-actions" \
  --since 7d
```
