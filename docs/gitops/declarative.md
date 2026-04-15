---
id: declarative
sidebar_label: Declarative Config
title: Declarative Config
---

# Declarative Config

Every STREAMINGPLUS resource can be expressed as YAML and stored in Git.

## Resource Model

```yaml
apiVersion: streamingplus.io/v1
kind: Environment
metadata:
  name: production
  labels:
    tier: prod
spec:
  cloud: aws
  region: us-east-1
  nodePool:
    instanceType: m6i.xlarge
    minNodes: 3
    maxNodes: 20
```

## Applying Manifests

```bash
sp apply -f environment.yaml        # single file
sp apply -f ./config/               # directory (recursive)
sp apply -f ./config/ --dry-run     # preview changes
sp diff -f ./config/production/     # show diff vs live state
```

## Common Resource Types

| Kind | Purpose |
|------|---------|
| Environment | A cloud environment (dev/staging/prod) |
| Deployment | A containerized workload |
| Secret | Encrypted secret reference |
| Pipeline | Multi-stage delivery pipeline |
| SLO | Service level objective |
| RBACPolicy | Team/role access control |
| GitOpsSource | Git repo + path to reconcile |
| SourceConnection | Data source connector |
| SinkConnection | Data sink connector |

## Schema Validation

```bash
sp validate -f ./config/       # validate locally
sp schema install --editor vscode  # install VS Code schema
```
