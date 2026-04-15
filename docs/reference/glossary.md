---
id: glossary
sidebar_label: Glossary
title: Glossary
---

# Glossary

This glossary defines terms used throughout the STREAMINGPLUS documentation.

---

**Control Plane**

The central STREAMINGPLUS service that stores desired state, serves the REST and gRPC APIs, handles authentication and authorization, and orchestrates reconciliation across all managed environments. The Control Plane never touches your data directly — it only manages configuration and control signals.

---

**Data Plane**

The compute infrastructure (Kubernetes clusters, nodes) where your streaming workloads actually run. The Data Plane executes source readers, transform functions, and sink writers. In Managed Cloud deployments, the Data Plane runs inside your VPC. In self-hosted deployments, you provide the Kubernetes clusters.

---

**Environment**

A named, isolated deployment target — for example, `development`, `staging`, or `production`. Each environment maps to a cloud region, a set of compute resources, and a Kubernetes namespace. Resources (Deployments, Connections, Secrets) are scoped to an environment.

---

**Deployment**

A STREAMINGPLUS resource (`kind: Deployment`) that defines a running data pipeline: a source to read from, optional transforms to apply, and a sink to write to. A Deployment is continuously reconciled — if it crashes, the platform restarts it automatically.

---

**GitOps Source**

A `GitOpsSource` resource that points to a Git repository, branch, and directory path. The STREAMINGPLUS Reconciler watches the GitOps source and applies any changes it finds to the target environment, keeping the live cluster in sync with the declared state in Git.

---

**Pipeline**

A `Pipeline` resource that defines a multi-stage promotion workflow for releasing new versions of a Deployment across environments. Pipelines support rolling, canary, blue-green, and recreate deployment strategies, as well as approval gates and automated metric-based analysis.

---

**Reconciler**

The in-cluster agent (part of the STREAMINGPLUS Worker) that continuously compares the desired state (from Git or the Control Plane API) against the live cluster state and takes corrective action. The Reconciler is the core of STREAMINGPLUS's pull-based GitOps model.

---

**Drift**

Any difference between what is declared as the desired state (in Git or the API) and what is actually running in the cluster. STREAMINGPLUS detects drift on every reconciliation loop and can be configured to auto-remediate, alert, or block depending on the resource type and environment settings.

---

**IRSA (IAM Roles for Service Accounts)**

An AWS mechanism that allows Kubernetes pods to assume IAM roles without storing static AWS credentials. STREAMINGPLUS uses IRSA to authenticate to AWS services (S3, Kinesis, MSK, etc.) by annotating Kubernetes ServiceAccounts with IAM Role ARNs and using STS token exchange under the hood.

---

**Workload Identity Federation**

A GCP mechanism equivalent to AWS IRSA. It allows Kubernetes service accounts to be federated with GCP IAM, enabling STREAMINGPLUS pods to authenticate to Google Cloud APIs (BigQuery, GCS, Pub/Sub, etc.) without service account key files. Azure has an equivalent called Workload Identity (using User-Assigned Managed Identities).

---

**SLO (Service Level Objective)**

A target reliability goal for a service, expressed as a ratio over a time window — for example, "the payments sink must successfully write 99.9% of records over a rolling 30-day window." SLOs in STREAMINGPLUS are defined as resources (`kind: SLO`) and can be synced to Datadog or exported as Prometheus recording rules.

---

**Canary Release**

A deployment strategy where a small percentage of traffic (e.g., 10%) is routed to a new version of a service while the majority remains on the old version. STREAMINGPLUS pipelines support configurable canary steps with metric-based analysis. If the canary passes all analysis checks, it is progressively promoted to 100%. If it fails, it is automatically rolled back.

---

**Sink**

A destination system to which STREAMINGPLUS delivers processed records. Supported sinks include Amazon S3, Google BigQuery, Snowflake, PostgreSQL, Apache Kafka, Elasticsearch, and HTTP endpoints. Each sink type has configurable delivery guarantees (at-least-once or exactly-once).

---

**Source**

A system from which STREAMINGPLUS reads records to process. Sources include Apache Kafka (and Kafka-compatible systems like Amazon MSK, Confluent Cloud), Amazon Kinesis, Google Pub/Sub, databases (via CDC), and HTTP push. Sources define the entry point of a Deployment pipeline.

---

**Dead-Letter Sink**

A secondary sink that receives records that could not be delivered to the primary sink after all retry attempts. The dead-letter sink ensures no records are silently dropped. Typical dead-letter sinks are Kafka topics or S3 buckets for later inspection and reprocessing.

---

**Connection**

A `Connection` resource that stores the endpoint configuration and authentication references (never inline credentials) for an external system. Connections are referenced by name in Deployment specs and can be reused across multiple Deployments.
