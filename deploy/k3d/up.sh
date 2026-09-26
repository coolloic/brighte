#!/usr/bin/env bash
# Creates a local k3d cluster with Postgres (primary + read replica), the API and the web app,
# reachable on http://localhost:8080. Re-running it rebuilds the images and redeploys.
# Needs Docker, k3d and kubectl. k3d switches kubectl's current context to k3d-brighte-poc.
set -euo pipefail
cd "$(dirname "$0")/../.."

CLUSTER=brighte-poc
CNPG_MANIFEST=https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.30/releases/cnpg-1.30.1.yaml

k3d cluster get "$CLUSTER" >/dev/null 2>&1 || k3d cluster create "$CLUSTER" -p "8080:80@loadbalancer" --wait

docker build -f apps/api/Dockerfile -t brighte-api:poc .
docker build -f apps/web/Dockerfile -t brighte-web:poc .
k3d image import -c "$CLUSTER" brighte-api:poc brighte-web:poc

# CloudNativePG operator, then the Postgres cluster.
kubectl apply --server-side -f "$CNPG_MANIFEST" >/dev/null
kubectl -n cnpg-system rollout status deployment/cnpg-controller-manager --timeout=180s
kubectl apply -f deploy/k3d/postgres.yaml
kubectl wait cluster/brighte-db --for=condition=Ready --timeout=600s

# App config and deployments (the jobs read its secret), then migrate and seed.
kubectl apply -f deploy/k3d/app.yaml
kubectl delete job migrate seed --ignore-not-found >/dev/null
kubectl apply -f deploy/k3d/migrate-job.yaml
kubectl wait job/migrate --for=condition=Complete --timeout=180s
kubectl apply -f deploy/k3d/seed-job.yaml
kubectl wait job/seed --for=condition=Complete --timeout=180s

# New images under the same tag: restart so the pods pick them up.
kubectl rollout restart deployment/api deployment/web >/dev/null
kubectl rollout status deployment/api --timeout=180s
kubectl rollout status deployment/web --timeout=180s
echo "Up: http://localhost:8080 (admin@brighte.dev / admin-dev-password)"
