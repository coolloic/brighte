#!/usr/bin/env bash
# Scaling test on the k3d cluster (up.sh, then load-data.sh). Three phases, one variable each:
#   A. API at 1, 2, 4 replicas (web at 1): read, register, admin leads page, admin search.
#   B. Web at 1, 2, 4 replicas (API at 1): the server-rendered register page.
#   C. Read replica, API at 4: register and search at the same time (mixed), with every query on the
#      primary, then reads on one replica, then on two replicas (a third Postgres instance).
# Prints one JSON line per run, and each pod's CPU sampled near the end of the run (kubectl top).
# Register runs are deleted afterwards, so every run sees the same 164k leads.
#   deploy/k3d/scaling-test.sh [connections] [seconds per run]
set -euo pipefail
cd "$(dirname "$0")"
CONNECTIONS=${1:-200}
SECONDS_PER_RUN=${2:-20}
PRIMARY=$(kubectl get cluster brighte-db -o jsonpath='{.status.currentPrimary}')

psql() { kubectl exec "$PRIMARY" -c postgres -- psql -tAq -d brighte -c "$1"; }
cleanup() {
  psql "DELETE FROM leads WHERE email LIKE 'reg-%@perf.example.com'"
  psql "VACUUM ANALYZE leads"
  psql "VACUUM ANALYZE lead_service_types"
}

run() { # scenario label
  node load-test.mjs "$1" "$CONNECTIONS" "$SECONDS_PER_RUN" | sed "s/^{/{\"setup\":\"$2\",/" &
  local pid=$!
  # metrics-server averages over a window: sample near the end so it reflects this run.
  sleep $((SECONDS_PER_RUN - 2))
  echo "  cpu: $(kubectl top pods --no-headers 2>/dev/null | awk '$1 !~ /^(migrate|seed)/ {printf "%s=%s ", $1, $2}')"
  wait "$pid"
  case "$1" in register | mixed) cleanup ;; esac
  sleep 8 # let requests still queued in the API's pools drain before the next run
}

scale() { # api web
  kubectl scale deployment/api --replicas="$1" >/dev/null
  kubectl scale deployment/web --replicas="$2" >/dev/null
  kubectl rollout status deployment/api --timeout=180s >/dev/null
  kubectl rollout status deployment/web --timeout=180s >/dev/null
  sleep 5 # let new pods warm up their connection pools
}

reads_on() { # replica | primary
  if [ "$1" = replica ]; then
    kubectl set env deployment/api --from=secret/brighte-app --keys=DATABASE_READ_URL >/dev/null
  else
    kubectl set env deployment/api DATABASE_READ_URL- >/dev/null
  fi
  kubectl rollout status deployment/api --timeout=180s >/dev/null
  sleep 5
}

postgres_instances() { # n
  kubectl patch cluster brighte-db --type merge -p "{\"spec\":{\"instances\":$1}}" >/dev/null
  sleep 10
  kubectl wait cluster/brighte-db --for=condition=Ready --timeout=600s >/dev/null
}

echo "# A. API replicas (web 1, reads on the replica)"
reads_on replica
for n in 1 2 4; do
  scale "$n" 1
  for scenario in read register leads search; do run "$scenario" "api${n}"; done
done

echo "# B. Web replicas (API 1)"
for n in 1 2 4; do
  scale 1 "$n"
  run web "web${n}"
done

echo "# C. Read replica (API 4, web 1): register and search at the same time"
scale 4 1
reads_on primary
run mixed "reads-on-primary"
reads_on replica
run mixed "reads-on-1-replica"
postgres_instances 3
run search "reads-on-2-replicas"
run mixed "reads-on-2-replicas"
postgres_instances 2
scale 1 1
