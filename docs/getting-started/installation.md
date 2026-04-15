---
id: installation
sidebar_label: Installation
title: Installation
---

# Installation

This guide covers the full installation of STREAMINGPLUS, including the `sp` CLI on your local machine, the STREAMINGPLUS control plane in your Kubernetes cluster via Helm, and agent registration for your data plane clusters.

---

## Part 1 — Install the `sp` CLI

The `sp` CLI is the primary interface for managing STREAMINGPLUS resources. Install it on your local workstation or in your CI environment.

### macOS — Homebrew

The recommended method on macOS:

```bash
brew install streamingplus/tap/sp
```

To update to the latest version later:

```bash
brew upgrade sp
```

### macOS — Direct Binary

If you prefer not to use Homebrew:

```bash
curl -Lo /usr/local/bin/sp \
  https://releases.streamingplus.io/cli/latest/darwin-amd64/sp
chmod +x /usr/local/bin/sp
```

For Apple Silicon (M1/M2/M3):

```bash
curl -Lo /usr/local/bin/sp \
  https://releases.streamingplus.io/cli/latest/darwin-arm64/sp
chmod +x /usr/local/bin/sp
```

### Linux — Install Script

The install script automatically detects your architecture (amd64 or arm64) and installs to `/usr/local/bin`:

```bash
curl -sSL https://get.streamingplus.io/install.sh | sh
```

To install to a custom prefix (useful when you lack root access):

```bash
curl -sSL https://get.streamingplus.io/install.sh | sh -s -- --prefix ~/.local
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Linux — Manual Binary Download

```bash
# Replace VERSION with the release tag, e.g. 1.4.2
VERSION=1.4.2
ARCH=amd64   # or arm64

curl -Lo /tmp/sp.tar.gz \
  "https://releases.streamingplus.io/cli/${VERSION}/linux-${ARCH}/sp.tar.gz"

tar -xzf /tmp/sp.tar.gz -C /usr/local/bin sp
chmod +x /usr/local/bin/sp
```

### Windows — winget

```powershell
winget install StreamingPlus.sp
```

### Windows — Scoop

```powershell
scoop bucket add streamingplus https://github.com/streamingplus/scoop-bucket
scoop install sp
```

### Windows — Direct Download

Download the latest `.exe` from [releases.streamingplus.io](https://releases.streamingplus.io) and add it to a directory on your `PATH`.

---

## Verify the CLI Installation

After installing, verify the CLI is working:

```bash
sp version
```

Expected output:

```
sp version 1.4.2
API server: streamingplus.io/v1
Build: 2026-04-01T12:00:00Z (commit: a3f91bc)
```

Check that the CLI can reach the STREAMINGPLUS API:

```bash
sp ping
```

```
Pinging https://api.streamingplus.io... OK (42ms)
```

---

## Part 2 — Install the Control Plane via Helm

The STREAMINGPLUS control plane runs inside a Kubernetes cluster. It exposes the API server, scheduler, policy engine, and GitOps reconciler. You can install it in any Kubernetes cluster (v1.26+) with at least 4 vCPUs and 8 GB RAM available for the control plane namespace.

### 2.1 — Add the Helm repository

```bash
helm repo add streamingplus https://charts.streamingplus.io
helm repo update
```

### 2.2 — Create the namespace

```bash
kubectl create namespace streamingplus-system
```

### 2.3 — Create the license secret

Your STREAMINGPLUS license key is required to activate the control plane:

```bash
kubectl create secret generic streamingplus-license \
  --namespace streamingplus-system \
  --from-literal=license-key="YOUR_LICENSE_KEY_HERE"
```

### 2.4 — Create a values file

Create a file named `sp-values.yaml` with your configuration:

```yaml
# sp-values.yaml

global:
  # Public hostname for the STREAMINGPLUS API (used for agent registration)
  apiHostname: sp.example.com

controlPlane:
  replicas: 2

  api:
    # Ingress or LoadBalancer configuration
    service:
      type: LoadBalancer
    tls:
      enabled: true
      # Reference to a TLS secret in streamingplus-system namespace
      secretName: streamingplus-tls

  policy:
    # OPA policy bundle URL (optional – uses built-in policies if omitted)
    bundleUrl: ""

  gitops:
    # Default poll interval for GitOps sources
    syncInterval: 60s

persistence:
  storageClass: standard
  size: 20Gi

metrics:
  enabled: true
  # Prometheus Operator ServiceMonitor
  serviceMonitor:
    enabled: false
```

### 2.5 — Install the Helm chart

```bash
helm install streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --values sp-values.yaml \
  --version 1.4.2
```

Monitor the rollout:

```bash
kubectl rollout status deployment/sp-api -n streamingplus-system
kubectl rollout status deployment/sp-scheduler -n streamingplus-system
kubectl rollout status deployment/sp-sync -n streamingplus-system
```

### 2.6 — Verify the control plane is healthy

```bash
kubectl get pods -n streamingplus-system
```

```
NAME                            READY   STATUS    RESTARTS   AGE
sp-api-7d8f9b6c4-xkp2m         1/1     Running   0          2m
sp-api-7d8f9b6c4-lnq7r         1/1     Running   0          2m
sp-scheduler-5c6d7f8b9-w3mn    1/1     Running   0          2m
sp-policy-6f7a8b9c0-r4tk       1/1     Running   0          2m
sp-sync-4b5c6d7e8-s1vq         1/1     Running   0          2m
sp-metrics-9a0b1c2d3-f9kp      1/1     Running   0          2m
```

---

## Part 3 — Point the CLI at Your Control Plane

If you are using a self-hosted control plane (not the STREAMINGPLUS cloud SaaS), configure the CLI to point to your API server:

```bash
sp config set api-url https://sp.example.com
```

Then log in:

```bash
sp login
```

---

## Part 4 — Register a Data Plane Agent

The `sp-agent` is a DaemonSet that runs on each of your data plane clusters. It receives desired state from the control plane over an mTLS gRPC connection and provisions streaming resources locally.

### 4.1 — Generate a registration token

On your management machine (with the CLI configured):

```bash
sp agent token create --name prod-cluster-agent --ttl 1h
```

```
Agent registration token generated.
Token: spat_1a2b3c4d5e6f7g8h9i0j...
Expires: 2026-04-14T13:00:00Z

Use this token with `sp agent register` on the target cluster.
```

The token is single-use and expires after 1 hour. Keep it secure.

### 4.2 — Install the agent in the target cluster

Switch your `kubectl` context to the cluster where you want to install the agent:

```bash
kubectl config use-context my-prod-cluster
```

Install the agent via Helm:

```bash
helm install sp-agent streamingplus/sp-agent \
  --namespace streamingplus-agents \
  --create-namespace \
  --set controlPlane.url=https://sp.example.com \
  --set agent.registrationToken="spat_1a2b3c4d5e6f7g8h9i0j..." \
  --set agent.name=prod-cluster-agent
```

### 4.3 — Verify agent registration

Back on your management machine:

```bash
sp agent list
```

```
NAME                   STATUS     CLUSTER VERSION   LAST SEEN
prod-cluster-agent     Connected  v1.28.4           2s ago
```

---

## Upgrading

### Upgrade the CLI

```bash
# macOS
brew upgrade sp

# Linux
curl -sSL https://get.streamingplus.io/install.sh | sh

# Windows
winget upgrade StreamingPlus.sp
```

### Upgrade the Control Plane

```bash
helm repo update
helm upgrade streamingplus streamingplus/streamingplus \
  --namespace streamingplus-system \
  --values sp-values.yaml \
  --version 1.5.0
```

### Upgrade the Agent

```bash
helm upgrade sp-agent streamingplus/sp-agent \
  --namespace streamingplus-agents \
  --set agent.name=prod-cluster-agent \
  --version 1.5.0
```

---

## Uninstalling

To remove the control plane:

```bash
helm uninstall streamingplus --namespace streamingplus-system
kubectl delete namespace streamingplus-system
```

To remove an agent from a cluster:

```bash
helm uninstall sp-agent --namespace streamingplus-agents
kubectl delete namespace streamingplus-agents
```

---

## Troubleshooting

### CLI cannot connect to the API

```bash
sp ping
# Error: connection refused
```

Check that `sp config get api-url` returns the correct endpoint and that the control plane pods are running.

### Agent shows as `Disconnected`

Check the agent pod logs:

```bash
kubectl logs -n streamingplus-agents -l app=sp-agent --tail=50
```

Common causes:
- The control plane URL is unreachable from the agent cluster (firewall rules, private network).
- The mTLS certificate has expired. Rotate with `sp agent token create` and re-register.
- Clock skew greater than 5 minutes between agent and control plane nodes.

### Helm chart fails with `StorageClass not found`

Set `persistence.storageClass` in `sp-values.yaml` to a storage class available in your cluster:

```bash
kubectl get storageclass
```
