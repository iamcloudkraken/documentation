---
id: azure
sidebar_label: Azure
title: Azure Integration
---

# Azure Integration

STREAMINGPLUS integrates with Microsoft Azure using **User-Assigned Managed Identities (UAMI)** via the Azure AD Workload Identity mechanism. This allows STREAMINGPLUS pods running on AKS to authenticate to Azure services without storing credentials, using federated identity tokens issued by the Kubernetes OIDC provider.

## How Azure Workload Identity Works

```
STREAMINGPLUS Pod (AKS)
  └─ Kubernetes ServiceAccount token
       └─ Azure AD Token Exchange (federated credential)
            └─ Azure AD Access Token (UAMI)
                 └─ Azure Resource Access (Blob, Event Hubs, etc.)
```

## Setup: sp connect Command

```bash
sp connect azure \
  --subscription-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --resource-group streamingplus-rg \
  --aks-cluster my-aks-cluster \
  --aks-resource-group aks-rg \
  --env production
```

This command:
1. Retrieves the OIDC issuer URL from your AKS cluster
2. Creates a User-Assigned Managed Identity named `streamingplus-production-identity`
3. Creates a federated identity credential linking the UAMI to the STREAMINGPLUS Kubernetes ServiceAccount
4. Outputs the identity's `clientId` to use in subsequent role assignments

## Role Assignment Example

After connecting, assign Azure RBAC roles to the UAMI for each service you need to access:

```bash
# Storage Blob Data Contributor (for Azure Blob sink)
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee-object-id $(az identity show \
    --name streamingplus-production-identity \
    --resource-group streamingplus-rg \
    --query principalId -o tsv) \
  --scope /subscriptions/xxxxxxxx/resourceGroups/data-rg/providers/Microsoft.Storage/storageAccounts/mydatalake

# Azure Event Hubs Data Sender (for Event Hubs sink)
az role assignment create \
  --role "Azure Event Hubs Data Sender" \
  --assignee-object-id $(az identity show \
    --name streamingplus-production-identity \
    --resource-group streamingplus-rg \
    --query principalId -o tsv) \
  --scope /subscriptions/xxxxxxxx/resourceGroups/data-rg/providers/Microsoft.EventHub/namespaces/my-eventhubs
```

:::note
Role assignments take 2–5 minutes to propagate in Azure AD. If `sp connections test` fails immediately after assignment, wait a few minutes and retry.
:::

## Supported Azure Services

| Service | Connection Type | Use Case |
|---------|----------------|----------|
| Azure Blob Storage | `azure-blob` | Object storage sink |
| Azure Event Hubs | `eventhubs` | Kafka-compatible source/sink |
| Azure Data Lake Storage Gen2 | `adls-gen2` | Data lake sink |
| Azure Synapse Analytics | `synapse` | Data warehouse sink |
| Azure Key Vault | `azure-key-vault` | Secret injection |
| Azure Service Bus | `servicebus` | Queue-based source/sink |
| Azure Cosmos DB | `cosmosdb` | Document database sink |

## Creating an Azure Blob Connection

```bash
sp connections create azure-blob-prod \
  --type azure-blob \
  --storage-account mydatalake \
  --client-id $(az identity show \
    --name streamingplus-production-identity \
    --resource-group streamingplus-rg \
    --query clientId -o tsv) \
  --env production
```

## Federated Credential Details

The federated credential created by `sp connect azure` looks like:

```json
{
  "name": "streamingplus-production-fedcred",
  "issuer": "https://oidc.prod.example.com/",
  "subject": "system:serviceaccount:production:streamingplus-worker",
  "audiences": ["api://AzureADTokenExchange"]
}
```

The `subject` field must exactly match the Kubernetes ServiceAccount identity (`system:serviceaccount:<namespace>:<service-account-name>`).

:::warning
If you re-create the STREAMINGPLUS environment or change its namespace, you must update the federated credential's `subject` to match the new ServiceAccount identity. Use `sp connect azure --update` to refresh the federated credential.
:::

## Verifying the Integration

```bash
sp integrations status --provider azure --env production
sp connections test azure-blob-prod --verbose
```
