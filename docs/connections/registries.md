---
id: registries
sidebar_label: Container Registries
title: Container Registry Connections
---

# Container Registry Connections

STREAMINGPLUS pulls container images for pipeline components, custom processors, and sidecar containers from one or more container registries. A `RegistryConnection` stores the authentication credentials and endpoint configuration required to pull images securely.

---

## Supported Registries

| Registry | Provider | Auth Method | Image Scanning | Status |
|---|---|---|---|---|
| Amazon ECR | AWS | IRSA / static keys | Native (ECR Inspector) | GA |
| Google Container Registry / Artifact Registry | GCP | Workload Identity / JSON key | Native (Artifact Analysis) | GA |
| GitHub Container Registry (GHCR) | GitHub | PAT / GitHub App | Via integration | GA |
| Docker Hub | Docker | Username / token | Via Snyk integration | GA |
| JFrog Artifactory | JFrog | Access token / API key | Native (Xray) | GA |
| Harbor | Self-hosted | Robot account / OIDC | Native (Trivy) | GA |

---

## Add a Registry Connection

### Amazon ECR

The recommended approach uses IAM Roles for Service Accounts (IRSA) so that no static credentials are stored:

```bash
sp connections registries add \
  --name ecr-prod \
  --provider ecr \
  --region us-east-1 \
  --role-arn arn:aws:iam::123456789012:role/streamingplus-ecr-reader
```

For accounts without IRSA, use static credentials (not recommended for production):

```bash
sp connections registries add \
  --name ecr-dev \
  --provider ecr \
  --region us-east-1 \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Google Artifact Registry

```bash
sp connections registries add \
  --name gcr-prod \
  --provider gcr \
  --project my-gcp-project \
  --region us-central1-docker.pkg.dev \
  --workload-identity \
  --gcp-service-account sp-registry@my-gcp-project.iam.gserviceaccount.com
```

### GitHub Container Registry (GHCR)

```bash
sp connections registries add \
  --name ghcr-org \
  --provider ghcr \
  --username myorg \
  --token ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

:::tip
Use a GitHub App installation token instead of a PAT for production use. GitHub Apps have higher rate limits and do not expire unless revoked.
:::

### Docker Hub

```bash
sp connections registries add \
  --name dockerhub-prod \
  --provider dockerhub \
  --username myusername \
  --token dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### JFrog Artifactory

```bash
sp connections registries add \
  --name jfrog-prod \
  --provider jfrog \
  --url https://mycompany.jfrog.io \
  --username svc-streamingplus \
  --token AKCp8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Harbor

```bash
sp connections registries add \
  --name harbor-internal \
  --provider harbor \
  --url https://harbor.internal.example.com \
  --username robot\$streamingplus \
  --token <robot-account-secret>
```

---

## Using a Registry in Deployments

Reference the registry connection by name in any `StreamingPipeline` or `StreamProcessor` resource:

```yaml
apiVersion: streamingplus.io/v1
kind: StreamProcessor
metadata:
  name: payment-enricher
  namespace: data-platform
spec:
  image:
    registry: ecr-prod
    repository: mycompany/payment-enricher
    tag: "2.4.1"
  resources:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2"
      memory: "2Gi"
```

STREAMINGPLUS resolves the `registry` field to the associated `RegistryConnection` and injects the appropriate image pull secret into the pod spec before scheduling.

### Using digest pinning

For production deployments, pin images by digest to prevent mutable tags from causing unexpected updates:

```yaml
spec:
  image:
    registry: ecr-prod
    repository: mycompany/payment-enricher
    digest: sha256:a3f2d1c4e8b7f9e0d2a5c6b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8
```

---

## Image Scanning

STREAMINGPLUS integrates with native registry scanning capabilities to gate deployments on scan results.

### Enable scan enforcement

```bash
sp connections registries configure ecr-prod \
  --scan-on-push true \
  --block-on-critical true \
  --block-on-high false
```

When `--block-on-critical true` is set, any deployment referencing an image with a CRITICAL-severity CVE will be blocked at admission time. A policy violation event is emitted to your observability backend.

### Check scan results for an image

```bash
sp images scan-results \
  --registry ecr-prod \
  --repository mycompany/payment-enricher \
  --tag 2.4.1
```

---

## Credential Rotation

STREAMINGPLUS automates credential rotation for supported registries.

### Manual rotation

```bash
sp connections registries rotate ecr-prod
```

For IRSA-based registries (ECR, GCR with Workload Identity), rotation is automatic because credentials are short-lived tokens issued by the cloud provider. No manual rotation is needed.

### Scheduled rotation

For static credentials, configure automatic rotation on a schedule:

```bash
sp connections registries configure dockerhub-prod \
  --rotate-every 30d
```

:::warning
Credential rotation temporarily interrupts image pulls for running pipelines that are scaling or restarting pods. Schedule rotations during low-traffic windows or use IRSA/Workload Identity to avoid this entirely.
:::

---

## Listing and Describing Registry Connections

```bash
sp connections registries list
```

```
NAME              PROVIDER    STATUS       SCAN-ENABLED   AGE
ecr-prod          ecr         connected    true           21d
gcr-prod          gcr         connected    true           14d
ghcr-org          ghcr        connected    false          7d
harbor-internal   harbor      degraded     true           3d
```

```bash
sp connections registries describe ecr-prod
```

```
Name:           ecr-prod
Provider:       ecr
Region:         us-east-1
Auth:           IRSA
Role ARN:       arn:aws:iam::123456789012:role/streamingplus-ecr-reader
Status:         connected
Scan Enabled:   true
Block Critical: true
Last Pull:      12s ago
```
