---
id: aws
sidebar_label: AWS
title: AWS Integration
---

# AWS Integration

STREAMINGPLUS integrates with AWS using **IAM Roles for Service Accounts (IRSA)**, the Kubernetes-native mechanism for granting pods access to AWS resources without static credentials. This avoids storing access keys in secrets and provides automatic credential rotation.

## How IRSA Works

IRSA works by annotating a Kubernetes ServiceAccount with an IAM Role ARN. When a STREAMINGPLUS pod starts, the AWS SDK automatically exchanges the pod's projected service account token for short-lived AWS STS credentials for the specified role.

```
STREAMINGPLUS Pod
  └─ Kubernetes ServiceAccount (annotated with IAM Role ARN)
       └─ OIDC Token (auto-mounted by Kubernetes)
            └─ AWS STS AssumeRoleWithWebIdentity
                 └─ Short-lived AWS Credentials (auto-refreshed)
```

## Setup: sp connect Command

Connect your STREAMINGPLUS environment to your AWS account in one step:

```bash
sp connect aws \
  --account-id 123456789012 \
  --region us-east-1 \
  --cluster-oidc-issuer https://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE1234567890 \
  --env production
```

This command:
1. Creates an IAM OIDC Identity Provider in your AWS account (if not already present)
2. Creates a base IAM role for the STREAMINGPLUS control plane
3. Outputs a trust policy template for you to customize per-service role

## IAM Trust Policy

Each service that STREAMINGPLUS integrates with (S3, Kinesis, MSK, etc.) should have its own IAM role with a scoped trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE1234567890"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE1234567890:sub": "system:serviceaccount:production:streamingplus-worker",
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE1234567890:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

:::note
The `sub` condition scopes the role to a specific Kubernetes namespace and ServiceAccount. STREAMINGPLUS creates a dedicated ServiceAccount per environment (e.g., `streamingplus-worker` in the `production` namespace).
:::

## Supported AWS Services

| Service | Connection Type | Use Case |
|---------|----------------|----------|
| Amazon S3 | `s3` | Object storage sink, source |
| Amazon Kinesis Data Streams | `kinesis` | High-throughput source |
| Amazon MSK (Kafka) | `kafka` | Managed Kafka source/sink |
| AWS Glue Schema Registry | `glue-schema-registry` | Schema management for Avro/Protobuf |
| AWS Secrets Manager | `aws-secrets-manager` | Secret injection |
| Amazon SQS | `sqs` | Queue-based source |
| Amazon EventBridge | `eventbridge` | Event routing sink |

## Creating an S3 Connection with IRSA

```bash
sp connections create s3-data-lake \
  --type s3 \
  --region us-east-1 \
  --role-arn arn:aws:iam::123456789012:role/StreamingPlusS3Role \
  --env production
```

Verify connectivity:

```bash
sp connections test s3-data-lake
```

## Auditing AWS Usage

:::tip
Enable AWS CloudTrail in your account and filter for STREAMINGPLUS activity using the `userIdentity.principalId` field, which will contain the STREAMINGPLUS ServiceAccount name. Combine this with `sp audit events` to correlate STREAMINGPLUS deployment events with AWS API calls.
:::

```bash
sp audit events \
  --env production \
  --resource connections \
  --since 24h \
  --output json | jq '.[] | select(.resource_type == "aws")'
```

## Troubleshooting IRSA

If a connection fails with `AccessDenied` or `InvalidIdentityToken`:

1. Verify the OIDC provider exists in your AWS account:
   ```bash
   aws iam list-open-id-connect-providers
   ```
2. Check that the trust policy `sub` matches the STREAMINGPLUS ServiceAccount:
   ```bash
   sp envs get production --show-service-account
   ```
3. Validate the role using `sp connections test`:
   ```bash
   sp connections test s3-data-lake --verbose
   ```
