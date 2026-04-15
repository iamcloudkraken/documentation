---
id: vault
sidebar_label: HashiCorp Vault
title: HashiCorp Vault Integration
---

# HashiCorp Vault Integration

STREAMINGPLUS integrates with HashiCorp Vault for centralized secret management. Secrets are injected into deployments at runtime and rotated automatically without restarting pods. STREAMINGPLUS uses the **Kubernetes Auth** method, which requires no static Vault tokens.

## How Kubernetes Auth Works

```
STREAMINGPLUS Pod
  └─ Kubernetes ServiceAccount token (auto-mounted)
       └─ Vault Login (kubernetes auth method)
            └─ Vault Token (short-lived, auto-renewed)
                 └─ Secret fetch (KV, Database, PKI, AWS, etc.)
```

## Setup

### 1. Configure Vault Kubernetes Auth

```bash
# Enable the Kubernetes auth method in Vault
vault auth enable kubernetes

# Configure it with your cluster's details
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

# Create a policy for STREAMINGPLUS
vault policy write streamingplus - <<EOF
path "secret/data/streamingplus/*" {
  capabilities = ["read"]
}
path "database/creds/streamingplus-*" {
  capabilities = ["read"]
}
EOF

# Create a role binding the policy to the Kubernetes ServiceAccount
vault write auth/kubernetes/role/streamingplus \
  bound_service_account_names=streamingplus-worker \
  bound_service_account_namespaces=production \
  policies=streamingplus \
  ttl=1h
```

### 2. Connect STREAMINGPLUS to Vault

```bash
sp connect vault \
  --vault-address https://vault.internal:8200 \
  --vault-namespace admin/streamingplus \
  --auth-method kubernetes \
  --vault-role streamingplus \
  --env production
```

## Injecting Secrets into Deployments

Use the `vault.hashicorp.com/agent-inject` annotations to inject Vault secrets as environment variables or mounted files:

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: payments-processor
  namespace: production
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "streamingplus"
    vault.hashicorp.com/agent-inject-secret-db-creds: "database/creds/streamingplus-postgres"
    vault.hashicorp.com/agent-inject-template-db-creds: |
      {{- with secret "database/creds/streamingplus-postgres" -}}
      DB_USERNAME={{ .Data.username }}
      DB_PASSWORD={{ .Data.password }}
      {{- end }}
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - raw-payments
  sink:
    type: postgres
    connectionRef: pg-prod
    table: payments
```

The Vault Agent sidecar (injected automatically when the annotation is present) writes the rendered template to `/vault/secrets/db-creds` inside the container. STREAMINGPLUS reads these values at startup.

## Supported Secret Engines

| Engine | Path Pattern | Use Case |
|--------|-------------|----------|
| KV v2 | `secret/data/streamingplus/*` | Static secrets (API keys, tokens) |
| Database | `database/creds/<role>` | Dynamic PostgreSQL / MySQL credentials |
| PKI | `pki/issue/<role>` | Short-lived TLS certificates |
| AWS | `aws/creds/<role>` | Dynamic AWS IAM credentials |
| Kubernetes | `kubernetes/creds/<role>` | Dynamic Kubernetes service account tokens |

:::tip
Use the **Database** secret engine for PostgreSQL sink credentials instead of storing static passwords. Vault will issue a unique username/password pair per lease (default TTL: 1 hour) and revoke it when the STREAMINGPLUS pod stops. This provides full audit traceability and eliminates credential sharing between deployments.
:::

## Dynamic Credentials Example

Configure Vault to generate short-lived PostgreSQL credentials:

```bash
# Enable the database secret engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/my-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="streamingplus-*" \
  connection_url="postgresql://{{username}}:{{password}}@pg-primary.internal:5432/warehouse?sslmode=verify-full" \
  username="vault-admin" \
  password="vault-admin-password"

# Create a dynamic role for STREAMINGPLUS
vault write database/roles/streamingplus-payments \
  db_name=my-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT INSERT, SELECT ON TABLE payments TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"
```

## Verifying the Integration

```bash
sp integrations status --provider vault --env production
```

This checks Vault reachability, token validity, and lists all secret paths currently mounted in your STREAMINGPLUS environment.
