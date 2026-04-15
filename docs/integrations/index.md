---
id: index
sidebar_label: Overview
title: Integrations Overview
---

# Integrations

STREAMINGPLUS integrates with cloud providers, observability platforms, secret managers, and developer tooling through a standardized connection model. All integrations are configured declaratively and managed through the `sp connect` CLI command or via `Connection` resources in the API.

## Cloud Providers

| Provider | Auth Method | Supported Services | Status |
|----------|-------------|-------------------|--------|
| [AWS](./aws) | IRSA (IAM Roles for Service Accounts) | S3, Kinesis, MSK, Secrets Manager, Glue | GA |
| [GCP](./gcp) | Workload Identity Federation | BigQuery, GCS, Pub/Sub, Secret Manager, Dataflow | GA |
| [Azure](./azure) | User-Assigned Managed Identity (UAMI) | Azure Blob, Event Hubs, Synapse, Key Vault | GA |

## Observability

| Tool | Auth Method | Features | Status |
|------|-------------|----------|--------|
| [Datadog](./datadog) | API Key | Metrics, Logs, APM traces, SLO sync | GA |
| Prometheus | Pull (scrape `/metrics`) | All built-in metrics | GA |
| Grafana | API Key | Pre-built dashboards via plugin | GA |
| PagerDuty | Integration Key | Alert routing, escalation policies | GA |
| New Relic | License Key | Infrastructure metrics, distributed tracing | Beta |

## Secret Management

| Tool | Auth Method | Supported Engines | Status |
|------|-------------|------------------|--------|
| [HashiCorp Vault](./vault) | Kubernetes Auth | KV v2, Database, PKI, AWS | GA |
| AWS Secrets Manager | IRSA | All secret types | GA |
| GCP Secret Manager | Workload Identity | Versioned secrets | GA |
| Azure Key Vault | Managed Identity | Secrets, Keys, Certificates | GA |

## Developer Tooling

| Tool | Auth Method | Features | Status |
|------|-------------|----------|--------|
| [GitHub](./github) | OIDC / GitHub App | OIDC keyless deploy, GitOps sync, PR checks | GA |
| [Terraform](./terraform) | API Token / OIDC | IaC resource management, remote state | GA |
| Helm | N/A | Chart-based deployment on Kubernetes | GA |
| ArgoCD | OIDC | GitOps pull-based sync | Beta |
| Backstage | API Token | Developer portal service catalog | Beta |

## Connection Model

All integrations are backed by a `Connection` resource in the `streamingplus.io/v1` API group. A connection stores:

1. **Endpoint configuration** — URLs, regions, account identifiers
2. **Auth references** — pointers to Kubernetes secrets or Vault paths (never inline credentials)
3. **TLS settings** — CA certs, client certs for mTLS

```yaml
apiVersion: streamingplus.io/v1
kind: Connection
metadata:
  name: my-s3-connection
  namespace: production
spec:
  type: s3
  region: us-east-1
  auth:
    type: irsa
    roleArn: arn:aws:iam::123456789012:role/StreamingPlusS3Role
```

List all configured connections:

```bash
sp connections list
sp connections get my-s3-connection
sp connections test my-s3-connection  # validates auth and connectivity
```

:::tip
Run `sp connections test <name>` before referencing a connection in a deployment. This validates credentials and network reachability without writing any data.
:::

## Integration Status

To check the health of all configured integrations:

```bash
sp integrations status
```

This command polls each integration and reports connectivity, auth validity, and any quota or rate-limit warnings.
