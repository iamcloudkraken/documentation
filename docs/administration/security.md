---
id: security
sidebar_label: Security
title: Security
---

# Security

STREAMINGPLUS is built with a security-first architecture. This page describes the security controls available across transport, secrets, network, audit, and compliance dimensions.

## Mutual TLS (mTLS)

All communication between STREAMINGPLUS components — Control Plane, Reconciler, Worker agents, and external API clients — is encrypted and mutually authenticated using TLS 1.3. Certificates are provisioned by the built-in PKI (or integrated with cert-manager) and rotated automatically every 24 hours.

The mTLS chain:

```
Client ──[TLS 1.3]──► Control Plane API
Control Plane ──[mTLS]──► Worker Agent
Worker Agent ──[TLS 1.3]──► External Sink (S3, BigQuery, etc.)
```

To verify the current certificate status:

```bash
sp admin tls status
sp admin tls rotate --force   # manually trigger certificate rotation
```

## Network Policies

STREAMINGPLUS deploys Kubernetes `NetworkPolicy` resources to restrict pod-to-pod communication to only the required paths:

- Workers may communicate with the Control Plane API only
- Workers may communicate with configured external endpoints only
- No direct pod-to-pod communication is permitted between different deployments

:::note
Network Policies require a CNI plugin that enforces them (Calico, Cilium, Antrea). On clusters with the default kubenet CNI, Network Policies are created but not enforced — ensure your cluster uses a compatible CNI.
:::

## Secret Management

STREAMINGPLUS never stores secret values in plaintext. Secrets are managed via:

1. **Kubernetes Secrets** — for cluster-local secrets, encrypted at rest via etcd encryption
2. **HashiCorp Vault** — for dynamic and centrally managed secrets (recommended)
3. **Cloud Secret Managers** — AWS Secrets Manager, GCP Secret Manager, Azure Key Vault

### Managing Secrets via CLI

```bash
# Store a secret
sp secrets set DB_PASSWORD --value "s3cr3t"
sp secrets set API_KEY --file ./api-key.txt

# Reference a secret from an external store
sp secrets set KAFKA_PASSWORD \
  --from-vault secret/data/kafka/password \
  --vault-connection vault-prod

# List secrets (names only, values are never shown)
sp secrets list --env production

# Delete a secret
sp secrets delete DB_PASSWORD --env production
```

Reference secrets in deployment manifests:

```yaml
spec:
  sink:
    type: postgres
    connectionRef: pg-prod
  env:
    - name: DB_PASSWORD
      valueFrom:
        secretRef: DB_PASSWORD
```

## Audit Logging

Every action performed via the CLI, API, or UI is recorded in the immutable audit log. Audit events include:

- User identity (email, service account, or OIDC subject)
- Action performed (create, update, delete, get, list)
- Resource affected (type, name, namespace)
- Timestamp (UTC)
- Source IP and user agent
- Outcome (success / failure)

### Querying Audit Logs

```bash
# Show all events in the last 24 hours
sp audit logs --since 24h

# Filter by user
sp audit logs --user admin@example.com --since 7d

# Filter by action
sp audit logs --action delete --since 30d

# Filter by resource type
sp audit logs --resource Deployment --env production

# Export as JSON for SIEM ingestion
sp audit logs --since 30d --output json > audit-export.json
```

### Streaming Audit Logs to External Systems

Configure audit log forwarding in `sp admin`:

```bash
# Forward to Datadog
sp admin audit-sink configure \
  --type datadog \
  --api-key-secret-ref datadog-api-key

# Forward to S3 (for SIEM)
sp admin audit-sink configure \
  --type s3 \
  --bucket my-audit-logs \
  --region us-east-1
```

## Compliance

STREAMINGPLUS maintains the following certifications:

| Certification | Scope | Audit Frequency |
|--------------|-------|----------------|
| SOC 2 Type II | Security, Availability, Confidentiality | Annual |
| ISO 27001 | Information Security Management | Annual |
| GDPR | Data processing agreements available | — |
| HIPAA | Business Associate Agreement (BAA) available for Enterprise | — |

Audit reports and the latest penetration test summary are available to Enterprise customers. Contact security@streamingplus.io.

## Vulnerability Management

- Container images are scanned with Trivy on every build
- STREAMINGPLUS uses a 90-day patch SLA for critical CVEs and a 30-day SLA for high CVEs
- A security advisory mailing list is available at security-advisories@streamingplus.io

:::warning
If you discover a security vulnerability in STREAMINGPLUS, please report it responsibly to security@streamingplus.io. Do not disclose vulnerabilities publicly until a fix has been released.
:::

## Data Residency

By default, STREAMINGPLUS Managed Cloud stores all control plane metadata (environment configs, audit logs, user data) in the region you specify during environment creation. No data crosses regional boundaries unless explicitly configured. For self-hosted deployments, you have complete control over data residency.
