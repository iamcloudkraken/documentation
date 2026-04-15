---
id: http
sidebar_label: HTTP / Webhook
title: HTTP / Webhook Source
---

# HTTP / Webhook Source

The HTTP source ingests data via HTTP endpoints. It supports two modes:

- **Push mode (webhook)** — STREAMINGPLUS generates a unique HTTPS endpoint. External systems POST events to this URL. This is ideal for SaaS platforms (Stripe, GitHub, Shopify, Segment) that support webhook delivery.
- **Pull mode (polling)** — STREAMINGPLUS periodically fetches data from an external HTTP API on a configurable schedule. Supports cursor and offset-based pagination.

Delivery guarantee: **at-least-once** in both modes.

---

## Push Mode (Webhook)

### How it works

When you create an HTTP source in push mode, STREAMINGPLUS generates a unique webhook URL. External systems POST JSON (or other formats) to this URL. STREAMINGPLUS buffers received events internally and emits them into the pipeline.

### Generate a webhook endpoint

```bash
sp sources webhook create \
  --name stripe-events \
  --format json \
  --namespace data-platform
```

Output:

```
Webhook URL:    https://ingest.streamingplus.io/webhooks/v1/org-id/stripe-events
Signing Secret: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Configure this URL in your external system's webhook settings.
```

:::tip
The webhook URL is persistent for the lifetime of the source. The signing secret can be rotated with `sp sources webhook rotate-secret stripe-events` without changing the URL.
:::

### HMAC Signature Validation

STREAMINGPLUS validates incoming webhook payloads using HMAC signatures to prevent spoofed requests. Validation is per-provider or custom:

| Provider | Header | Algorithm | Signature Format |
|---|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256 | `t=<ts>,v1=<sig>` |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 | `sha256=<sig>` |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 | Base64-encoded |
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 | Base64-encoded |
| Segment | `X-Signature` | HMAC-SHA1 | Hex-encoded |
| Custom | Configurable | HMAC-SHA256 / SHA512 | Configurable |

Configure signature validation in the source YAML:

```yaml
spec:
  source:
    type: http
    http:
      mode: push
      push:
        validation:
          provider: stripe
          signingSecretRef:
            name: stripe-webhook-secret
            key: signing-secret
          toleranceSeconds: 300        # Reject events older than 5 minutes
```

For custom HMAC validation:

```yaml
push:
  validation:
    provider: custom
    signatureHeader: X-My-Signature
    algorithm: hmac-sha256
    encoding: hex                       # hex | base64
    signingSecretRef:
      name: my-webhook-secret
      key: secret
    includeTimestampHeader: X-Timestamp
    toleranceSeconds: 60
```

### Webhook source YAML (full push example)

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: stripe-payment-events
  namespace: data-platform
spec:
  source:
    type: http
    http:
      mode: push
      valueFormat: json
      push:
        bufferSize: 10000
        maxPayloadBytes: 5242880          # 5 MB
        acknowledgement: sync             # sync | async
        validation:
          provider: stripe
          signingSecretRef:
            name: stripe-webhook-secret
            key: signing-secret
          toleranceSeconds: 300
        auth:
          type: none                      # none | bearer | basic | ip-allowlist
        ipAllowlist:
          - 3.18.12.63/32                 # Stripe IP range example
          - 3.130.192.231/32
```

---

## Pull Mode (Polling)

### How it works

STREAMINGPLUS periodically calls an external HTTP API and emits the returned records into the pipeline. It supports REST APIs with various pagination strategies.

### Basic polling example

```yaml
spec:
  source:
    type: http
    http:
      mode: pull
      valueFormat: json
      pull:
        url: https://api.example.com/v2/events
        method: GET
        interval: 60s
        dataPath: $.data                  # JSONPath to the records array
```

### Cursor pagination

For APIs that return a cursor or next-page token in each response:

```yaml
pull:
  url: https://api.example.com/v2/events
  method: GET
  interval: 30s
  dataPath: $.events
  pagination:
    type: cursor
    cursorPath: $.next_cursor             # JSONPath to the cursor in the response
    cursorParam: cursor                   # Query parameter name for the cursor
    stopWhen: empty-data                  # Stop page iteration when data is empty
```

### Offset pagination

For APIs that use limit/offset parameters:

```yaml
pull:
  url: https://api.example.com/v2/records
  method: GET
  interval: 120s
  dataPath: $.records
  pagination:
    type: offset
    offsetParam: offset
    limitParam: limit
    limit: 100
    stopWhen: empty-data
```

### Link header pagination (RFC 5988)

For APIs that return a `Link: <url>; rel="next"` header:

```yaml
pull:
  url: https://api.github.com/orgs/myorg/events
  method: GET
  interval: 60s
  dataPath: $[*]
  pagination:
    type: link-header
    stopWhen: no-next-link
```

---

## Authentication Options

| Auth Type | Description | Configuration |
|---|---|---|
| `none` | No authentication. | — |
| `bearer` | Bearer token in `Authorization` header. | `bearerTokenSecretRef` |
| `basic` | HTTP Basic auth. | `username`, `passwordSecretRef` |
| `api-key` | API key in a custom header or query param. | `apiKeyHeader` or `apiKeyParam`, `apiKeySecretRef` |
| `oauth2-client-credentials` | OAuth 2.0 client credentials flow. Token auto-refreshed. | `tokenUrl`, `clientIdSecretRef`, `clientSecretSecretRef`, `scopes` |

### Bearer token example

```yaml
pull:
  url: https://api.example.com/v2/events
  auth:
    type: bearer
    bearerTokenSecretRef:
      name: api-credentials
      key: token
```

### OAuth 2.0 client credentials example

```yaml
pull:
  url: https://api.example.com/v2/events
  auth:
    type: oauth2-client-credentials
    tokenUrl: https://auth.example.com/oauth/token
    clientIdSecretRef:
      name: oauth-credentials
      key: client-id
    clientSecretSecretRef:
      name: oauth-credentials
      key: client-secret
    scopes:
      - events:read
      - events:list
```

---

## Full YAML Example (Pull Mode with OAuth 2.0)

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: crm-events-poll
  namespace: data-platform
spec:
  source:
    type: http
    http:
      mode: pull
      valueFormat: json
      pull:
        url: https://api.crm.example.com/v3/events
        method: GET
        interval: 30s
        dataPath: $.events
        headers:
          Accept: application/json
          X-API-Version: "3"
        queryParams:
          status: active
          sort: created_at:asc

        pagination:
          type: cursor
          cursorPath: $.pagination.next_cursor
          cursorParam: cursor
          stopWhen: empty-data

        auth:
          type: oauth2-client-credentials
          tokenUrl: https://auth.crm.example.com/oauth/token
          clientIdSecretRef:
            name: crm-oauth
            key: client-id
          clientSecretSecretRef:
            name: crm-oauth
            key: client-secret
          scopes:
            - events:read

        timeout: 30s
        retries: 3
        retryBackoff: exponential
        tlsVerify: true
```

---

## CLI Quickstart

Create a webhook source:

```bash
sp sources webhook create \
  --name github-push-events \
  --format json \
  --provider github \
  --signing-secret-ref github-webhook-secret \
  --namespace data-platform
```

Create a polling source:

```bash
sp sources http-poll create \
  --name crm-events-poll \
  --url https://api.crm.example.com/v3/events \
  --format json \
  --interval 30s \
  --data-path '$.events' \
  --auth bearer \
  --token-secret api-credentials \
  --namespace data-platform
```

Check webhook delivery stats:

```bash
sp sources status stripe-payment-events
```

```
MODE          EVENTS-RECEIVED   EVENTS-FAILED   VALIDATION-ERRORS   BUFFER-USED
push/webhook  1,482,033         0               12                  2.4%
```
