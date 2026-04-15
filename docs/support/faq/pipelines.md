---
id: faq-pipelines
sidebar_label: Pipelines
title: Pipelines FAQ
---

# Pipelines FAQ

## How does STREAMINGPLUS manage Flink checkpointing?

STREAMINGPLUS configures Flink checkpointing automatically based on the `reliabilityTier` set on the Pipeline resource:

| Reliability Tier | Checkpoint Interval | Retention | State Backend |
|------------------|---------------------|-----------|---------------|
| `best-effort` | 5 minutes | 1 checkpoint | HashMapStateBackend |
| `standard` (default) | 1 minute | 3 checkpoints | RocksDB (incremental) |
| `exactly-once` | 30 seconds | 10 checkpoints | RocksDB (incremental) |

Checkpoints are stored in the same S3 bucket as your Data Lake output, under the `_checkpoints/` prefix. You can override the checkpoint interval in the Pipeline spec:

```yaml
spec:
  flink:
    checkpointInterval: 60s
    checkpointTimeout: 120s
    restartStrategy:
      type: fixed-delay
      attempts: 3
      delay: 30s
```

---

## My Flink job keeps restarting. How do I diagnose it?

Start with the pipeline status:

```bash
sp pipelines status <name> --env production
```

Common causes and fixes:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `RESTARTING` loop with `OutOfMemoryError` | Task Manager heap too small | Increase `spec.flink.taskManager.memory` |
| Checkpoint timeout exceeded | State too large or S3 throughput throttled | Switch to incremental RocksDB checkpoints; enable S3 Transfer Acceleration |
| `KafkaException: Offset out of range` | Kafka topic retention deleted offsets before Flink could read them | Increase Kafka retention or reduce checkpoint interval |
| Frequent restarts with no error | Liveness probe too aggressive | Increase `spec.flink.livenessProbe.failureThreshold` |

For detailed Flink logs:

```bash
sp pipelines logs <name> --env production --component task-manager --tail 200
```
