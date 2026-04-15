---
id: http
sidebar_label: HTTP / Webhook
title: HTTP / Webhook Sink
---

# HTTP / Webhook Sink

The HTTP sink delivers records to any HTTP or HTTPS endpoint via POST (or configurable method) requests. It supports batching, multiple authentication modes, configurable retry logic, and request signing for HMAC-protected webhooks.

## Required Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | string | Yes | Target endpoint URL |
| `method` | string | No | HTTP method: `POST` (default), `PUT`, `PATCH` |
| `connectionRef` | string | Yes | Reference to an HTTP `Connection` resource (holds auth) |
| `contentType` | string | No | `application/json` (default), `application/x-ndjson`, `application/octet-stream` |
| `headers` | map | No | Additional static headers to include in every request |
| `batching` | object | No | Batch multiple records into a single request |
| `auth` | object | No | Authentication configuration (see table below) |
| `retry` | object | No | Retry policy for failed requests |
| `timeout` | integer | No | Per-request timeout in milliseconds (default: `30000`) |

## Authentication Methods

| Auth Type | Description | Required Fields |
|-----------|-------------|-----------------|
| `bearer` | Sends `Authorization: Bearer <token>` | `token` in secret |
| `basic` | Sends `Authorization: Basic <base64>` | `username`, `password` in secret |
| `hmac` | Signs request body with HMAC-SHA256, adds `X-Signature-256` header | `signingKey` in secret |
| `oauth2-client-credentials` | Fetches and refreshes OAuth2 token automatically | `clientId`, `clientSecret`, `tokenUrl` in secret |
| `none` | No authentication | — |

### Bearer Token Auth YAML

```yaml
apiVersion: streamingplus.io/v1
kind: Connection
metadata:
  name: webhook-bearer
spec:
  type: http
  auth:
    type: bearer
    secretRef: webhook-token-secret   # must contain `token` key
```

### HMAC Signing Auth YAML

```yaml
apiVersion: streamingplus.io/v1
kind: Connection
metadata:
  name: webhook-hmac
spec:
  type: http
  auth:
    type: hmac
    secretRef: webhook-hmac-secret    # must contain `signingKey` key
    algorithm: SHA256
    headerName: X-Hub-Signature-256   # GitHub-style HMAC header
    prefix: "sha256="
```

## Batching Configuration

By default, each record is sent in an individual HTTP request. Enable batching to group multiple records into a single request body (as a JSON array or NDJSON):

```yaml
spec:
  sink:
    type: http
    connectionRef: webhook-bearer
    url: https://api.example.com/events
    contentType: application/json
    batching:
      enabled: true
      maxBatchSize: 100          # max records per request
      maxBatchSizeBytes: 1048576 # max request body size (1 MB)
      flushIntervalMs: 5000      # send at least every 5 s
      format: array              # wrap batch in a JSON array
```

With `format: array`, the request body will be:

```json
[
  {"event_id": "abc", "type": "purchase"},
  {"event_id": "def", "type": "view"}
]
```

Use `format: ndjson` for newline-delimited JSON (one record per line), which is common for log ingestion APIs.

## Retry Configuration

```yaml
spec:
  sink:
    type: http
    url: https://api.example.com/events
    connectionRef: webhook-bearer
    retry:
      maxAttempts: 5
      initialBackoffMs: 500
      maxBackoffMs: 30000
      backoffMultiplier: 2.0         # exponential back-off
      retryableStatusCodes:
        - 429   # Too Many Requests
        - 502   # Bad Gateway
        - 503   # Service Unavailable
        - 504   # Gateway Timeout
      nonRetryableStatusCodes:
        - 400   # Bad Request — don't retry malformed payloads
        - 401   # Unauthorized — alert instead
        - 403   # Forbidden
```

:::warning
Responses with status `4xx` other than `429` are typically not retryable because the payload is malformed or rejected. Route such failures to the dead-letter sink by listing non-retryable status codes explicitly.
:::

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Deployment
metadata:
  name: events-to-webhook
  namespace: production
spec:
  source:
    type: kafka
    connectionRef: kafka-prod
    topics:
      - order-confirmed
    format: json
  transforms:
    - type: rename-fields
      mappings:
        order_id: orderId
        customer_id: customerId
    - type: drop-fields
      fields:
        - internal_trace_id
  sink:
    type: http
    connectionRef: webhook-hmac
    url: https://partner-api.example.com/v2/webhooks/orders
    method: POST
    contentType: application/json
    headers:
      X-Source: streamingplus
      X-Environment: production
    batching:
      enabled: true
      maxBatchSize: 50
      maxBatchSizeBytes: 524288
      flushIntervalMs: 3000
      format: array
    retry:
      maxAttempts: 5
      initialBackoffMs: 500
      maxBackoffMs: 30000
      backoffMultiplier: 2.0
      retryableStatusCodes:
        - 429
        - 502
        - 503
        - 504
    timeout: 15000
    errorHandling:
      deadLetterSink:
        type: kafka
        connectionRef: kafka-prod
        topic: streamingplus.dead-letter.webhook
      maxRetries: 5
```

## TLS / Certificate Pinning

For high-security webhook endpoints, configure certificate pinning in the connection:

```yaml
spec:
  type: http
  tls:
    caCertSecretRef: webhook-ca-cert
    clientCertSecretRef: mutual-tls-cert   # for mTLS
    pinnedCertFingerprint: "sha256/..."    # optional pinning
    insecureSkipVerify: false
```

:::note
`insecureSkipVerify: true` disables TLS certificate validation. Never use this in production.
:::
