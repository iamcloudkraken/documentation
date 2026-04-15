---
id: users-roles
sidebar_label: Users & Roles
title: Users & Roles
---

# Users & Roles

STREAMINGPLUS uses role-based access control (RBAC) to govern who can create, modify, and delete resources within an organization and its environments. Roles are assigned at the organization level and can be further scoped per environment using `RBACPolicy` resources.

## Built-in Role Types

| Role | Scope | Key Permissions |
|------|-------|----------------|
| **Owner** | Organization | Full access including billing, SSO configuration, org deletion, and all admin actions |
| **Admin** | Organization or Environment | Manage users, create/delete environments, manage all resources, configure integrations |
| **Developer** | Environment | Create and manage Deployments, Connections, Pipelines, Secrets; cannot manage users or billing |
| **Viewer** | Environment | Read-only access to all resources; cannot create, update, or delete anything |

:::note
Every organization must have at least one **Owner**. Owners cannot be removed without transferring ownership to another user.
:::

## Managing Users with sp rbac

```bash
# Invite a user to the organization
sp rbac users invite user@example.com --role developer

# Invite with environment-scoped role
sp rbac users invite user@example.com --role developer --env production

# List all users
sp rbac users list

# List users in a specific environment
sp rbac users list --env production

# Change a user's role
sp rbac users update user@example.com --role admin

# Remove a user from the organization
sp rbac users remove user@example.com

# Remove a user from a specific environment
sp rbac users remove user@example.com --env staging
```

## RBACPolicy Resource

For fine-grained access control beyond the built-in roles, define an `RBACPolicy` resource:

```yaml
apiVersion: streamingplus.io/v1
kind: RBACPolicy
metadata:
  name: data-team-policy
  namespace: production
spec:
  description: "Data team has write access to sources/sinks, read-only on environments"
  principals:
    - type: group
      name: data-team           # SSO group name
    - type: user
      email: lead@example.com
  rules:
    - resources:
        - Deployment
        - Connection
        - Pipeline
      verbs:
        - get
        - list
        - create
        - update
        - delete
    - resources:
        - Environment
        - RBACPolicy
      verbs:
        - get
        - list
    - resources:
        - Secret
      verbs:
        - get
        - list
        - create
        - update
      conditions:
        - field: metadata.namespace
          operator: in
          values: ["production", "staging"]
```

Apply the policy:

```bash
sp apply -f rbac-policy.yaml
sp rbac policies list --env production
sp rbac policies get data-team-policy --env production
```

## Service Accounts for CI/CD

Create service accounts for automated CI/CD pipelines instead of using personal user tokens:

```bash
# Create a service account
sp rbac service-accounts create ci-deployer \
  --role developer \
  --env production \
  --description "GitHub Actions deployment service account"

# Generate an API token for the service account
sp rbac service-accounts token ci-deployer
# Output: SP_TOKEN=spsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# List service accounts
sp rbac service-accounts list

# Rotate the token
sp rbac service-accounts rotate-token ci-deployer

# Delete a service account
sp rbac service-accounts delete ci-deployer
```

Store the generated token as a secret in your CI system (e.g., GitHub Actions Secret `SP_TOKEN`).

## SCIM Provisioning

:::note
SCIM 2.0 provisioning is available on the **Enterprise** tier. With SCIM enabled, user lifecycle events (create, update, deactivate) in your Identity Provider (Okta, Azure AD, Google Workspace) are automatically reflected in STREAMINGPLUS within seconds. Manual invitation is not required for SCIM-managed users.
:::

Configure SCIM in your Identity Provider with:
- **SCIM Base URL**: `https://api.streamingplus.io/scim/v2`
- **Authentication**: Bearer token (generate from the Admin → SSO → SCIM settings page)
- **Supported attributes**: `userName`, `email`, `groups`, `active`

STREAMINGPLUS SCIM maps IdP groups to STREAMINGPLUS roles using the group name convention:

| IdP Group Name | STREAMINGPLUS Role |
|---------------|-------------------|
| `streamingplus-owners` | Owner |
| `streamingplus-admins` | Admin |
| `streamingplus-developers-<env>` | Developer (environment-scoped) |
| `streamingplus-viewers` | Viewer |

## SSO Configuration

Configure SAML 2.0 or OIDC SSO in the Admin settings:

```bash
sp admin sso configure \
  --provider okta \
  --metadata-url https://my-org.okta.com/app/abcdef/sso/saml/metadata \
  --group-attribute groups \
  --default-role viewer
```
