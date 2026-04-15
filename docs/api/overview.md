---
id: overview
sidebar_label: Overview
title: API Overview
---

# API Overview

STREAMINGPLUS exposes two API interfaces: a **REST API** for management operations (environments, deployments, connections, pipelines) and a **gRPC API** for high-performance data plane interactions. Both are served from the same Control Plane endpoint and share the same authentication mechanism.

## API Interfaces

| Interface | Protocol | Use Case |
|-----------|----------|----------|
| REST API | HTTPS / JSON | Management operations, integrations, Terraform |
| gRPC API | HTTP/2 / Protobuf | High-performance data plane, SDK internals |

## Base URL

```
https://api.streamingplus.io/v1
```

For self-hosted deployments, replace the base URL with your Control Plane endpoint:

```
https://streamingplus.internal.example.com/v1
```

The gRPC endpoint is available at:

```
streamingplus.internal.example.com:443  (TLS)
```

## Authentication

All API requests require a Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer $SP_TOKEN" \
  https://api.streamingplus.io/v1/environments
```

### Obtaining a Token

```bash
# Interactive login (saves token to ~/.sp/credentials)
sp login

# Print the current token for use in scripts
sp auth token

# CI/CD: set SP_TOKEN environment variable directly
export SP_TOKEN=spsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

:::note
Tokens expire after 24 hours for user tokens and after 1 year for service account tokens. Service account tokens can be rotated with `sp rbac service-accounts rotate-token <name>`.
:::

## Request Format

All REST API requests and responses use JSON. Set the `Content-Type` header for write operations:

```bash
curl -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "staging", "cloud": "aws", "region": "us-east-1"}' \
  https://api.streamingplus.io/v1/environments
```

## Versioning

The API version is embedded in the URL path (`/v1`). STREAMINGPLUS follows semantic versioning for the API:

- **Minor changes** (new fields, new endpoints) are backward-compatible and do not increment the version
- **Breaking changes** (removed fields, changed semantics) increment the major version (e.g., `/v2`)

The previous API major version is supported for **12 months** after a new version ships. Deprecation notices are published in the [Changelog](../support/changelog) at least 6 months before removal.

## Rate Limits

| Plan | Requests / Minute | Burst | Concurrent Requests |
|------|------------------|-------|---------------------|
| Starter | 60 | 100 | 5 |
| Professional | 600 | 1,000 | 20 |
| Enterprise | Unlimited | — | 100 |

When a rate limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header indicating the number of seconds to wait.

## Error Responses

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "E2001",
    "message": "Resource not found: Deployment 'my-deployment' does not exist in environment 'production'",
    "details": {
      "resource_type": "Deployment",
      "resource_name": "my-deployment",
      "environment": "production"
    },
    "request_id": "req_abc123def456"
  }
}
```

See the [Error Codes reference](../reference/error-codes) for a complete list.

## Pagination

List endpoints support cursor-based pagination:

```bash
# First page (default page size: 50)
curl -H "Authorization: Bearer $SP_TOKEN" \
  "https://api.streamingplus.io/v1/deployments?limit=20"

# Next page using the cursor from the previous response
curl -H "Authorization: Bearer $SP_TOKEN" \
  "https://api.streamingplus.io/v1/deployments?limit=20&cursor=eyJuYW1lIjoiYWJjIn0="
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "cursor": "eyJuYW1lIjoieHl6In0=",
    "hasMore": true
  }
}
```

## OpenAPI Specification

The full OpenAPI 3.0 specification is available at:

```
https://api.streamingplus.io/v1/openapi.json
https://api.streamingplus.io/v1/openapi.yaml
```

Import it into Postman, Insomnia, or any OpenAPI-compatible tool.
