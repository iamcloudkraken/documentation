---
id: quickstart
sidebar_label: Quickstart
title: Quickstart
---

# Quickstart

Get STREAMINGPLUS running in under 5 minutes. This guide installs the `sp` CLI, authenticates you with the platform, creates your first workspace, and deploys a sample streaming pipeline.

---

## Prerequisites

Before you begin, make sure you have:

- An active STREAMINGPLUS account. Sign up at [app.streamingplus.io](https://app.streamingplus.io) if you do not have one.
- A Kubernetes cluster (v1.26 or later) with `kubectl` access, OR access to a STREAMINGPLUS-managed cloud environment.
- `kubectl` installed if you plan to register your own cluster.

---

## Step 1 — Install the `sp` CLI

Choose the installation method that matches your operating system.

### macOS (Homebrew)

```bash
brew install streamingplus/tap/sp
```

### Linux (curl)

```bash
curl -sSL https://get.streamingplus.io/install.sh | sh
```

This installs the `sp` binary to `/usr/local/bin/sp`. If you do not have write access to that directory, run:

```bash
curl -sSL https://get.streamingplus.io/install.sh | sh -s -- --prefix ~/.local
```

Then add `~/.local/bin` to your `PATH`.

### Windows (winget)

```powershell
winget install StreamingPlus.sp
```

### Verify the installation

```bash
sp version
```

Expected output:

```
sp version 1.4.2
API server: streamingplus.io/v1
Build: 2026-04-01T12:00:00Z (commit: a3f91bc)
```

---

## Step 2 — Log In

Authenticate the CLI with your STREAMINGPLUS account. This opens a browser window for OAuth2/OIDC login.

```bash
sp login
```

If you are working in a headless environment (CI, SSH session), use a device code flow:

```bash
sp login --device-code
```

You will see output like:

```
Opening browser to https://auth.streamingplus.io/device...
Waiting for authentication...
Logged in as srikanth@example.com (org: acme-corp)
```

To verify your session:

```bash
sp whoami
```

```
User:         srikanth@example.com
Organization: acme-corp
Role:         Admin
Token expires: 2026-05-14T12:00:00Z
```

---

## Step 3 — Create a Workspace

A **workspace** is an isolated environment within your organization. Workspaces map to a single Kubernetes namespace on the data plane. Create one now:

```bash
sp workspace create my-first-workspace --description "Quickstart workspace"
```

```
Workspace "my-first-workspace" created successfully.
ID: ws-8f3d92a1
Region: us-east-1
```

Set this workspace as your active context so all subsequent commands target it:

```bash
sp workspace use my-first-workspace
```

```
Active workspace set to: my-first-workspace
```

You can confirm the active workspace at any time:

```bash
sp workspace current
```

---

## Step 4 — Deploy a Sample App

STREAMINGPLUS ships with a built-in sample pipeline template that creates a simple streaming topology: a data generator source, a Kafka topic, and a log-sink consumer.

### 4a. Initialize the sample from a template

```bash
sp init --template sample-pipeline --name hello-streaming
```

This creates a local directory `hello-streaming/` with the following files:

```
hello-streaming/
├── sp.yaml                 # Workspace-level config
├── environments/
│   └── dev.yaml            # Environment definition
├── pipelines/
│   └── hello-pipeline.yaml # Pipeline definition
└── connections/
    ├── source.yaml         # Source connection (data generator)
    └── sink.yaml           # Sink connection (log output)
```

### 4b. Review the pipeline manifest

```bash
cat hello-streaming/pipelines/hello-pipeline.yaml
```

```yaml
apiVersion: streamingplus.io/v1
kind: Pipeline
metadata:
  name: hello-pipeline
  environment: dev
spec:
  source:
    connectionRef: data-generator-source
  transforms:
    - type: filter
      expression: "event.type != 'heartbeat'"
    - type: enrich
      fields:
        processed_at: "{{ now() }}"
  sink:
    connectionRef: log-sink
  scaling:
    minReplicas: 1
    maxReplicas: 3
```

### 4c. Apply the manifests

```bash
cd hello-streaming
sp apply -f .
```

```
Applying resources...
  + Environment/dev                  created
  + SourceConnection/data-generator  created
  + SinkConnection/log-sink          created
  + Pipeline/hello-pipeline          created

4 resources applied successfully.
Reconciliation started. Run `sp status` to monitor progress.
```

### 4d. Check the deployment status

```bash
sp status
```

```
Workspace: my-first-workspace
Environment: dev

RESOURCE                    TYPE              STATUS     AGE
data-generator-source       SourceConnection  Running    12s
log-sink                    SinkConnection    Running    12s
hello-pipeline              Pipeline          Running    8s

All resources healthy.
```

### 4e. Tail the pipeline logs

```bash
sp logs pipeline/hello-pipeline --follow
```

```
[hello-pipeline] 2026-04-14T09:01:00Z event received: {"id":"evt-001","type":"click","user":"u-42"}
[hello-pipeline] 2026-04-14T09:01:01Z event received: {"id":"evt-002","type":"purchase","user":"u-17"}
[hello-pipeline] 2026-04-14T09:01:02Z event received: {"id":"evt-003","type":"click","user":"u-99"}
```

---

## What's Next?

You have deployed your first STREAMINGPLUS pipeline. From here:

- **[Installation](./installation.md)** — Learn how to install the control plane in your own Kubernetes cluster and register agents.
- **[Core Concepts](./concepts.md)** — Understand the full resource model: Environments, Pipelines, Connections, GitOps Sources, and more.
- **[CLI Reference](../reference/cli.md)** — Explore all `sp` commands and their options.
- **[GitOps Guide](../gitops/overview.md)** — Connect your Git repository so infrastructure changes reconcile automatically on merge.

---

## Cleanup

To delete the resources you just created:

```bash
sp delete -f hello-streaming/
```

To delete the workspace entirely:

```bash
sp workspace delete my-first-workspace --confirm
```
