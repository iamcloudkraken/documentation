---
id: terraform
sidebar_label: Terraform
title: Terraform Integration
---

# Terraform Integration

STREAMINGPLUS provides an official Terraform provider for managing environments, deployments, connections, and secrets as infrastructure-as-code. The provider communicates with the STREAMINGPLUS Control Plane API.

## Provider Configuration

```hcl
terraform {
  required_providers {
    streamingplus = {
      source  = "streamingplus/streamingplus"
      version = "~> 1.3"
    }
  }
}

provider "streamingplus" {
  # API token — use environment variable SP_API_TOKEN or OIDC in CI
  api_token = var.sp_api_token

  # Optional: override the control plane endpoint
  # endpoint = "https://api.streamingplus.io"
}
```

:::tip
In CI pipelines (GitHub Actions, GitLab CI), use OIDC authentication instead of a static API token. Set `oidc = true` in the provider block and configure `sp connect github` in your STREAMINGPLUS environment. The provider will request an OIDC token from the CI provider and exchange it for a short-lived API token automatically.
:::

## Resource: Environment

```hcl
resource "streamingplus_environment" "production" {
  name        = "production"
  description = "Production streaming infrastructure"
  tier        = "enterprise"

  cloud_provider = "aws"
  region         = "us-east-1"

  kubernetes = {
    cluster_name      = "my-eks-cluster"
    namespace         = "streamingplus-production"
    kubeconfig_secret = "kubeconfig-production"
  }

  tags = {
    team        = "data-platform"
    cost_center = "eng-data"
  }
}
```

## Resource: Deployment

```hcl
resource "streamingplus_deployment" "payments_to_bigquery" {
  name        = "payments-to-bigquery"
  environment = streamingplus_environment.production.name

  spec = yamlencode({
    source = {
      type          = "kafka"
      connectionRef = "kafka-prod"
      topics        = ["raw-payments"]
      format        = "json"
    }
    transforms = [
      {
        type       = "filter"
        expression = "record.status == 'completed'"
      }
    ]
    sink = {
      type          = "bigquery"
      connectionRef = "bigquery-prod"
      projectId     = var.gcp_project_id
      datasetId     = "analytics"
      tableId       = "payments"
      writeMode     = "append"
    }
  })

  depends_on = [
    streamingplus_connection.kafka_prod,
    streamingplus_connection.bigquery_prod,
  ]
}
```

## Resource: Connection

```hcl
resource "streamingplus_connection" "kafka_prod" {
  name        = "kafka-prod"
  type        = "kafka"
  environment = streamingplus_environment.production.name

  config = {
    bootstrap_servers = "broker1.internal:9092,broker2.internal:9092"
    sasl_mechanism    = "SCRAM-SHA-512"
    tls_enabled       = true
  }

  secret_ref = "kafka-credentials"   # references a Kubernetes secret
}
```

## Remote State Backend

Store STREAMINGPLUS Terraform state in the managed S3-compatible state backend:

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "streamingplus/production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

Alternatively, use Terraform Cloud (HCP Terraform):

```hcl
terraform {
  cloud {
    organization = "my-org"
    workspaces {
      name = "streamingplus-production"
    }
  }
}
```

## Importing Existing Resources

If you have existing STREAMINGPLUS resources created via the CLI or UI, import them into Terraform state:

```bash
# Import an existing environment
terraform import streamingplus_environment.production production

# Import an existing deployment
terraform import streamingplus_deployment.payments_to_bigquery production/payments-to-bigquery

# Import an existing connection
terraform import streamingplus_connection.kafka_prod production/kafka-prod
```

## Data Sources

Read existing STREAMINGPLUS resources without managing them:

```hcl
data "streamingplus_environment" "staging" {
  name = "staging"
}

output "staging_api_endpoint" {
  value = data.streamingplus_environment.staging.api_endpoint
}
```

## Full Module Example

```hcl
module "streamingplus_pipeline" {
  source  = "streamingplus/pipeline/aws"
  version = "~> 1.0"

  environment    = "production"
  pipeline_name  = "ecommerce-events"

  source_config = {
    type             = "kafka"
    bootstrap_servers = "broker1:9092"
    topics           = ["orders", "clicks", "views"]
  }

  sink_config = {
    type      = "s3"
    bucket    = "my-data-lake"
    region    = "us-east-1"
    format    = "parquet"
    partition = "yyyy/MM/dd"
  }

  tags = var.common_tags
}
```
