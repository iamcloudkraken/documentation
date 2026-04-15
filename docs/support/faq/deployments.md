---
id: faq-deployments
sidebar_label: Deployments
title: Deployments FAQ
---

# Deployments FAQ

## Which Kubernetes versions are supported?

STREAMINGPLUS supports Kubernetes **1.25 and later**. Support tracks the upstream Kubernetes release cycle. When Kubernetes reaches end-of-life for a minor version, STREAMINGPLUS drops support in the next minor release (with at least 3 months notice).

Tested distributions include: EKS, GKE, AKS, OpenShift 4.12+, k3s 1.25+, Rancher RKE2.

---

## Can I run STREAMINGPLUS on-premises (without a cloud provider)?

Yes. The **Self-Hosted** deployment option runs the full STREAMINGPLUS stack on any Kubernetes cluster — including bare-metal, on-premises VMware, or private data centers. You need:
- A Kubernetes 1.25+ cluster
- S3-compatible object storage (MinIO works)
- PostgreSQL 14+ for the control plane database
- A valid STREAMINGPLUS Enterprise license

See [Self-Hosted Deployment](../../deployment/self-hosted) for step-by-step instructions.

---

## Can STREAMINGPLUS be installed in a fully air-gapped environment?

Yes, for **Enterprise** customers. Air-gapped installation is supported via an offline bundle:

```bash
# On a machine with internet access
sp release download --version 1.3.0 --output sp-release-1.3.0.tar.gz
```

The bundle contains all container images and Helm charts. Transfer it to your air-gapped network and install using:

```bash
sp release install \
  --bundle sp-release-1.3.0.tar.gz \
  --registry internal-registry.example.com:5000 \
  --namespace streamingplus-system
```

Contact sales@streamingplus.io for air-gapped licensing and setup assistance.

---

## How are STREAMINGPLUS upgrades handled?

**Managed Cloud**: The Control Plane is upgraded automatically during your configured maintenance window (default: Sunday 2–4 AM UTC). Data Plane workers are upgraded via a rolling update with zero downtime.

**Self-Hosted**: Upgrades are manual, triggered by running:

```bash
helm upgrade streamingplus streamingplus/streamingplus \
  --version <new-version> \
  --reuse-values \
  --atomic
```

Always read the [Changelog](../changelog) before upgrading. Minor versions (e.g., 1.2 → 1.3) are backward-compatible. Major versions (e.g., 1.x → 2.x) may require migration steps documented in the upgrade guide.

---

## How fast is rollback?

For **Deployment** resources, rollback is near-instant:
- STREAMINGPLUS stops writing new records with the current version
- Starts up the previous revision (image + spec)
- Typically completes in **30–90 seconds** for stateless pipelines

For **Pipeline** canary rollbacks, the canary instances are stopped and all traffic is redirected to the stable version. This completes in under 60 seconds.

Trigger a rollback with:
```bash
sp deployments rollback <name> --env production
```
