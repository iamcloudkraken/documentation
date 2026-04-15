---
id: kubernetes
sidebar_label: Kubernetes
title: Kubernetes Deployment
---

# Kubernetes Deployment

STREAMINGPLUS can be deployed on any CNCF-conformant Kubernetes cluster using the official Helm chart. This is the recommended approach for self-managed Kubernetes environments (EKS, GKE, AKS, OpenShift, Rancher, etc.).

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Kubernetes | 1.25+ | Tested up to 1.30 |
| Helm | 3.10+ | |
| `kubectl` | Matches cluster version | |
| CPU (worker nodes) | 4 vCPU per node | 8 vCPU recommended for production |
| Memory | 8 GB per node | 16 GB recommended for production |
| Storage | 50 GB SSD per node | For write-ahead logs and local buffering |

## Namespace Setup

```bash
kubectl create namespace streamingplus-system
kubectl label namespace streamingplus-system \
  app.kubernetes.io/managed-by=streamingplus
```

For environment namespaces (one per STREAMINGPLUS environment):

```bash
kubectl create namespace production
kubectl label namespace production \
  streamingplus.io/environment=production
```

## Helm Chart Installation

Add the STREAMINGPLUS Helm repository:

```bash
helm repo add streamingplus https://charts.streamingplus.io
helm repo update
```

Install the chart:

```bash
helm install streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --create-namespace \
  --version 1.3.0 \
  --values my-values.yaml
```

## Values Override Reference

| Value | Default | Description |
|-------|---------|-------------|
| `global.image.tag` | `1.3.0` | STREAMINGPLUS image version |
| `controlPlane.replicas` | `2` | Control plane HA replicas |
| `worker.replicas.min` | `2` | Minimum worker replicas (HPA) |
| `worker.replicas.max` | `20` | Maximum worker replicas (HPA) |
| `worker.resources.requests.cpu` | `1000m` | Worker CPU request |
| `worker.resources.requests.memory` | `2Gi` | Worker memory request |
| `worker.resources.limits.cpu` | `4000m` | Worker CPU limit |
| `worker.resources.limits.memory` | `8Gi` | Worker memory limit |
| `persistence.storageClass` | `""` | StorageClass for WAL volumes |
| `persistence.size` | `20Gi` | WAL volume size per worker |
| `ingress.enabled` | `false` | Enable ingress for the Control Plane API |
| `ingress.className` | `nginx` | Ingress class |
| `tls.enabled` | `true` | Enable TLS for internal components |
| `metrics.enabled` | `true` | Expose Prometheus metrics |
| `metrics.serviceMonitor.enabled` | `false` | Create Prometheus ServiceMonitor |
| `licenseSecretRef` | `streamingplus-license` | Secret containing the license key |

## Example values.yaml

```yaml
global:
  image:
    registry: docker.io
    tag: "1.3.0"
    pullPolicy: IfNotPresent

controlPlane:
  replicas: 3
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi

worker:
  replicas:
    min: 3
    max: 30
  resources:
    requests:
      cpu: 2000m
      memory: 4Gi
    limits:
      cpu: 8000m
      memory: 16Gi

persistence:
  storageClass: gp3
  size: 50Gi

ingress:
  enabled: true
  className: nginx
  host: streamingplus.internal.example.com
  tls:
    secretName: streamingplus-tls

tls:
  enabled: true

metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s

licenseSecretRef: streamingplus-license
```

## Health Check Commands

After installation, verify all components are healthy:

```bash
# Check all STREAMINGPLUS pods
kubectl get pods -n streamingplus-system

# Check the control plane is ready
kubectl rollout status deployment/streamingplus-control-plane -n streamingplus-system

# Check worker health
kubectl get pods -n production -l app.kubernetes.io/component=worker

# Use sp CLI health check
sp status --env production

# View recent events
kubectl get events -n streamingplus-system --sort-by='.lastTimestamp'
```

Expected output for a healthy installation:

```
NAME                                        READY   STATUS    RESTARTS   AGE
streamingplus-control-plane-xxx             3/3     Running   0          10m
streamingplus-reconciler-xxx                2/2     Running   0          10m
streamingplus-operator-xxx                  1/1     Running   0          10m
streamingplus-metrics-server-xxx            1/1     Running   0          10m
```

:::tip
Set up a Kubernetes liveness and readiness probe alert in your monitoring stack for `streamingplus-control-plane` pods. A single failing control plane replica does not impact data plane throughput, but two failing replicas out of three will cause leader election delays.
:::

## Upgrading

```bash
helm repo update
helm upgrade streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --version 1.3.0 \
  --values my-values.yaml \
  --atomic \
  --timeout 10m
```

The `--atomic` flag automatically rolls back if the upgrade fails.
