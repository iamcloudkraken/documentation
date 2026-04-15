---
id: faq-general
sidebar_label: General
title: General FAQ
---

# General FAQ

## Is there a free tier?

Yes. The **Starter** tier is free for up to 2 environments and 5 concurrent Deployments. No credit card is required to sign up. The Starter tier includes:
- 1 GB/day of data throughput
- Community Slack support
- 7-day audit log retention
- All sink and source types

To upgrade to Professional or Enterprise, visit the Billing section in the STREAMINGPLUS console or contact sales@streamingplus.io.

---

## What is the SLA for the managed control plane?

| Tier | SLA | Measurement |
|------|-----|-------------|
| Starter | No SLA | Best effort |
| Professional | 99.9% monthly uptime | Rolling 30-day window |
| Enterprise | 99.99% monthly uptime | Rolling 30-day window |

SLA credits are issued automatically for breaches. See the Service Agreement for credit terms.

---

## Where is my data stored? Does STREAMINGPLUS have access to my streaming data?

STREAMINGPLUS **never has access to your application data**. Streaming data flows entirely within your infrastructure — from your sources to your sinks — without passing through the STREAMINGPLUS Control Plane. The Control Plane only stores:
- Resource configuration (Deployment specs, Connection configs)
- Audit logs
- Metrics metadata

All control plane metadata is stored in the cloud region you select during environment creation. Data never crosses regional boundaries unless explicitly configured.

---

## Is multi-cloud supported?

Yes. A single STREAMINGPLUS Control Plane can manage environments across AWS, GCP, and Azure simultaneously. You can:
- Run different environments on different clouds
- Fan out from one Kafka source to sinks on multiple clouds
- Use GitOps to manage all environments from a single repository

There is no additional cost for managing multi-cloud environments.
