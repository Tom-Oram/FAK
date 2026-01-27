# Kubernetes Deployment

## Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured
- Container registry access

## Deployment

```bash
# Build and push images
docker build -t your-registry/fak-frontend:latest .
docker push your-registry/fak-frontend:latest

# Deploy
kubectl apply -k k8s/
```

## Manifests

| File | Description |
|------|-------------|
| `deployment.yaml` | 2 replicas with resource limits |
| `service.yaml` | ClusterIP service on port 80 |
| `ingress.yaml` | Ingress with TLS support |
| `kustomization.yaml` | Kustomize configuration |

## Customization

### Change Ingress Host

Edit `k8s/ingress.yaml`:
```yaml
spec:
  rules:
  - host: fak.your-domain.com
```

### Enable TLS

Uncomment TLS section in `ingress.yaml` and configure cert-manager.

## Port Forwarding (Testing)

```bash
kubectl port-forward svc/first-aid-kit 8080:80
```
