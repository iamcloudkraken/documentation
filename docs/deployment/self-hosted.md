---
id: self-hosted
sidebar_label: Self-Hosted
title: Self-Hosted Deployment
---

# Self-Hosted Deployment

STREAMINGPLUS Self-Hosted gives you full control over the deployment, running the complete Control Plane and Data Plane stack on your own infrastructure. This is ideal for air-gapped environments, strict data residency requirements, or organizations with existing Kubernetes infrastructure they want to leverage.

## Requirements

### Infrastructure

| Component | Requirement | Notes |
|-----------|-------------|-------|
| Kubernetes | 1.25+ (3+ nodes) | Tested on EKS, GKE, AKS, k3s, OpenShift 4.12+ |
| Helm | 3.10+ | |
| PostgreSQL | 14+ | Control plane metadata store |
| Object Storage | S3-compatible | State storage and WAL backups |
| Load Balancer | Any Kubernetes-compatible | For Control Plane API ingress |
| TLS Certificate | Valid certificate or cert-manager | For API and inter-component mTLS |
| CPU (control plane) | 4 vCPU | |
| Memory (control plane) | 8 GB | |
| CPU (workers, per node) | 8 vCPU | |
| Memory (workers, per node) | 16 GB | |

### License

A valid STREAMINGPLUS license key is required for self-hosted deployments. Contact sales@streamingplus.io to obtain a license. Store the license key in a Kubernetes secret:

```bash
kubectl create secret generic streamingplus-license \
  --from-literal=license-key="YOUR_LICENSE_KEY" \
  --namespace streamingplus-system
```

## Helm-Based Installation

### 1. Add the Helm repository

```bash
helm repo add streamingplus https://charts.streamingplus.io
helm repo update
```

### 2. Create the namespace and prerequisites

```bash
kubectl create namespace streamingplus-system

# Create PostgreSQL connection secret
kubectl create secret generic sp-control-plane-db \
  --from-literal=url="postgresql://spuser:sppassword@pg.internal:5432/streamingplus" \
  --namespace streamingplus-system

# Create object storage secret
kubectl create secret generic sp-object-storage \
  --from-literal=bucket="sp-state-bucket" \
  --from-literal=region="us-east-1" \
  --namespace streamingplus-system
```

### 3. Install with self-hosted values

```bash
helm install streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --version 1.3.0 \
  --set mode=self-hosted \
  --set controlPlane.database.secretRef=sp-control-plane-db \
  --set storage.secretRef=sp-object-storage \
  --set licenseSecretRef=streamingplus-license \
  --set global.domain=streamingplus.internal.example.com \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set tls.enabled=true \
  --set tls.certManagerEnabled=true
```

## Agent Registration

In self-hosted mode, STREAMINGPLUS uses a lightweight agent (the Reconciler + Worker components) that can be distributed across multiple clusters. Register each cluster with the Control Plane:

```bash
# Generate agent registration manifest
sp agents register \
  --name primary-cluster \
  --env production \
  --output-file sp-agent-primary.yaml

# Apply to the target cluster
kubectl apply -f sp-agent-primary.yaml

# Verify the agent is connected
sp agents list
sp agents status primary-cluster
```

:::note
The STREAMINGPLUS agent requires only **outbound** connectivity to the Control Plane API (TCP 443). No inbound ports need to be opened on your cluster. This makes it suitable for air-gapped environments with outbound proxy access.
:::

## Post-Install Verification

```bash
# Check all system pods are running
kubectl get pods -n streamingplus-system

# Verify control plane health
sp status --env production

# Run the built-in diagnostic tool
sp diagnostics run --env production

# Check license validity
sp license status
```

Expected output of `sp diagnostics run`:

```
[PASS] Control Plane API reachable
[PASS] Database connection healthy
[PASS] Object storage accessible
[PASS] License valid (expires: 2026-12-31)
[PASS] Worker agents connected: 3/3
[PASS] Metrics server running
[WARN] TLS certificate expires in 45 days — consider renewal
```

## Air-Gapped Installation

For completely air-gapped environments, download the STREAMINGPLUS image bundle and Helm chart offline:

```bash
# On a machine with internet access
sp release download --version 1.3.0 --output sp-release-1.3.0.tar.gz

# Copy the bundle to the air-gapped environment, then:
sp release install --bundle sp-release-1.3.0.tar.gz \
  --registry internal-registry.example.com:5000 \
  --namespace streamingplus-system
```

:::tip
Use a private image registry (Harbor, ECR, Artifact Registry) to mirror STREAMINGPLUS container images in air-gapped environments. The `sp release download` command bundles all required images into a single tarball that can be loaded with `docker load` or `skopeo copy`.
:::

## Upgrading Self-Hosted

```bash
helm repo update
helm upgrade streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --version 1.3.0 \
  --reuse-values \
  --atomic \
  --timeout 15m
```

Always read the upgrade notes in the [Changelog](../support/changelog) before upgrading between minor versions.
