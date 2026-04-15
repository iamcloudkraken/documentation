---
id: troubleshooting
sidebar_label: Troubleshooting
title: Troubleshooting
---

# Troubleshooting

This guide covers the most common issues encountered when operating STREAMINGPLUS. Each section describes the symptom, likely causes, and resolution steps.

---

## Issue: `sp login` Fails

**Symptoms**
- The browser does not open automatically
- The CLI hangs waiting for the OAuth callback
- Error: `OAuth callback timed out after 60 seconds`

**Cause**
The CLI opens `localhost:8085/callback` to receive the OAuth redirect. This port may be blocked by a firewall, or the default browser may not be available in headless/server environments.

**Fix**

```bash
# See the full OAuth URL
sp login --debug

# Copy the URL and open it in a browser manually
# Then paste the authorization code back into the CLI prompt

# Alternative: non-interactive token login
sp login --token $SP_TOKEN

# Alternative: device flow (no browser required)
sp login --device-flow
```

:::tip
In CI environments, always use `sp login --token $SP_TOKEN` with a service account token stored as a CI secret, rather than interactive login.
:::

---

## Issue: Cluster Not Connecting (Agent Shows Disconnected)

**Symptoms**
- `sp envs get production` shows `agent: disconnected`
- `sp status --env production` shows `cluster unreachable`
- Deployments are not starting

**Cause**
- The STREAMINGPLUS agent pod is crashing or not running
- Outbound network connectivity to the Control Plane API is blocked
- The agent's auth token has expired

**Fix**

```bash
# Check agent pod status
kubectl get pods -n streamingplus-system -l app.kubernetes.io/component=agent

# View agent logs
kubectl logs -n streamingplus-system -l app.kubernetes.io/component=agent --tail 100

# Check outbound connectivity from the cluster
kubectl run connectivity-test --image=curlimages/curl --rm -it --restart=Never \
  -- curl -v https://api.streamingplus.io/v1/health

# Rotate the agent token if expired
sp agents rotate-token production --env production
kubectl rollout restart deployment/streamingplus-agent -n streamingplus-system
```

:::note
The agent only requires outbound TCP 443 to the Control Plane API. No inbound ports are required. Verify your cluster's egress firewall rules allow traffic to `api.streamingplus.io:443`.
:::

---

## Issue: Image Pull Errors (Error Code E3001)

**Symptoms**
- Deployment stuck in `ImagePullBackOff` or `ErrImagePull`
- `sp deployments status <name>` shows `error: image pull failed`
- Error code `E3001` in deployment events

**Cause**
- The container image tag does not exist in the registry
- Registry credentials are missing, expired, or have insufficient permissions
- The registry is unreachable from the cluster network

**Fix**

```bash
# Verify the connection to the registry
sp connections test my-registry-connection

# Check the registry connection status
sp connections get my-registry-connection

# View detailed deployment events including pull errors
sp deployments logs my-deployment --env production --previous

# Verify the image tag exists (for Docker Hub / GHCR)
docker manifest inspect ghcr.io/my-org/my-image:v1.2.3
```

If the registry requires authentication, ensure the `Connection` resource references a valid Kubernetes secret with `username` and `password` (or a Docker config JSON).

---

## Issue: GitOps Sync Stuck

**Symptoms**
- `sp gitops status --env production` shows `status: syncing` for more than 5 minutes
- Manifest changes in Git are not being applied to the cluster
- `sp gitops diff` shows changes but they are not being applied

**Cause**
- A manifest has a parse error that is blocking the sync
- The Reconciler is waiting for a resource to become ready before proceeding
- A previous sync left a resource in a transitional state (e.g., `Terminating`)

**Fix**

```bash
# View detailed sync status
sp gitops status --env production --verbose

# Check for manifest errors
sp apply -f ./environments/production/ --validate-only

# Force an immediate reconcile cycle
sp gitops sync --env production --force

# Check Reconciler logs for detailed error messages
kubectl logs -n streamingplus-system \
  -l app.kubernetes.io/component=reconciler \
  --tail 200
```

If a resource is stuck in `Terminating`:

```bash
kubectl get deployments -n production
kubectl describe deployment <stuck-deployment> -n production
# If stuck, remove the finalizer:
kubectl patch deployment <stuck-deployment> -n production \
  -p '{"metadata":{"finalizers":[]}}' --type=merge
```

---

## Issue: Canary Not Promoting

**Symptoms**
- Canary deployment is stuck at 10% traffic
- `sp pipelines status <pipeline>` shows stage `production-canary` as `waiting`
- The canary has been running for longer than the configured `pause` duration

**Cause**
- The error rate metric is at or above the promotion threshold
- The canary analysis interval has not elapsed
- An approval gate requires manual action
- The Prometheus/Datadog metric query is returning no data (null)

**Fix**

```bash
# Check pipeline run details
sp pipelines status payments-release-pipeline --env production --verbose

# Check the metric driving the canary analysis
sp pipelines metrics payments-release-pipeline \
  --stage production-canary \
  --metric error-rate

# Check pending approvals
sp pipelines approvals list --env production

# If the metric query returns null, the canary will not promote automatically.
# Verify the Prometheus query manually:
curl -G "http://prometheus.internal:9090/api/v1/query" \
  --data-urlencode 'query=sum(rate(streamingplus_sink_records_failed_total{deployment="payments-processor"}[5m]))'
```

:::warning
If the canary analysis shows error rate is elevated (above threshold), do not force-promote. Investigate the root cause first by checking `sp deployments logs` for the canary instances.
:::

If you need to manually abort and roll back:

```bash
sp pipelines rollback payments-release-pipeline --run-id <run-id>
```

---

## Getting More Help

**Debug logging**: Append `--debug` to any `sp` command for full HTTP request/response output.

**Diagnostic bundle**: Collect a bundle for support tickets:

```bash
sp diagnostics bundle --env production --output support-bundle.tar.gz
```

**Support channels**:
- Community Slack: https://slack.streamingplus.io
- Error codes reference: [Error Codes](../reference/error-codes)
- Enterprise support: support@streamingplus.io
