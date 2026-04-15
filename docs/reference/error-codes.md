---
id: error-codes
sidebar_label: Error Codes
title: Error Codes
---

# Error Codes

STREAMINGPLUS uses structured error codes in all API responses and CLI output. Each error includes a numeric code, a human-readable message, and a suggested resolution.

Error codes are grouped by category:

- **1xxx** — Authentication and Authorization
- **2xxx** — Resource Management
- **3xxx** — Deployment and Runtime
- **4xxx** — GitOps and Reconciliation

---

## Authentication Errors (1xxx)

| Code | Message | Resolution |
|------|---------|------------|
| `E1001` | API token expired | Run `sp login` to refresh your session, or generate a new service account token with `sp rbac service-accounts rotate-token` |
| `E1002` | API token invalid or malformed | Check that `SP_TOKEN` is set correctly and has not been truncated. Tokens start with `spsa_` |
| `E1003` | Insufficient permissions | Your role lacks the required permission for this action. Contact your org Admin to adjust your role or create an `RBACPolicy` |
| `E1004` | MFA challenge required | Your organization requires MFA. Complete MFA in the web console and re-authenticate |
| `E1005` | Organization not found | The organization associated with this token no longer exists or the token belongs to a different org |
| `E1006` | OIDC token exchange failed | The OIDC token from your CI provider was rejected. Verify the trust policy in `sp connect github` or `sp connect gcp` |
| `E1007` | IP address not allowlisted | Your organization has IP allowlisting enabled. Contact your Admin to add your IP |
| `E1008` | SSO session required | Your organization enforces SSO. Authenticate via `sp login --sso` |

---

## Resource Errors (2xxx)

| Code | Message | Resolution |
|------|---------|------------|
| `E2001` | Resource not found | Use `sp <resource> list` to see available names. Verify you are targeting the correct `--env` |
| `E2002` | Resource already exists | Choose a different name, or delete the existing resource with `sp delete <kind> <name>` |
| `E2003` | Resource quota exceeded | Upgrade your plan or delete unused resources to free quota. Run `sp envs get <name> --show-quota` |
| `E2004` | Invalid manifest | Run `sp apply -f <file> --validate-only` to see detailed schema errors |
| `E2005` | Immutable field change attempted | The field you changed cannot be updated in-place. Delete and recreate the resource |
| `E2006` | Resource is locked | Another operation is in progress on this resource. Wait for it to complete |
| `E2007` | Namespace not found | The target environment namespace does not exist. Run `sp envs get <name>` to verify |
| `E2008` | Dependency not found | A referenced resource (e.g., `connectionRef`) does not exist. Create it first |
| `E2009` | Resource validation failed | The resource spec failed server-side validation. See `details` in the error response |

---

## Deployment Errors (3xxx)

| Code | Message | Resolution |
|------|---------|------------|
| `E3001` | Image pull failed | Verify the container image tag exists and the registry credentials are configured. Check `sp connections get <registry-connection>` |
| `E3002` | Health check failed | The deployment did not become healthy within the timeout. Run `sp deployments logs <name>` and `sp deployments status <name>` |
| `E3003` | Insufficient cluster resources | The cluster lacks CPU or memory for this deployment. Scale the node pool or reduce resource requests in the deployment spec |
| `E3004` | Canary analysis failed | The new version exceeded the error rate or latency threshold during canary analysis. The deployment was automatically rolled back |
| `E3005` | Rollback failed | Rollback could not complete because the previous revision is no longer available. Manually apply the desired spec |
| `E3006` | Sink connection refused | The sink endpoint rejected the connection. Run `sp connections test <connectionRef>` |
| `E3007` | Source offset reset required | The source consumer group offset is out of range. Use `sp deployments reset-offset <name>` with `--to-earliest` or `--to-latest` |
| `E3008` | Worker crash loop | Workers are repeatedly crashing. Run `sp deployments logs <name> --previous` and contact support with the crash dump |
| `E3009` | Dead-letter sink unavailable | Records are failing but the dead-letter sink is also unreachable. Check both the primary and DLQ sink connections |
| `E3010` | Schema evolution failed | Auto-schema evolution was attempted but the target system rejected the DDL. Check the connection's permissions for DDL operations |

---

## GitOps Errors (4xxx)

| Code | Message | Resolution |
|------|---------|------------|
| `E4001` | Repository not accessible | Verify the STREAMINGPLUS GitHub App (or deploy key) is installed and has `contents: read` access to the repository |
| `E4002` | Manifest parse error | Check the error `details` for the file path and line number. Run `sp apply -f <dir> --validate-only` locally |
| `E4003` | Reconcile conflict | A resource is managed by two GitOps sources. Remove the duplicate entry from one source |
| `E4004` | Branch not found | The configured branch does not exist in the repository. Update the `GitOpsSource` spec with the correct branch name |
| `E4005` | Path not found | The configured `path` does not exist in the repository at the configured branch. Verify the path is correct |
| `E4006` | Webhook delivery failed | The STREAMINGPLUS webhook endpoint could not be reached by GitHub/GitLab. Check network connectivity and firewall rules |
| `E4007` | Sync timeout | The sync operation did not complete within the configured timeout. Increase `syncTimeoutSeconds` in the `GitOpsSource` spec |
| `E4008` | Prune blocked | A resource would be pruned (deleted) but `prune: true` is not set. Set `prune: true` in the `GitOpsSource` spec to allow deletions |

---

## Getting More Help

### Debug Logging

Append `--debug` to any `sp` CLI command to see full HTTP request and response bodies:

```bash
sp deployments get my-deployment --env production --debug
```

### Support Bundle

Generate a support bundle with diagnostic information:

```bash
sp diagnostics bundle --env production --output support-bundle.tar.gz
```

Attach the bundle when opening a support ticket.

### Community and Support

- **Documentation**: https://docs.streamingplus.io
- **Community Slack**: https://slack.streamingplus.io
- **GitHub Issues**: https://github.com/streamingplus/streamingplus/issues
- **Enterprise Support**: support@streamingplus.io (SLA-backed for Professional and Enterprise plans)
- **Security Issues**: security@streamingplus.io (responsible disclosure)
