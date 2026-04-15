---
id: gcp
sidebar_label: GCP
title: GCP Integration
---

# GCP Integration

STREAMINGPLUS integrates with Google Cloud Platform using **Workload Identity Federation**, which allows Kubernetes workloads to authenticate to GCP APIs without service account keys. STREAMINGPLUS pods exchange their Kubernetes service account token for a short-lived GCP access token using GCP's STS token exchange endpoint.

## How Workload Identity Federation Works

```
STREAMINGPLUS Pod
  └─ Kubernetes ServiceAccount token (auto-mounted)
       └─ GCP STS Token Exchange (ExchangeToken)
            └─ Impersonate GCP Service Account
                 └─ GCP API Access (BigQuery, GCS, Pub/Sub, etc.)
```

No service account JSON key files are needed. Credentials are short-lived (1 hour) and automatically refreshed.

## Setup: sp connect Command

```bash
sp connect gcp \
  --project-id my-gcp-project \
  --project-number 123456789012 \
  --pool-id streamingplus-pool \
  --provider-id k8s-provider \
  --cluster-name my-gke-cluster \
  --cluster-location us-central1 \
  --env production
```

This command creates:
1. A Workload Identity Pool (`streamingplus-pool`) in your GCP project
2. A Kubernetes OIDC provider within that pool
3. An attribute condition scoped to the STREAMINGPLUS namespace

## IAM Binding

Bind a GCP service account to the Kubernetes service account using the `roles/iam.workloadIdentityUser` role:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  streamingplus-worker@my-gcp-project.iam.gserviceaccount.com \
  --project=my-gcp-project \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/streamingplus-pool/attribute.namespace/production"
```

:::tip
Use `attribute.namespace` in the `--member` principal to scope access to a specific Kubernetes namespace. This prevents STREAMINGPLUS workloads in other namespaces from assuming the GCP service account.
:::

## Supported GCP Services

| Service | Connection Type | Use Case |
|---------|----------------|----------|
| Google BigQuery | `bigquery` | Data warehouse sink |
| Google Cloud Storage (GCS) | `gcs` | Object storage sink |
| Google Pub/Sub | `pubsub` | Message queue source/sink |
| GCP Secret Manager | `gcp-secret-manager` | Secret injection |
| Google Cloud Spanner | `spanner` | Transactional database sink |
| Google Dataflow | `dataflow` | Managed pipeline execution |
| Firestore | `firestore` | Document database sink |

## Creating a BigQuery Connection

```bash
sp connections create bigquery-prod \
  --type bigquery \
  --project-id my-gcp-project \
  --service-account streamingplus-worker@my-gcp-project.iam.gserviceaccount.com \
  --env production
```

Test connectivity:

```bash
sp connections test bigquery-prod
```

## Required GCP Service Account Permissions

Grant the following roles to the GCP service account, scoped to the relevant resources:

```bash
# BigQuery
gcloud projects add-iam-policy-binding my-gcp-project \
  --member="serviceAccount:streamingplus-worker@my-gcp-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding my-gcp-project \
  --member="serviceAccount:streamingplus-worker@my-gcp-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# GCS
gsutil iam ch \
  serviceAccount:streamingplus-worker@my-gcp-project.iam.gserviceaccount.com:roles/storage.objectCreator \
  gs://my-data-lake-bucket
```

## Verify the Workload Identity Setup

After running `sp connect gcp`, verify the federation is working:

```bash
sp integrations status --provider gcp --env production
```

If there are authentication errors, check that:
1. The Workload Identity Pool is active in your GCP project
2. The OIDC issuer URL of your Kubernetes cluster matches the pool provider configuration
3. The IAM binding for `workloadIdentityUser` is correctly scoped
