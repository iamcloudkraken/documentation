---
id: faq-sinks
sidebar_label: Sinks
title: Sinks FAQ
---

# Sinks FAQ

## What file formats does the Data Lake sink support when using Flink?

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

## How are output files partitioned in the Data Lake?

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

## How large do output Parquet files get, and can I control file size?

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
