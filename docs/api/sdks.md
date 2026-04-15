---
id: sdks
sidebar_label: SDKs
title: SDKs
---

# SDKs

STREAMINGPLUS provides official client SDKs for Python, Go, and Java. All SDKs wrap the REST API and provide idiomatic language constructs for managing environments, deployments, connections, and pipelines.

## Python SDK

### Installation

```bash
pip install streamingplus-sdk
```

Requires Python 3.9+.

### Authentication

```python
from streamingplus import Client

# From environment variable (recommended)
import os
client = Client(api_token=os.environ["SP_TOKEN"])

# Explicit token
client = Client(api_token="spsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

# Custom endpoint (self-hosted)
client = Client(
    api_token=os.environ["SP_TOKEN"],
    endpoint="https://streamingplus.internal.example.com",
)
```

### Create an Environment

```python
from streamingplus import Client
from streamingplus.models import EnvironmentSpec

client = Client(api_token=os.environ["SP_TOKEN"])

env = client.environments.create(
    name="staging",
    spec=EnvironmentSpec(
        cloud="aws",
        region="us-east-1",
        tier="professional",
    ),
)
print(f"Created environment: {env.name} (status: {env.status})")
```

### Deploy a Service

```python
from streamingplus.models import DeploymentSpec, SourceSpec, SinkSpec

deployment = client.deployments.create(
    name="payments-to-bigquery",
    environment="production",
    spec=DeploymentSpec(
        source=SourceSpec(
            type="kafka",
            connection_ref="kafka-prod",
            topics=["raw-payments"],
            format="json",
        ),
        sink=SinkSpec(
            type="bigquery",
            connection_ref="bigquery-prod",
            project_id="my-gcp-project",
            dataset_id="analytics",
            table_id="payments",
        ),
    ),
)

# Wait for the deployment to become healthy
deployment.wait_until_ready(timeout=300)
print(f"Deployment is running. Throughput: {deployment.metrics.records_per_second} rec/s")
```

### List and Monitor Deployments

```python
for dep in client.deployments.list(environment="production"):
    metrics = dep.metrics()
    print(f"{dep.name}: {metrics.records_per_second:.0f} rec/s, lag={metrics.consumer_lag}")
```

---

## Go SDK

### Installation

```bash
go get github.com/streamingplus/sdk-go@v1.3.0
```

### Authentication

```go
package main

import (
    "context"
    "os"

    sp "github.com/streamingplus/sdk-go"
)

func main() {
    client := sp.NewClient(
        sp.WithAPIToken(os.Getenv("SP_TOKEN")),
        // sp.WithEndpoint("https://streamingplus.internal.example.com"),
    )
    ctx := context.Background()
    _ = ctx
}
```

### Create an Environment

```go
env, err := client.Environments.Create(ctx, &sp.CreateEnvironmentRequest{
    Name: "staging",
    Spec: sp.EnvironmentSpec{
        Cloud:  "aws",
        Region: "us-east-1",
        Tier:   "professional",
    },
})
if err != nil {
    log.Fatalf("failed to create environment: %v", err)
}
fmt.Printf("Created: %s\n", env.Name)
```

### Deploy a Service

```go
dep, err := client.Deployments.Create(ctx, &sp.CreateDeploymentRequest{
    Name:        "payments-to-bigquery",
    Environment: "production",
    Spec: sp.DeploymentSpec{
        Source: sp.SourceSpec{
            Type:          "kafka",
            ConnectionRef: "kafka-prod",
            Topics:        []string{"raw-payments"},
            Format:        "json",
        },
        Sink: sp.SinkSpec{
            Type:          "bigquery",
            ConnectionRef: "bigquery-prod",
            ProjectID:     "my-gcp-project",
            DatasetID:     "analytics",
            TableID:       "payments",
        },
    },
})
if err != nil {
    log.Fatalf("failed to create deployment: %v", err)
}

// Wait for healthy
if err := dep.WaitUntilReady(ctx, 5*time.Minute); err != nil {
    log.Fatalf("deployment did not become healthy: %v", err)
}
fmt.Printf("Deployment %s is running\n", dep.Name)
```

---

## Java SDK

### Maven

```xml
<dependency>
  <groupId>io.streamingplus</groupId>
  <artifactId>streamingplus-sdk</artifactId>
  <version>1.3.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'io.streamingplus:streamingplus-sdk:1.3.0'
```

Requires Java 11+.

### Authentication

```java
import io.streamingplus.StreamingPlusClient;

StreamingPlusClient client = StreamingPlusClient.builder()
    .apiToken(System.getenv("SP_TOKEN"))
    // .endpoint("https://streamingplus.internal.example.com")
    .build();
```

### Create an Environment

```java
import io.streamingplus.model.*;

Environment env = client.environments().create(
    CreateEnvironmentRequest.builder()
        .name("staging")
        .spec(EnvironmentSpec.builder()
            .cloud("aws")
            .region("us-east-1")
            .tier("professional")
            .build())
        .build()
);
System.out.println("Created: " + env.getName());
```

### Deploy a Service

```java
Deployment dep = client.deployments().create(
    CreateDeploymentRequest.builder()
        .name("payments-to-bigquery")
        .environment("production")
        .spec(DeploymentSpec.builder()
            .source(SourceSpec.builder()
                .type("kafka")
                .connectionRef("kafka-prod")
                .topics(List.of("raw-payments"))
                .format("json")
                .build())
            .sink(SinkSpec.builder()
                .type("bigquery")
                .connectionRef("bigquery-prod")
                .projectId("my-gcp-project")
                .datasetId("analytics")
                .tableId("payments")
                .build())
            .build())
        .build()
);

// Wait for healthy (blocks up to 5 minutes)
dep.waitUntilReady(Duration.ofMinutes(5));
System.out.println("Deployment is running: " + dep.getName());
```

## SDK Error Handling

All SDKs throw/return typed errors for common failure modes:

| Error Class | Condition |
|-------------|-----------|
| `AuthenticationError` | Invalid or expired API token |
| `ResourceNotFoundError` | Resource does not exist |
| `ValidationError` | Invalid request body or spec |
| `RateLimitError` | Too many requests (429) |
| `ConflictError` | Resource already exists or version conflict |
| `TimeoutError` | `waitUntilReady` exceeded the timeout |
