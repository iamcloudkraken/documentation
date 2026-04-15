---
id: pubsub
sidebar_label: Google Pub/Sub
title: Google Pub/Sub Source
---

# Google Pub/Sub Source

The Google Pub/Sub source subscribes to a Pub/Sub subscription and reads messages as a continuous stream. It supports Workload Identity for credential-free authentication in GKE environments and standard service account key authentication for non-GKE deployments.

Delivery guarantee: **at-least-once**. Pub/Sub guarantees at-least-once delivery. Messages are acknowledged only after successful downstream processing and checkpointing.

---

## Required Properties

| Property | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `project` | string | Yes | — | GCP project ID that owns the Pub/Sub subscription. |
| `subscription` | string | Yes | — | Pub/Sub subscription name (not the topic name). |
| `valueFormat` | string | Yes | — | Deserialization format for the message data: `json`, `avro`, `protobuf`, `raw`. |

## Optional Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `maxOutstandingMessages` | int | `1000` | Maximum number of unacknowledged messages held in memory. Controls backpressure. |
| `maxOutstandingBytes` | int | `104857600` | Maximum unacknowledged message bytes (default 100 MB). |
| `parallelPullCount` | int | `1` | Number of parallel goroutines pulling messages from the subscription. |
| `includeAttributes` | bool | `false` | If `true`, message attributes are included as a map field in the output record. |
| `attributesField` | string | `__pubsub_attributes` | Field name for message attributes when `includeAttributes: true`. |
| `includeMessageId` | bool | `false` | Include the Pub/Sub message ID in the output record. |
| `messageIdField` | string | `__pubsub_message_id` | Field name for the message ID. |
| `includePublishTime` | bool | `false` | Include the Pub/Sub publish timestamp in the output record. |
| `publishTimeField` | string | `__pubsub_publish_time` | Field name for the publish timestamp. |

---

## Authentication

### Workload Identity (recommended for GKE)

GKE Workload Identity binds a Kubernetes service account to a GCP service account, eliminating the need for service account JSON key files.

```yaml
auth:
  type: workload-identity
  gcpServiceAccount: sp-pubsub-reader@my-gcp-project.iam.gserviceaccount.com
```

Set up Workload Identity binding:

```bash
# Grant the GCP service account the Pub/Sub Subscriber role
gcloud pubsub subscriptions add-iam-policy-binding my-subscription \
  --member="serviceAccount:sp-pubsub-reader@my-gcp-project.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"

# Bind the Kubernetes service account to the GCP service account
gcloud iam service-accounts add-iam-policy-binding \
  sp-pubsub-reader@my-gcp-project.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:my-gcp-project.svc.id.goog[data-platform/sp-pipeline-sa]"
```

:::tip
Workload Identity is the strongly recommended authentication method for GKE-hosted pipelines. It eliminates long-lived service account key files and integrates with GCP's audit logging for all Pub/Sub API calls.
:::

### Service account key (non-GKE environments)

```yaml
auth:
  type: service-account-key
  serviceAccountKeySecretRef:
    name: gcp-sa-key
    key: key.json
```

Store the JSON key in a Kubernetes secret:

```bash
kubectl create secret generic gcp-sa-key \
  --from-file=key.json=/path/to/service-account-key.json \
  --namespace data-platform
```

---

## Schema Registry (Protobuf / Avro)

For Avro or Protobuf encoded messages, reference a schema registry connection:

```yaml
schemaRegistry:
  connection: confluent-sr-prod
  messageEncoding: protobuf
  protoDescriptorSecretRef:
    name: proto-descriptors
    key: payment_events.pb
```

---

## Full YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: pubsub-user-events
  namespace: data-platform
spec:
  source:
    type: pubsub
    pubsub:
      project: my-gcp-project
      subscription: user-events-sub
      valueFormat: json

      auth:
        type: workload-identity
        gcpServiceAccount: sp-pubsub-reader@my-gcp-project.iam.gserviceaccount.com

      maxOutstandingMessages: 2000
      maxOutstandingBytes: 209715200   # 200 MB
      parallelPullCount: 4

      includeAttributes: true
      attributesField: __attributes
      includePublishTime: true
      publishTimeField: publish_time
      includeMessageId: true
      messageIdField: message_id

      errorHandling:
        parseErrorPolicy: dead-letter
        deadLetterTopic: projects/my-gcp-project/topics/user-events-dlq

      ackDeadline: 60s
      retainAckedMessages: false
```

---

## Creating a Pub/Sub Subscription

If you need to create a Pub/Sub subscription before connecting STREAMINGPLUS:

```bash
gcloud pubsub subscriptions create user-events-sub \
  --topic user-events \
  --ack-deadline 60 \
  --message-retention-duration 7d \
  --enable-exactly-once-delivery
```

:::note
Enable exactly-once delivery at the Pub/Sub subscription level for best results. This prevents duplicate message delivery at the Pub/Sub layer, though end-to-end exactly-once still depends on sink idempotency.
:::

---

## CLI Quickstart

```bash
sp pipelines create pubsub-user-events \
  --source pubsub \
  --project my-gcp-project \
  --subscription user-events-sub \
  --format json \
  --workload-identity \
  --gcp-service-account sp-pubsub-reader@my-gcp-project.iam.gserviceaccount.com \
  --namespace data-platform
```

Check message backlog:

```bash
sp sources status pubsub-user-events
```

```
SUBSCRIPTION          BACKLOG   OLDEST-UNACKED   PULL-RATE
user-events-sub       142       3.2s             4,823/sec
```
