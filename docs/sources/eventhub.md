---
id: eventhub
sidebar_label: Azure Event Hubs
title: Azure Event Hubs Source
---

# Azure Event Hubs Source

The Azure Event Hubs source reads events from an Event Hubs namespace using the **Kafka protocol endpoint** exposed by Event Hubs. This means no Event Hubs-specific SDK is required — STREAMINGPLUS uses its standard Kafka consumer internally, configured to authenticate against the Event Hubs SASL/SSL endpoint.

Delivery guarantee: **at-least-once**. Consumer group offsets are tracked and checkpointed, but Event Hubs does not support exactly-once transactional consumers.

---

## How It Works

Azure Event Hubs exposes a Kafka-compatible endpoint at:

```
<namespace>.servicebus.windows.net:9093
```

STREAMINGPLUS connects to this endpoint using SASL/SSL authentication. The Event Hub name maps to a Kafka topic, and an Event Hubs consumer group maps to a Kafka consumer group.

---

## Required Properties

| Property | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `namespace` | string | Yes | — | Event Hubs namespace name (without `.servicebus.windows.net`). |
| `eventHub` | string | Yes | — | Event Hub name (equivalent to a Kafka topic). |
| `consumerGroup` | string | Yes | — | Consumer group name. Use `$Default` for the built-in consumer group. |
| `valueFormat` | string | Yes | — | Deserialization format: `json`, `avro`, `raw`. |
| `tier` | string | No | `standard` | Event Hubs tier: `standard`, `premium`, `dedicated`. Affects available features. |

## Optional Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `startupMode` | string | `group-offsets` | Starting position: `latest-offset`, `earliest-offset`, `group-offsets`, `timestamp`. |
| `startTimestamp` | string | — | ISO 8601 timestamp for `timestamp` startup mode. |
| `maxBatchSize` | int | `500` | Maximum records per poll batch. |
| `prefetchCount` | int | `500` | Number of messages to prefetch per partition. |
| `includePartition` | bool | `false` | Include the partition ID as a field in the output record. |
| `includeOffset` | bool | `false` | Include the Event Hubs offset as a field in the output record. |
| `includeEnqueuedTime` | bool | `false` | Include the enqueued timestamp as a field in the output record. |
| `includeProperties` | bool | `false` | Include custom event properties as a map field in the output record. |

---

## Authentication

### SASL/SSL with connection string (recommended for most environments)

Event Hubs uses Shared Access Signature (SAS) tokens passed as SASL PLAIN credentials over TLS.

```yaml
security:
  protocol: SASL_SSL
  sasl:
    mechanism: PLAIN
    username: "$ConnectionString"
    password:
      secretRef:
        name: eventhubs-connection-string
        key: connection-string
```

Store the Event Hubs connection string in a Kubernetes secret:

```bash
kubectl create secret generic eventhubs-connection-string \
  --from-literal=connection-string="Endpoint=sb://mynamespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=xxxx" \
  --namespace data-platform
```

The connection string must have at least `Listen` permission on the Event Hub.

### Managed Identity (Azure Workload Identity)

For AKS clusters with Azure Workload Identity configured, use managed identity to avoid storing connection strings:

```yaml
auth:
  type: managed-identity
  clientId: 00000000-0000-0000-0000-000000000000
  tenantId: 00000000-0000-0000-0000-000000000001
```

The managed identity must have the **Azure Event Hubs Data Receiver** role on the Event Hubs namespace or the specific Event Hub.

```bash
az role assignment create \
  --role "Azure Event Hubs Data Receiver" \
  --assignee 00000000-0000-0000-0000-000000000000 \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.EventHub/namespaces/<namespace>
```

:::tip
Use managed identity in production AKS deployments. It eliminates the need to rotate SAS connection strings and provides better audit trails through Azure Activity Log.
:::

---

## Full YAML Example (SASL/SSL)

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: eventhub-telemetry-pipeline
  namespace: data-platform
spec:
  source:
    type: eventhub
    eventhub:
      namespace: my-eventhubs-namespace
      eventHub: telemetry-events
      consumerGroup: sp-telemetry-pipeline
      valueFormat: json
      startupMode: group-offsets
      tier: standard

      security:
        protocol: SASL_SSL
        sasl:
          mechanism: PLAIN
          username: "$ConnectionString"
          password:
            secretRef:
              name: eventhubs-connection-string
              key: connection-string

      includeEnqueuedTime: true
      enqueuedTimeField: enqueued_at
      includePartition: true
      partitionField: __partition
      includeProperties: true
      propertiesField: __properties

      maxBatchSize: 1000
      prefetchCount: 1000

      errorHandling:
        parseErrorPolicy: dead-letter
        deadLetterEventHub: telemetry-events-dlq
```

## Full YAML Example (Managed Identity)

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: eventhub-telemetry-pipeline
  namespace: data-platform
spec:
  source:
    type: eventhub
    eventhub:
      namespace: my-eventhubs-namespace
      eventHub: telemetry-events
      consumerGroup: sp-telemetry-pipeline
      valueFormat: json
      startupMode: latest-offset

      auth:
        type: managed-identity
        clientId: 00000000-0000-0000-0000-000000000000
        tenantId: 00000000-0000-0000-0000-000000000001
```

---

## CLI Quickstart

```bash
sp pipelines create eventhub-telemetry-pipeline \
  --source eventhub \
  --namespace my-eventhubs-namespace \
  --event-hub telemetry-events \
  --consumer-group sp-telemetry-pipeline \
  --format json \
  --connection-string-secret eventhubs-connection-string \
  --namespace data-platform
```

Check consumer progress:

```bash
sp sources status eventhub-telemetry-pipeline
```

```
PARTITION   CONSUMER-OFFSET   SEQUENCE-NUMBER   LAG
0           823,492           823,492           0
1           819,834           819,921           87
2           821,203           821,203           0
```

---

## Supported Event Hubs Tiers

| Tier | Max Partitions | Retention | Capture | Notes |
|---|---|---|---|---|
| Standard | 32 | 1–7 days | Optional (extra cost) | Sufficient for most workloads |
| Premium | 100 | 1–90 days | Included | For high-throughput, latency-sensitive workloads |
| Dedicated | Unlimited | 1–90 days | Included | Single-tenant, highest isolation |

:::note
The `premium` and `dedicated` tiers support schema registry integration through the Azure Schema Registry service. Pass `schemaRegistry.type: azure` to use it.
:::
