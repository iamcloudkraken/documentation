---
id: endpoints
sidebar_label: Endpoints
title: API Endpoints
---

# API Endpoints

All endpoints are relative to the base URL `https://api.streamingplus.io/v1`. All requests require `Authorization: Bearer <token>`.

## Environments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/environments` | List all environments |
| `POST` | `/environments` | Create a new environment |
| `GET` | `/environments/{name}` | Get environment details and status |
| `PATCH` | `/environments/{name}` | Update environment settings |
| `DELETE` | `/environments/{name}` | Delete an environment |
| `GET` | `/environments/{name}/health` | Get environment health summary |
| `POST` | `/environments/{name}/upgrade` | Trigger a version upgrade |

## Deployments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/deployments` | List all deployments (scoped by `?env=` query param) |
| `POST` | `/deployments` | Create a new deployment |
| `GET` | `/deployments/{name}` | Get deployment spec and status |
| `PUT` | `/deployments/{name}` | Replace a deployment spec |
| `PATCH` | `/deployments/{name}` | Partially update a deployment |
| `DELETE` | `/deployments/{name}` | Delete a deployment |
| `POST` | `/deployments/{name}/rollback` | Roll back to a previous revision |
| `GET` | `/deployments/{name}/history` | List deployment revision history |
| `GET` | `/deployments/{name}/logs` | Stream live deployment logs (Server-Sent Events) |
| `GET` | `/deployments/{name}/metrics` | Get current throughput and latency metrics |

### Create Deployment — Example Request

```bash
curl -X POST \
  -H "Authorization: Bearer $SP_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- https://api.streamingplus.io/v1/deployments <<'EOF'
{
  "name": "payments-to-bigquery",
  "environment": "production",
  "spec": {
    "source": {
      "type": "kafka",
      "connectionRef": "kafka-prod",
      "topics": ["raw-payments"],
      "format": "json"
    },
    "sink": {
      "type": "bigquery",
      "connectionRef": "bigquery-prod",
      "projectId": "my-gcp-project",
      "datasetId": "analytics",
      "tableId": "payments"
    }
  }
}
EOF
```

## Connections

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/connections` | List all connections |
| `POST` | `/connections` | Create a new connection |
| `GET` | `/connections/{name}` | Get connection config and status |
| `PUT` | `/connections/{name}` | Replace a connection |
| `DELETE` | `/connections/{name}` | Delete a connection |
| `POST` | `/connections/{name}/test` | Test connectivity and auth |

## Secrets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/secrets` | List secret key names (values never returned) |
| `PUT` | `/secrets/{key}` | Create or update a secret value |
| `DELETE` | `/secrets/{key}` | Delete a secret |

## Pipelines

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pipelines` | List all pipelines |
| `POST` | `/pipelines` | Create a pipeline |
| `GET` | `/pipelines/{name}` | Get pipeline spec |
| `DELETE` | `/pipelines/{name}` | Delete a pipeline |
| `GET` | `/pipelines/{name}/runs` | List pipeline run history |
| `GET` | `/pipelines/{name}/runs/{runId}` | Get a specific pipeline run |
| `POST` | `/pipelines/{name}/runs/{runId}/abort` | Abort a running pipeline |
| `POST` | `/pipelines/{name}/runs/{runId}/stages/{stage}/approve` | Approve a gate |
| `POST` | `/pipelines/{name}/runs/{runId}/stages/{stage}/reject` | Reject a gate |

## GitOps

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/gitops/sources` | List GitOps sources |
| `POST` | `/gitops/sources` | Create a GitOps source |
| `GET` | `/gitops/sources/{name}` | Get GitOps source status |
| `DELETE` | `/gitops/sources/{name}` | Remove a GitOps source |
| `POST` | `/gitops/sources/{name}/sync` | Trigger an immediate sync |
| `GET` | `/gitops/sources/{name}/diff` | Get pending diff (desired vs live) |
| `GET` | `/gitops/drift` | List detected drift events |

## SLOs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/slos` | List all SLOs |
| `POST` | `/slos` | Create an SLO |
| `GET` | `/slos/{name}` | Get SLO definition and current status |
| `PUT` | `/slos/{name}` | Update an SLO |
| `DELETE` | `/slos/{name}` | Delete an SLO |
| `GET` | `/slos/{name}/burn-rate` | Get current error budget burn rate |

## RBAC

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rbac/users` | List all users |
| `POST` | `/rbac/users/invite` | Invite a user |
| `DELETE` | `/rbac/users/{email}` | Remove a user |
| `GET` | `/rbac/service-accounts` | List service accounts |
| `POST` | `/rbac/service-accounts` | Create a service account |
| `POST` | `/rbac/service-accounts/{name}/token` | Generate an API token |
| `DELETE` | `/rbac/service-accounts/{name}` | Delete a service account |

## Audit

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit/events` | Query audit log events |
| `GET` | `/audit/events/{id}` | Get a specific audit event |
