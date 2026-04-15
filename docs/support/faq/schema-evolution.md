---
id: faq-schema-evolution
sidebar_label: Schema Evolution
title: Schema Evolution FAQ
---

# Schema Evolution FAQ

## How do I handle schema evolution when writing Parquet to S3?

STREAMINGPLUS integrates with an optional **Schema Registry** (Confluent-compatible). When a Schema Registry connection is configured on the Environment, the Flink job:

1. Reads the current schema for the Kafka topic from the registry.
2. Validates each record on ingestion.
3. On schema evolution (new optional field added), updates the Parquet schema in the new file and registers the updated schema in the Data Catalog.
4. On breaking changes (field removed or type changed), the job pauses and emits a `SchemaEvolutionBlocked` alert. You resolve it by either migrating existing data or pinning to the old schema version.

For pipelines without a Schema Registry, STREAMINGPLUS infers the schema from the first batch of records in each checkpoint interval. Schema drift across batches causes a task-manager-level restart.
