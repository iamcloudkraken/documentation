---
id: cli
sidebar_label: CLI Reference
title: CLI Reference
---

# CLI Reference

The `sp` CLI is the primary interface for managing STREAMINGPLUS resources, environments, deployments, and integrations. It communicates with the STREAMINGPLUS Control Plane API.

## Installation

### macOS (Homebrew)

```bash
brew install streamingplus/tap/sp
```

### Linux (curl)

```bash
curl -fsSL https://releases.streamingplus.io/install.sh | sh
# Installs to /usr/local/bin/sp by default
# Override: INSTALL_DIR=/usr/local/bin sh <(curl -fsSL ...)
```

### Windows (winget)

```powershell
winget install StreamingPlus.sp
```

### Windows (Scoop)

```powershell
scoop bucket add streamingplus https://github.com/streamingplus/scoop-bucket
scoop install sp
```

### Verify Installation

```bash
sp version
# sp version 1.3.0 (commit: abc1234, built: 2024-06-15)
```

---

## Authentication Commands

```bash
sp login                        # Browser-based OAuth login
sp login --oidc --env production # OIDC login (GitHub Actions / CI)
sp login --token $SP_TOKEN       # Non-interactive token login

sp logout                       # Clear stored credentials
sp auth token                   # Print current API token (for scripts)
sp whoami                       # Print current user identity and org
```

---

## sp envs — Environment Management

```bash
sp envs list                                        # List all environments
sp envs get <name>                                  # Get environment details
sp envs create <name> --cloud aws --region us-east-1 --tier professional
sp envs scale <name> --min-workers 5 --max-workers 20
sp envs upgrade <name> --version 1.3.0              # Upgrade STREAMINGPLUS version
sp envs delete <name> --confirm                     # Delete environment (destructive)
sp envs describe <name>                             # Detailed config and health info
```

---

## sp deployments — Deployment Management

```bash
sp deployments list [--env <env>]                    # List deployments
sp deployments get <name> [--env <env>]              # Get deployment details
sp deployments apply -f <file.yaml>                  # Apply a deployment manifest
sp deployments status <name> [--env <env>] [--watch] # Watch deployment status
sp deployments logs <name> [--env <env>] [--follow] [--tail 100]
sp deployments rollback <name> [--env <env>] [--revision <n>]
sp deployments history <name> [--env <env>]          # List revision history
sp deployments delete <name> [--env <env>] --confirm # Delete deployment
sp deployments restart <name> [--env <env>]          # Rolling restart
sp deployments wait <name> [--env <env>] [--timeout 300s]
```

---

## sp secrets — Secret Management

```bash
sp secrets list [--env <env>]                # List secret key names
sp secrets set <key> --value <value>         # Set a secret value
sp secrets set <key> --file <path>           # Set secret from file
sp secrets set <key> \
  --from-vault secret/data/path \
  --vault-connection vault-prod              # Reference a Vault secret
sp secrets delete <key> [--env <env>]       # Delete a secret
```

---

## sp connections — Connection Management

```bash
sp connections list [--env <env>]            # List all connections
sp connections get <name>                    # Get connection details
sp connections create <name> --type <type> [flags]
sp connections test <name>                   # Validate connectivity and auth
sp connections delete <name> --confirm       # Delete a connection
```

### Connection creation flags (common):

| Flag | Description |
|------|-------------|
| `--type` | Connection type: `s3`, `kafka`, `bigquery`, `snowflake`, `postgres`, etc. |
| `--secret-ref` | Kubernetes secret name holding credentials |
| `--env` | Environment scope |
| `--region` | Cloud region (cloud connections) |
| `--endpoint` | Custom endpoint URL (S3-compatible, self-hosted Kafka, etc.) |

---

## sp gitops — GitOps Management

```bash
sp gitops connect \
  --repo https://github.com/my-org/config \
  --branch main \
  --path ./environments/production \
  --env production \
  --install-webhook

sp gitops status [--env <env>]               # Show sync status
sp gitops sync [--env <env>]                 # Trigger immediate sync
sp gitops diff [--env <env>]                 # Show pending changes
sp gitops disconnect [--env <env>] --confirm # Remove GitOps source
```

---

## sp apply / sp diff / sp delete

```bash
sp apply -f <file|dir>                       # Apply resource manifests
sp apply -f <dir> --recursive                # Apply recursively
sp apply -f <file> --dry-run                 # Preview without applying
sp apply -f <file> --validate-only           # Schema validation only

sp diff -f <file|dir>                        # Show diff vs live state

sp delete -f <file>                          # Delete resource by manifest
sp delete <kind> <name> [--env <env>]        # Delete by type and name
```

---

## sp rbac — Access Control

```bash
sp rbac users invite <email> --role <role>
sp rbac users list
sp rbac users remove <email>
sp rbac policies list [--env <env>]
sp rbac policies apply -f rbac-policy.yaml
sp rbac service-accounts create <name> --role <role>
sp rbac service-accounts token <name>
sp rbac service-accounts rotate-token <name>
sp rbac service-accounts delete <name>
```

---

## sp audit — Audit Logs

```bash
sp audit logs [--since <duration>] [--user <email>] [--action <verb>]
sp audit events --resource Deployment --env production
```

---

## Global Flags

All `sp` commands support the following global flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--env <name>` | (from context) | Target STREAMINGPLUS environment |
| `--context <name>` | `default` | Use a named CLI profile/context |
| `--output <format>` | `table` | Output format: `table`, `json`, `yaml` |
| `--quiet` | `false` | Suppress progress and info output |
| `--debug` | `false` | Enable verbose HTTP request/response logging |
| `--no-color` | `false` | Disable ANSI color in output |
| `--timeout <duration>` | `60s` | Per-command timeout |
| `--config <path>` | `~/.sp/config.yaml` | Path to CLI config file |
| `--version` | — | Print CLI version and exit |
| `--help` | — | Print help for a command |
