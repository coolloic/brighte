# Local horizontal scaling POC (k3d)

A proof of concept on the `poc/k3d-scaling` branch: the API and web app in a local Kubernetes cluster
(k3d), scaled horizontally, with Postgres as a primary plus streaming read replicas, and load-tested
to find the limits.

## What's here

| File | What |
|---|---|
| `../../apps/api/Dockerfile`, `../../apps/web/Dockerfile` | Container images: the API with production dependencies only, and the web app as Next.js standalone output (`NEXT_OUTPUT=standalone`, set only for this build) |
| `postgres.yaml` | Postgres 17 with the [CloudNativePG](https://cloudnative-pg.io) operator: one primary and one replica, 2 vCPU each; services `brighte-db-rw` (primary) and `brighte-db-ro` (replicas) |
| `app.yaml` | The API and web, 1 vCPU per pod (like a 1-vCPU Fargate task), behind Traefik on http://localhost:8080 |
| `migrate-job.yaml`, `seed-job.yaml` | Migrations and the dev seed, run from the API image |
| `up.sh`, `load-data.sh`, `down.sh` | Create and deploy everything; add 164k leads; delete the cluster |
| `load-test.mjs` | Load test: successful requests/s, success rate and latency per scenario |
| `scaling-test.sh` | The scaling test below |
| `results-2026-09-27.txt` | Raw output of the run reported here |

The API reads from a replica when `DATABASE_READ_URL` is set (`replicationOptions` in
`apps/api/src/common/database.ts`, Sequelize's built-in replication): queries outside a transaction
go to the replica, and writes and transactions to `DATABASE_URL`. Unset, nothing changes.

```bash
deploy/k3d/up.sh          # needs Docker, k3d, kubectl; switches kubectl to the k3d-brighte-poc context
deploy/k3d/load-data.sh
deploy/k3d/scaling-test.sh
deploy/k3d/down.sh
```

POC shortcuts: secrets are inline in `app.yaml`, and rate limits are raised, because Traefik rewrites
`X-Forwarded-For`, so every request from one load-generating machine would share one visitor IP.

## Results (2026-09-27)

All on one laptop (MacBook Pro M4 Pro). The Kubernetes node is Docker Desktop's VM (12 CPUs, 8 GB), and
the load generator runs on the same CPUs, so absolute numbers are lower than on real hardware: compare
the ratios. 164k leads, 200 concurrent connections, 20 s per run, successful requests only.

### API pods (web at 1, reads on the replica)

| Successful requests/s | 1 pod | 2 pods | 4 pods |
|---|---|---|---|
| Read (`serviceTypes`) | 2,228 | 3,766 | 6,327 |
| Register (write, one transaction) | 1,116 | 1,687 | 2,683 |
| Admin search | 618 | 542 | 472 |
| Admin leads page | fails (see below) | fails | 54, 96% success, p99 9.9 s |

Reads and writes scale with pods (2.8× and 2.4× at 4 pods). Admin search doesn't: one replica is the
limit (it doubles with a second, below).

### Web pods (API at 1)

| Register page | 1 pod | 2 pods | 4 pods |
|---|---|---|---|
| Successful pages/s | 247 | 481 | 897 |
| p99 | 5.3 s | 3.0 s | 0.67 s |

Close to linear (3.6× at 4 pods). A 1-vCPU pod server-renders about 250 pages a second.

### Read replica (4 API pods, register and search at the same time)

| Setup | Register/s | Search/s | Total |
|---|---|---|---|
| Every query on the primary | 226 | 219 | 445 |
| Reads on 1 replica | 403 | 210 | 613 |
| Reads on 2 replicas | 715 | 354 | 1,069 |

Moving reads off the primary lets it spend its 2 vCPU on writes: registrations rise 78% with one
replica and 3.2× with two. Search alone went from 472/s on one replica to 1,106/s on two. The limit is
the primary: register alone reached 2,683/s, but 226/s while it also served searches.

## Findings

1. **Kubernetes' default probe timeouts restarted busy pods.** Probes wait 1 second by default. Under
   full load a 1-vCPU Node.js pod answered `/health/live` slower than that, so it was restarted mid-test
   and its load moved onto the other pods. `app.yaml` now gives probes 3-5 s and lets liveness fail for
   a minute before a restart: liveness should only restart a stuck process, never a busy one.
2. **Readiness goes through the request pool, so a saturated pool takes the pod out of service.**
   `/health/ready` runs a query through the same 10-connection pool as requests, with a 2 s limit. On the
   leads page, every connection was busy with heavy queries, readiness timed out, and Traefik answered 503
   to everything (1 pod: 2% success). TODO: check readiness on a dedicated connection, and shed load
   explicitly (a fast 503 when too many requests wait for the pool) instead of through readiness.
3. **The leads page is the heaviest query.** Each page counts all 164k leads and skips up to 10,000 rows
   (`OFFSET`), so it's bound by database work and the pool, and more API pods don't help. The README's
   10× scale plan already lists the fix: keyset pagination and a cached or estimated total.
4. **The database primary is the ceiling for writes.** Read replicas raise it by taking reads away; beyond
   that, a larger primary, or buffering writes (the SQS outage queue in `docs/architecture.md` would also
   smooth spikes).
5. **Scaling the pods needs shared state first** (not needed for this test, since rate limits were raised):
   rate limits in Redis, one Server Actions encryption key for all web pods, and graceful shutdown
   (the API doesn't handle SIGTERM, so pods stopped during rollouts ended with `Error`).
6. **Images:** the API image is 806 MB, because the production-only install keeps unused packages in
   pnpm's store; `pnpm deploy` with a `files` list in each package would cut it. The web image is 404 MB.
