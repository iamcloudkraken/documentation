---
id: cloud
sidebar_label: Cloud Deploy
title: Cloud Deployment
---

# Cloud Deployment

STREAMINGPLUS provides fully managed environments on AWS, GCP, and Azure.

## Create an Environment

```bash
# AWS
sp envs create --name production --cloud aws --region us-east-1 --tier standard

# GCP
sp envs create --name production --cloud gcp --region us-central1 --tier standard

# Azure
sp envs create --name production --cloud azure --region eastus --tier standard
```

## Tiers

| Tier | vCPU | Memory | Best for |
|------|------|--------|---------|
| starter | 4 | 8 GB | Development |
| standard | 16 | 32 GB | Production |
| performance | 64 | 128 GB | High-throughput |

## List Environments

```bash
sp envs list
sp envs describe production
sp envs delete staging --confirm
```
