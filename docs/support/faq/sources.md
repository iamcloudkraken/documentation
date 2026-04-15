---
id: faq-sources
sidebar_label: Sources
title: Sources FAQ
---

# Sources FAQ

## What delivery guarantee does the Kafka → Flink → Data Lake pipeline provide?

STREAMINGPLUS supports **exactly-once** end-to-end delivery for this pipeline pattern when all three conditions are met:

1. `reliabilityTier: exactly-once` is set on the Pipeline.
2. The Kafka source has `isolation.level: read_committed` configured (STREAMINGPLUS sets this automatically).
3. The Data Lake sink uses **two-phase commit** (enabled by default for S3 and GCS sinks — files are written to a staging prefix and atomically renamed on commit).

Without exactly-once, the default guarantee is **at-least-once**, which means duplicate records are possible during Flink task manager restarts.

---

## How do I monitor Flink job throughput and consumer lag?

STREAMINGPLUS exposes Flink metrics via the `sp-metrics` Prometheus endpoint. Key metrics to watch:

| Metric | Description |
|--------|-------------|
| `flink_taskmanager_job_task_numRecordsInPerSecond` | Records consumed from Kafka per second |
| `flink_taskmanager_job_task_numRecordsOutPerSecond` | Records written to the sink per second |
| `kafka_consumer_lag_sum` | Total consumer lag across all partitions |
| `flink_jobmanager_job_lastCheckpointDuration` | Time taken to complete the last checkpoint |
| `flink_jobmanager_job_numberOfFailedCheckpoints` | Cumulative failed checkpoint count |

Consumer lag alerts are configured per pipeline:

```yaml
spec:
  slo:
    maxConsumerLagSeconds: 60   # alert if lag exceeds 60 seconds
    maxCheckpointDurationMs: 30000
```

You can also view a pre-built dashboard in the STREAMINGPLUS console under **Pipelines → {name} → Observability**.
