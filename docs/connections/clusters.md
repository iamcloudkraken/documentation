---
id: clusters
sidebar_label: Kubernetes Clusters
title: Kubernetes Cluster Connections
---

# Kubernetes Cluster Connections

STREAMINGPLUS manages streaming workloads across one or more Kubernetes clusters. Each cluster is registered as a `ClusterConnection` resource and is managed by a lightweight agent that runs inside the cluster itself.

---

## How Agent Registration Works

The STREAMINGPLUS cluster agent uses an **outbound-only gRPC connection** to the STREAMINGPLUS control plane. This design means:

- No inbound firewall rules or port forwards are required on the cluster side.
- The agent initiates and maintains a persistent bidirectional gRPC stream to the control plane.
- All control signals (deploy, scale, delete) travel over this stream from the control plane to the agent.
- Telemetry and status updates flow in the reverse direction.

The agent is deployed as a `Deployment` in the `streamingplus-system` namespace and requires only egress to `api.streamingplus.io:443`.

```
Cluster Agent  ──── outbound gRPC (port 443) ────▶  STREAMINGPLUS Control Plane
               ◀─── control signals ────────────────
               ──── status / telemetry ─────────────▶
```

:::tip
Because the agent uses outbound connections only, it works in air-gapped environments, clusters behind NAT, and private VPCs without additional network configuration.
:::

---

## Supported Kubernetes Versions

| Distribution | Minimum Version | Recommended Version |
|---|---|---|
| Amazon EKS | 1.27 | 1.29+ |
| Google GKE | 1.27 | 1.29+ |
| Azure AKS | 1.27 | 1.29+ |
| Self-hosted (kubeadm, k3s, RKE2) | 1.26 | 1.29+ |
| OpenShift | 4.12 | 4.14+ |

:::warning
Kubernetes versions older than 1.26 are not supported. STREAMINGPLUS relies on `PodDisruptionBudget` v1, `HorizontalPodAutoscaler` v2, and `CronJob` v1 APIs, which require Kubernetes 1.25+.
:::

---

## Register an Amazon EKS Cluster

```bash
# Authenticate to EKS
aws eks update-kubeconfig --region us-east-1 --name my-prod-cluster

# Register the cluster with STREAMINGPLUS
sp connections clusters register \
  --name prod-eks-us-east \
  --provider aws \
  --region us-east-1 \
  --labels env=production,tier=data
```

The command outputs a `helm` install command for the agent. Run it in the target cluster:

```bash
helm repo add streamingplus https://charts.streamingplus.io
helm repo update

helm upgrade --install sp-agent streamingplus/agent \
  --namespace streamingplus-system \
  --create-namespace \
  --set agent.token="<TOKEN>" \
  --set agent.controlPlane="api.streamingplus.io:443"
```

After installation, the cluster state transitions from `pending` to `connected` within 30–60 seconds.

---

## Register a Google GKE Cluster

```bash
# Authenticate to GKE
gcloud container clusters get-credentials my-cluster \
  --region us-central1 \
  --project my-gcp-project

# Register the cluster
sp connections clusters register \
  --name staging-gke \
  --provider gcp \
  --region us-central1 \
  --labels env=staging,team=platform
```

For GKE clusters with **Workload Identity** enabled, pass the `--workload-identity` flag so the agent uses a Kubernetes service account bound to a GCP service account rather than a static credential:

```bash
sp connections clusters register \
  --name staging-gke \
  --provider gcp \
  --region us-central1 \
  --workload-identity \
  --gcp-service-account sp-agent@my-gcp-project.iam.gserviceaccount.com
```

---

## Register an Azure AKS Cluster

```bash
# Authenticate to AKS
az aks get-credentials \
  --resource-group my-resource-group \
  --name my-aks-cluster

# Register the cluster
sp connections clusters register \
  --name prod-aks-westus \
  --provider azure \
  --region westus2 \
  --labels env=production,region=westus2
```

For clusters with **Managed Identity** enabled, pass `--managed-identity` to use Azure Workload Identity for agent authentication.

---

## Register a Self-Hosted Cluster

For clusters not managed by a cloud provider (kubeadm, k3s, RKE2, Talos):

```bash
sp connections clusters register \
  --name on-prem-dc1 \
  --provider self-hosted \
  --labels env=production,location=datacenter-1
```

:::note
Self-hosted clusters require that the agent node has outbound HTTPS (port 443) access to `api.streamingplus.io`. Verify with:
```bash
curl -v https://api.streamingplus.io/health
```
:::

---

## Cluster Labels

Labels are key/value pairs attached to a `ClusterConnection` at registration time or added later with the `sp connections label` command. They are used to control where workloads are scheduled.

```bash
sp connections label prod-eks-us-east \
  env=production \
  region=us-east-1 \
  tier=data \
  compliance=pci
```

Reference labels in a `StreamingPipeline` deployment spec to pin or prefer specific clusters:

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: payment-events
spec:
  clusterSelector:
    matchLabels:
      env: production
      compliance: pci
  # ...
```

---

## Multi-Cluster Deployments

STREAMINGPLUS supports deploying a single pipeline across multiple clusters for geo-redundancy or compliance isolation. Use `clusterSelector` with a broader label query to target multiple clusters simultaneously:

```yaml
apiVersion: streamingplus.io/v1
kind: StreamingPipeline
metadata:
  name: clickstream-global
spec:
  replicas: 2
  clusterSelector:
    matchLabels:
      env: production
    matchExpressions:
      - key: region
        operator: In
        values:
          - us-east-1
          - eu-west-1
          - ap-southeast-1
  # ...
```

STREAMINGPLUS will schedule one replica set per matching cluster. Each instance operates independently with its own offset tracking and checkpointing.

:::tip
Use multi-cluster deployments together with a [Network Connectivity](./network) connection to enable cross-cluster state sharing or to route traffic between pipeline segments running in different regions.
:::

---

## Viewing Cluster Details

```bash
sp connections describe prod-eks-us-east
```

```
Name:           prod-eks-us-east
Provider:       aws
Region:         us-east-1
Status:         connected
Agent Version:  1.8.3
K8s Version:    1.29.2
Labels:         env=production, tier=data
Last Heartbeat: 4s ago
Workloads:      12 active
```

---

## Upgrading the Agent

When a new agent version is available, STREAMINGPLUS notifies you in the dashboard and CLI. To upgrade:

```bash
sp connections clusters upgrade prod-eks-us-east
```

This triggers a rolling update of the agent `Deployment` inside the cluster. Zero downtime is maintained for running workloads during the upgrade.

---

## Unregistering a Cluster

```bash
sp connections clusters deregister prod-eks-us-east
```

This removes the `ClusterConnection` from the control plane and initiates agent self-cleanup inside the cluster. All STREAMINGPLUS-managed workloads in the cluster are terminated before deregistration completes.
