---
id: faq
sidebar_label: FAQ
title: FAQ
---

# Frequently Asked Questions

## Pricing & Free Tier

**Is there a free tier?**

Yes. The **Starter** tier is free for up to 2 environments and 5 concurrent Deployments. No credit card is required to sign up. The Starter tier includes:
- 1 GB/day of data throughput
- Community Slack support
- 7-day audit log retention
- All sink and source types

To upgrade to Professional or Enterprise, visit the Billing section in the STREAMINGPLUS console or contact sales@streamingplus.io.

---

## Kubernetes Version Support

**Which Kubernetes versions are supported?**

STREAMINGPLUS supports Kubernetes **1.25 and later**. Support tracks the upstream Kubernetes release cycle. When Kubernetes reaches end-of-life for a minor version, STREAMINGPLUS drops support in the next minor release (with at least 3 months notice).

Tested distributions include: EKS, GKE, AKS, OpenShift 4.12+, k3s 1.25+, Rancher RKE2.

---

## On-Premises Support

**Can I run STREAMINGPLUS on-premises (without a cloud provider)?**

Yes. The **Self-Hosted** deployment option runs the full STREAMINGPLUS stack on any Kubernetes cluster — including bare-metal, on-premises VMware, or private data centers. You need:
- A Kubernetes 1.25+ cluster
- S3-compatible object storage (MinIO works)
- PostgreSQL 14+ for the control plane database
- A valid STREAMINGPLUS Enterprise license

See [Self-Hosted Deployment](../deployment/self-hosted) for step-by-step instructions.

---

## SLA

**What is the SLA for the managed control plane?**

| Tier | SLA | Measurement |
|------|-----|-------------|
| Starter | No SLA | Best effort |
| Professional | 99.9% monthly uptime | Rolling 30-day window |
| Enterprise | 99.99% monthly uptime | Rolling 30-day window |

SLA credits are issued automatically for breaches. See the Service Agreement for credit terms.

---

## Data Residency

**Where is my data stored? Does STREAMINGPLUS have access to my streaming data?**

STREAMINGPLUS **never has access to your application data**. Streaming data flows entirely within your infrastructure — from your sources to your sinks — without passing through the STREAMINGPLUS Control Plane. The Control Plane only stores:
- Resource configuration (Deployment specs, Connection configs)
- Audit logs
- Metrics metadata

All control plane metadata is stored in the cloud region you select during environment creation. Data never crosses regional boundaries unless explicitly configured.

---

## Terraform Support

**Can I manage STREAMINGPLUS resources with Terraform?**

Yes. The official Terraform provider `streamingplus/streamingplus` is available on the Terraform Registry. It supports all major resource types: `streamingplus_environment`, `streamingplus_deployment`, `streamingplus_connection`, `streamingplus_pipeline`, `streamingplus_slo`.

See the [Terraform Integration](../integrations/terraform) page for provider configuration and resource examples.

---

## Rollback Time

**How fast is rollback?**

For **Deployment** resources, rollback is near-instant:
- STREAMINGPLUS stops writing new records with the current version
- Starts up the previous revision (image + spec)
- Typically completes in **30–90 seconds** for stateless pipelines

For **Pipeline** canary rollbacks, the canary instances are stopped and all traffic is redirected to the stable version. This completes in under 60 seconds.

Trigger a rollback with:
```bash
sp deployments rollback <name> --env production
```

---

## Multi-Cloud

**Is multi-cloud supported?**

Yes. A single STREAMINGPLUS Control Plane can manage environments across AWS, GCP, and Azure simultaneously. You can:
- Run different environments on different clouds
- Fan out from one Kafka source to sinks on multiple clouds
- Use GitOps to manage all environments from a single repository

There is no additional cost for managing multi-cloud environments.

---

## Air-Gapped Installs

**Can STREAMINGPLUS be installed in a fully air-gapped environment?**

Yes, for **Enterprise** customers. Air-gapped installation is supported via an offline bundle:

```bash
# On a machine with internet access
sp release download --version 1.3.0 --output sp-release-1.3.0.tar.gz
```

The bundle contains all container images and Helm charts. Transfer it to your air-gapped network and install using:

```bash
sp release install \
  --bundle sp-release-1.3.0.tar.gz \
  --registry internal-registry.example.com:5000 \
  --namespace streamingplus-system
```

Contact sales@streamingplus.io for air-gapped licensing and setup assistance.

---

## Upgrade Process

**How are STREAMINGPLUS upgrades handled?**

**Managed Cloud**: The Control Plane is upgraded automatically during your configured maintenance window (default: Sunday 2–4 AM UTC). Data Plane workers are upgraded via a rolling update with zero downtime.

**Self-Hosted**: Upgrades are manual, triggered by running:

```bash
helm upgrade streamingplus streamingplus/streamingplus \
  --version <new-version> \
  --reuse-values \
  --atomic
```

Always read the [Changelog](./changelog) before upgrading. Minor versions (e.g., 1.2 → 1.3) are backward-compatible. Major versions (e.g., 1.x → 2.x) may require migration steps documented in the upgrade guide.

---

## Apache Flink → Data Lake

**What file formats does the Data Lake sink support when using Flink?**

The Data Lake sink supports **Parquet** (recommended), **ORC**, and **Avro**. Parquet is the default because it offers the best trade-off of compression ratio, read performance, and compatibility with query engines (Athena, BigQuery Omni, Trino, Spark SQL).

Configure the format in your Pipeline spec:

```yaml
sink:
  type: s3
  config:
    format: parquet          # parquet | orc | avro
    compressionCodec: snappy # snappy | gzip | zstd | none
```

---

**How does STREAMINGPLUS manage Flink checkpointing?**

STREAMINGPLUS configures Flink checkpointing automatically based on the `reliabilityTier` set on the Pipeline resource:

| Reliability Tier | Checkpoint Interval | Retention | State Backend |
|---|---|---|---|
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

**What delivery guarantee does the Kafka → Flink → Data Lake pipeline provide?**

STREAMINGPLUS supports **exactly-once** end-to-end delivery for this pipeline pattern when all three conditions are met:

1. `reliabilityTier: exactly-once` is set on the Pipeline.
2. The Kafka source has `isolation.level: read_committed` configured (STREAMINGPLUS sets this automatically).
3. The Data Lake sink uses **two-phase commit** (enabled by default for S3 and GCS sinks — files are written to a staging prefix and atomically renamed on commit).

Without exactly-once, the default guarantee is **at-least-once**, which means duplicate records are possible during Flink task manager restarts.

---

**How are output files partitioned in the Data Lake?**

By default, STREAMINGPLUS partitions output using an **event-time** partition key derived from the record timestamp:

```
s3://your-bucket/your-prefix/
  year=2025/
    month=04/
      day=14/
        hour=09/
          part-0-attempt-0.parquet
```

You can customise the partition scheme in the sink config:

```yaml
sink:
  type: s3
  config:
    partitionBy:
      - field: year
      - field: month
      - field: day
    rollingPolicy:
      rollOnCheckpoint: true   # close the file on every Flink checkpoint
      maxFileSize: 256MB
      maxRolloverInterval: 5m
```

Setting `rollOnCheckpoint: true` is strongly recommended for exactly-once pipelines — it ensures that only committed checkpoint data is visible to downstream readers.

---

**How do I handle schema evolution when writing Parquet to S3?**

STREAMINGPLUS integrates with an optional **Schema Registry** (Confluent-compatible). When a Schema Registry connection is configured on the Environment, the Flink job:

1. Reads the current schema for the Kafka topic from the registry.
2. Validates each record on ingestion.
3. On schema evolution (new optional field added), updates the Parquet schema in the new file and registers the updated schema in the Data Catalog.
4. On breaking changes (field removed or type changed), the job pauses and emits a `SchemaEvolutionBlocked` alert. You resolve it by either migrating existing data or pinning to the old schema version.

For pipelines without a Schema Registry, STREAMINGPLUS infers the schema from the first batch of records in each checkpoint interval. Schema drift across batches causes a task-manager-level restart.

---

**How large do output Parquet files get, and can I control file size?**

Without tuning, Flink produces many small files — one per task manager per checkpoint. Small files hurt query performance significantly in S3-backed Data Lakes (Athena charges per-scan; Trino spends excessive time opening file handles).

STREAMINGPLUS mitigates this with a **compaction step** that runs after each checkpoint:

```yaml
sink:
  type: s3
  config:
    compaction:
      enabled: true          # default: true
      targetFileSizeMB: 256  # default: 128 MB
      triggerAfterCheckpoints: 3
```

Compaction merges small part files into target-sized files in-place, then removes the originals. The Data Catalog partition registration happens after compaction completes, so downstream queries always see compacted files.

---

**My Flink job keeps restarting. How do I diagnose it?**

Start with the pipeline status:

```bash
sp pipelines status <name> --env production
```

Common causes and fixes:

| Symptom | Likely Cause | Fix |
|---|---|---|
| `RESTARTING` loop with `OutOfMemoryError` | Task Manager heap too small | Increase `spec.flink.taskManager.memory` |
| Checkpoint timeout exceeded | State too large or S3 throughput throttled | Switch to incremental RocksDB checkpoints; enable S3 Transfer Acceleration |
| `KafkaException: Offset out of range` | Kafka topic retention deleted offsets before Flink could read them | Increase Kafka retention or reduce checkpoint interval |
| Frequent restarts with no error | Liveness probe too aggressive | Increase `spec.flink.livenessProbe.failureThreshold` |

For detailed Flink logs:

```bash
sp pipelines logs <name> --env production --component task-manager --tail 200
```

---

**How do I monitor Flink job throughput and consumer lag?**

STREAMINGPLUS exposes Flink metrics via the `sp-metrics` Prometheus endpoint. Key metrics to watch:

| Metric | Description |
|---|---|
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

You can also view a pre-built dashboard in the STREAMINGPLUS console under **Pipelines → &#123;name&#125; → Observability**.
