---
id: network
sidebar_label: Network Connectivity
title: Network Connectivity Connections
---

# Network Connectivity

STREAMINGPLUS can establish private network connectivity between the control plane, registered clusters, and external systems using cloud-native networking primitives. A `NetworkConnection` resource represents one of three connectivity models: **VPC Peering**, **AWS PrivateLink / GCP Private Service Connect**, or **Site-to-Site VPN**.

---

## Connectivity Models Comparison

| Model | Typical Latency | Setup Complexity | Best For |
|---|---|---|---|
| VPC Peering | < 1 ms (same region) | Low | Same-cloud, cross-VPC traffic within a single region |
| PrivateLink / PSC | < 2 ms | Medium | Exposing a specific service endpoint privately without full VPC access |
| Site-to-Site VPN | 5–50 ms (varies) | Medium–High | On-premises to cloud or cross-cloud connectivity |

---

## VPC Peering

VPC Peering creates a direct routing path between two VPCs in the same cloud provider. STREAMINGPLUS automates the peering request and route table updates on both sides.

### Create a VPC Peering connection

```bash
sp connections network add \
  --name vpc-peer-prod \
  --type vpc-peering \
  --provider aws \
  --local-vpc vpc-0a1b2c3d4e5f67890 \
  --local-region us-east-1 \
  --local-account 123456789012 \
  --peer-vpc vpc-0f9e8d7c6b5a43210 \
  --peer-region us-east-1 \
  --peer-account 987654321098
```

### VPC Peering YAML

```yaml
apiVersion: streamingplus.io/v1
kind: NetworkConnection
metadata:
  name: vpc-peer-prod
  namespace: platform
spec:
  type: vpc-peering
  provider: aws
  vpcPeering:
    localVpc:
      id: vpc-0a1b2c3d4e5f67890
      region: us-east-1
      accountId: "123456789012"
      cidr: 10.0.0.0/16
    peerVpc:
      id: vpc-0f9e8d7c6b5a43210
      region: us-east-1
      accountId: "987654321098"
      cidr: 10.1.0.0/16
    autoRouteUpdate: true
    dnsResolution: true
```

:::note
VPC Peering does not support transitive routing. If your topology requires routing through an intermediate VPC, use AWS Transit Gateway or GCP VPC Network Peering with route export instead.
:::

---

## AWS PrivateLink / GCP Private Service Connect

PrivateLink (AWS) and Private Service Connect (GCP) allow you to expose a single service endpoint privately to another VPC without granting full network access. This is ideal for exposing managed Kafka brokers, databases, or internal APIs to STREAMINGPLUS clusters without peering entire VPCs.

### Create a PrivateLink connection (AWS)

```bash
sp connections network add \
  --name kafka-privatelink \
  --type privatelink \
  --provider aws \
  --service-name com.amazonaws.vpce.us-east-1.vpce-svc-0a1b2c3d4e5f67890 \
  --vpc vpc-0a1b2c3d4e5f67890 \
  --subnets subnet-0a1b2c3d,subnet-0e5f6a7b \
  --security-groups sg-0a1b2c3d4e5f67890
```

### PrivateLink YAML

```yaml
apiVersion: streamingplus.io/v1
kind: NetworkConnection
metadata:
  name: kafka-privatelink
  namespace: platform
spec:
  type: privatelink
  provider: aws
  privateLink:
    serviceName: com.amazonaws.vpce.us-east-1.vpce-svc-0a1b2c3d4e5f67890
    vpcId: vpc-0a1b2c3d4e5f67890
    subnetIds:
      - subnet-0a1b2c3d
      - subnet-0e5f6a7b
    securityGroupIds:
      - sg-0a1b2c3d4e5f67890
    privateDnsEnabled: true
```

### Create a Private Service Connect connection (GCP)

```bash
sp connections network add \
  --name pubsub-psc \
  --type private-service-connect \
  --provider gcp \
  --project my-gcp-project \
  --network my-vpc-network \
  --subnetwork my-subnetwork \
  --target-service projects/my-gcp-project/regions/us-central1/serviceAttachments/my-service
```

---

## Site-to-Site VPN

Site-to-Site VPN connects an on-premises network or a different cloud provider to your STREAMINGPLUS-managed VPC using IPsec tunnels. STREAMINGPLUS provisions the cloud-side VPN gateway and provides the configuration parameters to apply at the customer gateway.

### Create a Site-to-Site VPN connection

```bash
sp connections network add \
  --name dc1-vpn \
  --type site-to-site-vpn \
  --provider aws \
  --vpc vpc-0a1b2c3d4e5f67890 \
  --customer-gateway-ip 203.0.113.10 \
  --bgp-asn 65000 \
  --static-routes 192.168.10.0/24,192.168.20.0/24
```

### Site-to-Site VPN YAML

```yaml
apiVersion: streamingplus.io/v1
kind: NetworkConnection
metadata:
  name: dc1-vpn
  namespace: platform
spec:
  type: site-to-site-vpn
  provider: aws
  siteToSiteVpn:
    vpcId: vpc-0a1b2c3d4e5f67890
    customerGateway:
      ip: 203.0.113.10
      bgpAsn: 65000
    routing: static
    staticRoutes:
      - 192.168.10.0/24
      - 192.168.20.0/24
    tunnelOptions:
      - preSharedKey: ""          # auto-generated if omitted
        phase1EncryptionAlgorithms: [AES256]
        phase1IntegrityAlgorithms: [SHA2-256]
        phase2EncryptionAlgorithms: [AES256]
        phase2IntegrityAlgorithms: [SHA2-256]
```

After creation, retrieve the customer gateway configuration:

```bash
sp connections network describe dc1-vpn --output customer-gateway-config
```

This returns the IPsec parameters (pre-shared keys, tunnel IPs, phase 1/2 settings) to apply to your on-premises firewall or router.

:::warning
Pre-shared keys are shown only once at creation time. Store them in your secrets manager immediately. Use `sp connections network rotate dc1-vpn --keys` to regenerate keys if they are lost.
:::

---

## Network Policies

After establishing a `NetworkConnection`, apply Kubernetes `NetworkPolicy` resources to restrict which pods can communicate over the new network path. STREAMINGPLUS provides a helper command to generate a baseline policy:

```bash
sp connections network policy generate kafka-privatelink \
  --allow-namespace data-platform \
  --output yaml
```

Example generated policy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-kafka-privatelink
  namespace: data-platform
spec:
  podSelector:
    matchLabels:
      streamingplus.io/pipeline: "true"
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 10.2.0.5/32        # PrivateLink endpoint IP
      ports:
        - protocol: TCP
          port: 9092
        - protocol: TCP
          port: 9093
```

Apply the policy:

```bash
kubectl apply -f network-policy.yaml
```

:::tip
Combine `NetworkPolicy` with STREAMINGPLUS's built-in mTLS to achieve defense-in-depth: traffic is both network-restricted and mutually authenticated at the application layer.
:::

---

## Listing Network Connections

```bash
sp connections network list
```

```
NAME               TYPE               PROVIDER   STATUS        AGE
vpc-peer-prod      vpc-peering        aws        connected     14d
kafka-privatelink  privatelink        aws        connected     7d
dc1-vpn            site-to-site-vpn   aws        degraded      2d
pubsub-psc         private-svc-conn   gcp        connected     10d
```
