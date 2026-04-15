---
id: auth
sidebar_label: Authentication
title: Authentication
---

# Authentication

STREAMINGPLUS supports multiple authentication methods to accommodate individual developers, teams using SSO, and automated CI/CD pipelines. All methods produce an identity that is evaluated against RBAC policies on every request.

---

## Authentication Methods Overview

| Method | Best For | How to Configure |
|---|---|---|
| **API Tokens** | CLI usage, scripts, quick access | `sp token create` |
| **OAuth2 / OIDC SSO** | Browser-based UI, team login | SSO provider configuration in settings |
| **SCIM Provisioning** | Automated user lifecycle from IdP | SCIM endpoint + bearer token |
| **MFA** | All users (enforced per workspace policy) | User profile or IdP-side enforcement |
| **Service Account Tokens** | CI/CD pipelines, automation, agents | `sp serviceaccount create` |

---

## API Tokens

API tokens are long-lived (configurable) credentials that authenticate a specific user identity. They are the default authentication method for the `sp` CLI.

### Creating an API Token

```bash
sp token create --name my-dev-token --ttl 90d
```

```
Token created successfully.
Name:    my-dev-token
ID:      tok_8f3d92a1b4c5d6e7
Scopes:  read write
Expires: 2026-07-13T12:00:00Z

Token value (copy it now — it will not be shown again):
spt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
```

The token value is shown **only once**. Store it in a password manager or secrets vault immediately.

### Token Scopes

Tokens are issued with one or more scopes that limit what operations they can perform, independent of the user's RBAC role.

| Scope | Permitted Operations |
|---|---|
| `read` | GET operations on all resources the user has RBAC access to |
| `write` | POST, PUT, PATCH, DELETE operations on resources the user can modify |
| `deploy` | Apply Deployments; implies `read` |
| `admin` | All operations including workspace settings and user management |
| `metrics:read` | Read pipeline and agent metrics; useful for monitoring integrations |
| `gitops:write` | Trigger manual GitOps syncs; create and update `GitOpsSource` resources |

Create a read-only token:

```bash
sp token create --name grafana-metrics --scopes metrics:read --ttl 365d
```

Create a deploy-only token for CI:

```bash
sp token create --name ci-deploy-token --scopes deploy --ttl 30d
```

### Listing and Revoking Tokens

```bash
# List all tokens for your user
sp token list
```

```
NAME               ID                    SCOPES           EXPIRES           LAST USED
my-dev-token       tok_8f3d92a1b4c5d6e7  read, write      2026-07-13        2 hours ago
ci-deploy-token    tok_9g4e03b2c5d7e8f9  deploy           2026-05-14        10 minutes ago
grafana-metrics    tok_0h5f14c3d6e9f0g1  metrics:read     2027-04-14        1 day ago
```

```bash
# Revoke a token immediately
sp token revoke tok_8f3d92a1b4c5d6e7
```

```
Token tok_8f3d92a1b4c5d6e7 (my-dev-token) revoked successfully.
```

### Using a Token with the CLI

```bash
# Set token in the CLI config (stored in ~/.config/sp/config.yaml)
sp config set token spt_1a2b3c4d5e6f7g8h9i0j...

# Or pass per-command via environment variable
SP_TOKEN=spt_1a2b3c4d5e6f7g8h9i0j... sp get pipelines
```

### Using a Token with the REST API

Pass the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer spt_1a2b3c4d5e6f7g8h9i0j..." \
     https://api.streamingplus.io/v1/pipelines
```

---

## OAuth2 / OIDC Single Sign-On

STREAMINGPLUS supports OIDC-compliant identity providers for browser-based and CLI login. When SSO is configured, users log in through their organization's IdP rather than creating local STREAMINGPLUS passwords.

### Supported Providers

| Provider | Notes |
|---|---|
| Okta | Full support including group sync |
| Azure Active Directory | Full support including group sync |
| Google Workspace | Full support |
| Auth0 | Full support |
| Keycloak | Full support |
| GitHub (OAuth2) | Supported; no group sync |
| GitLab | Supported; no group sync |
| Any OIDC-compliant IdP | Requires `issuer`, `clientId`, `clientSecret` |

### Configuring an OIDC Provider

In the STREAMINGPLUS UI, navigate to **Settings → Authentication → Add Identity Provider**, or use the API:

```bash
sp config sso create \
  --name okta-prod \
  --type oidc \
  --issuer https://acme.okta.com/oauth2/default \
  --client-id 0oa5abc123def456ghi7 \
  --client-secret-ref okta-client-secret \
  --scopes openid,email,profile,groups
```

Map IdP groups to STREAMINGPLUS roles:

```bash
sp config sso group-mapping create \
  --provider okta-prod \
  --group "streaming-platform-admins" \
  --role Admin

sp config sso group-mapping create \
  --provider okta-prod \
  --group "data-engineering" \
  --role PipelineEditor
```

### CLI Login via SSO

The `sp login` command supports SSO with a browser redirect:

```bash
sp login --provider okta-prod
```

This opens a browser window to your IdP's login page. After successful authentication, the CLI receives a short-lived access token and stores it in `~/.config/sp/config.yaml`.

For headless environments (CI, SSH):

```bash
sp login --provider okta-prod --device-code
```

```
Open https://auth.streamingplus.io/activate and enter code: ABCD-EFGH
Waiting for authentication...
Logged in as alice@example.com (via Okta SSO)
```

---

## SCIM Provisioning

STREAMINGPLUS supports the SCIM 2.0 protocol for automated user and group lifecycle management from your IdP. When SCIM is enabled:

- Users are automatically created in STREAMINGPLUS when added in the IdP.
- Users are automatically deprovisioned when removed from the IdP.
- Group memberships sync every time the IdP pushes a SCIM update.

### Enabling SCIM

1. Generate a SCIM bearer token:

```bash
sp admin scim token create --name okta-scim-token
```

```
SCIM Token created.
Token: scim_9z8y7x6w5v4u3t2s1r0q...
SCIM Base URL: https://api.streamingplus.io/scim/v2
```

2. In your IdP (e.g., Okta):
   - Set **SCIM Base URL** to `https://api.streamingplus.io/scim/v2`
   - Set **Authentication** to Bearer Token and paste the token above.
   - Enable **Push Users** and **Push Groups**.

3. Assign your STREAMINGPLUS application to the users and groups you want to provision.

### SCIM Supported Operations

| Operation | Supported |
|---|---|
| Create User | Yes |
| Update User (name, email) | Yes |
| Deactivate User | Yes |
| Hard Delete User | Yes |
| Push Groups | Yes |
| Group Membership Updates | Yes |

---

## Multi-Factor Authentication (MFA)

MFA can be enforced at the workspace level, the environment level, or left to individual users.

### Workspace-Level MFA Enforcement

Require MFA for all users in a workspace:

```bash
sp admin workspace update acme-corp --require-mfa=true
```

When MFA is required, users without an enrolled MFA device are blocked from accessing the API and UI until they complete enrollment.

### MFA Methods

The following MFA methods are supported for local accounts (IdP-managed SSO users should enforce MFA at the IdP):

| Method | Description |
|---|---|
| TOTP (Time-based OTP) | Any RFC 6238-compliant authenticator app (Google Authenticator, 1Password, Authy) |
| WebAuthn / FIDO2 | Hardware security keys (YubiKey, Apple Touch ID, Windows Hello) |
| Recovery Codes | 10 single-use codes generated at enrollment; store securely |

### Enrolling MFA (CLI)

```bash
sp mfa enroll --method totp
```

```
Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.

█████████████████
█ [QR CODE HERE] █
█████████████████

otpauth://totp/STREAMINGPLUS:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=STREAMINGPLUS

Enter verification code: 482915
MFA enrolled successfully. Save these recovery codes:
  sprc-1234-abcd-5678
  sprc-9876-efgh-5432
  ... (10 codes total)
```

---

## Service Account Tokens

Service accounts are non-human identities designed for CI/CD pipelines, automation scripts, and internal integrations. Unlike personal API tokens, service account tokens are not tied to a specific user — they survive if the user leaves the organization.

### Creating a Service Account

```bash
sp serviceaccount create ci-deploy-bot \
  --description "Used by GitHub Actions for production deployments" \
  --role Deployer \
  --environments production,staging
```

```
Service account created.
Name: ci-deploy-bot
ID:   sa_2b3c4d5e6f7g8h9i
Role: Deployer
Environments: production, staging
```

### Generating a Service Account Token

```bash
sp serviceaccount token create \
  --serviceaccount ci-deploy-bot \
  --name github-actions \
  --ttl 30d
```

```
Service account token created.
Token (copy now — not shown again):
spt_sa_7h8i9j0k1l2m3n4o5p6q7r8s9t0u...
```

### Using Service Account Tokens in CI/CD

**GitHub Actions example:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sp CLI
        run: curl -sSL https://get.streamingplus.io/install.sh | sh

      - name: Deploy streaming infrastructure
        env:
          SP_TOKEN: ${{ secrets.SP_SERVICE_ACCOUNT_TOKEN }}
          SP_API_URL: https://sp.example.com
        run: |
          sp config set api-url $SP_API_URL
          sp config set token $SP_TOKEN
          sp apply -f ./infrastructure/environments/production/
          sp deployment rollout status order-events-pipeline --timeout=5m
```

**GitLab CI example:**

```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  image: curlimages/curl:latest
  before_script:
    - curl -sSL https://get.streamingplus.io/install.sh | sh
    - sp config set api-url $SP_API_URL
    - sp config set token $SP_TOKEN
  script:
    - sp apply -f ./infrastructure/
  only:
    - main
```

### Listing and Rotating Service Account Tokens

```bash
# List service accounts
sp serviceaccount list
```

```
NAME              ID               ROLE       ENVIRONMENTS          CREATED
ci-deploy-bot     sa_2b3c4d5e6f7g  Deployer   production, staging   14 days ago
monitoring-bot    sa_3c4d5e6f7g8h  Viewer     all                   30 days ago
```

```bash
# Rotate a service account token (revoke old, issue new)
sp serviceaccount token rotate \
  --serviceaccount ci-deploy-bot \
  --name github-actions
```

---

## Token Storage and Security Best Practices

- **Never commit tokens to source control.** Use GitHub/GitLab secrets, HashiCorp Vault, AWS Secrets Manager, or equivalent.
- **Use the minimum scope.** A CI pipeline that only deploys should use the `deploy` scope, not `admin`.
- **Set appropriate TTLs.** Short-lived tokens (30–90 days) reduce blast radius if leaked. Rotate regularly.
- **Use service accounts for automation** — not personal tokens. Personal tokens stop working if the user is deprovisioned.
- **Enable MFA** on all human accounts, especially those with `admin` role.
- **Audit token usage** with `sp admin audit-log`:

```bash
sp admin audit-log --filter "resource_type=token" --since 7d
```

---

## Next Steps

- [RBAC Guide](../administration/rbac.md) — Configure fine-grained access control with `RBACPolicy` resources.
- [CLI Reference](../reference/cli.md) — Full documentation for `sp token`, `sp serviceaccount`, `sp login`, and related commands.
- [Data Model — RBACPolicy](./data-model.md#rbacpolicy) — YAML reference for access control resources.
