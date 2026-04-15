---
id: pipelines
sidebar_label: Delivery Pipelines
title: Delivery Pipelines
---

# Delivery Pipelines

A STREAMINGPLUS **Pipeline** defines a multi-stage promotion workflow for rolling out new versions of a deployment across environments. Pipelines enforce safety gates, approval workflows, and deployment strategies at each stage before promoting to the next.

## Deployment Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `rolling` | Replace instances incrementally, one at a time | Stateless services, zero-downtime deploys |
| `canary` | Route a percentage of traffic to the new version | Risk-averse rollouts; gradual traffic shift |
| `blue-green` | Spin up an identical new environment, switch traffic instantly | Instant cutover; easy rollback |
| `recreate` | Stop all old instances, start all new | Dev/test environments; stateful jobs that cannot run in parallel |

## Full Pipeline YAML Example

```yaml
apiVersion: streamingplus.io/v1
kind: Pipeline
metadata:
  name: payments-release-pipeline
  namespace: shared
spec:
  description: "Multi-stage release pipeline for the payments processor"

  # What triggers a new pipeline run
  trigger:
    gitOpsSource: production-config
    onPathChange:
      - "environments/*/deployments/payments-processor.yaml"

  # Stages execute in order; each stage must succeed before the next starts
  stages:

    # Stage 1: Staging with rolling update
    - name: staging
      environment: staging
      deployment: payments-processor
      strategy:
        type: rolling
        rollingUpdate:
          maxUnavailable: 1
          maxSurge: 1
      healthCheck:
        minReadySeconds: 30
        successThreshold: 3       # must pass health check 3 times in a row
      gates:
        - type: metric
          metric: streamingplus_sink_records_failed_total
          threshold: 0
          window: 5m
          onFailure: abort

    # Stage 2: Production canary (10% → 50% → 100%)
    - name: production-canary
      environment: production
      deployment: payments-processor
      strategy:
        type: canary
        canary:
          steps:
            - weight: 10
              pause: 5m
            - weight: 50
              pause: 10m
          analysis:
            metrics:
              - name: error-rate
                successCondition: result[0] < 0.01
                provider:
                  prometheus:
                    query: |
                      sum(rate(streamingplus_sink_records_failed_total{deployment="payments-processor"}[5m]))
                      /
                      sum(rate(streamingplus_sink_records_attempted_total{deployment="payments-processor"}[5m]))
            interval: 2m
            maxFailures: 1
      gates:
        - type: metric
          metric: streamingplus_sink_write_latency_p99_seconds
          threshold: 2.0
          window: 10m
          onFailure: rollback

    # Stage 3: Full production rollout with manual approval gate
    - name: production-full
      environment: production
      deployment: payments-processor
      strategy:
        type: canary
        canary:
          steps:
            - weight: 100   # complete the canary
      gates:
        - type: approval
          approval:
            required: 1
            approvers:
              - group: data-platform-leads
            timeout: 2h       # auto-abort if not approved within 2 h
            comment: "Approve full production rollout for payments-processor"

  # Notification config (sent at each stage transition)
  notifications:
    slack:
      channel: "#deployments"
      events:
        - stage.started
        - stage.succeeded
        - stage.failed
        - approval.requested
        - pipeline.completed
    pagerduty:
      integrationKey: "{{ secret \"pagerduty/payments-key\" }}"
      events:
        - stage.failed
        - pipeline.aborted
```

## Notifications YAML

Configure notifications at the pipeline level or per-stage:

```yaml
notifications:
  slack:
    channel: "#deployments"
    mentionOn:
      - stage.failed
      - approval.requested
    mention: "@data-platform-oncall"
    events:
      - stage.started
      - stage.succeeded
      - stage.failed
      - approval.requested
      - pipeline.completed
  email:
    recipients:
      - data-platform@company.com
    events:
      - pipeline.completed
      - pipeline.aborted
  webhook:
    url: https://internal-tool.company.com/hooks/deployments
    events:
      - stage.started
      - stage.failed
```

## Rollback Commands

If a pipeline stage fails or a canary analysis detects issues, STREAMINGPLUS can automatically roll back. You can also trigger a rollback manually:

```bash
# Roll back the current deployment to the previous version
sp deployments rollback payments-processor --env production

# Roll back to a specific revision
sp deployments rollback payments-processor --env production --revision 42

# List available revisions
sp deployments history payments-processor --env production

# Abort a running pipeline (does NOT roll back)
sp pipelines abort payments-release-pipeline --run-id abc123

# Roll back and abort the pipeline
sp pipelines rollback payments-release-pipeline --run-id abc123
```

:::tip
Set up an automatic rollback gate on error rate using the `metric` gate type with `onFailure: rollback`. This catches regressions within minutes of a canary rollout without requiring manual intervention.
:::

## Approving a Pipeline Gate

When an `approval` gate is reached, pipeline execution pauses and STREAMINGPLUS sends notifications. Approvers can approve or reject via:

```bash
# List pending approvals
sp pipelines approvals list --env production

# Approve a gate
sp pipelines approvals approve \
  --pipeline payments-release-pipeline \
  --stage production-full \
  --run-id abc123 \
  --comment "Metrics look good, approving full rollout"

# Reject a gate (triggers rollback)
sp pipelines approvals reject \
  --pipeline payments-release-pipeline \
  --stage production-full \
  --run-id abc123 \
  --comment "Error rate spike in canary, rejecting"
```
