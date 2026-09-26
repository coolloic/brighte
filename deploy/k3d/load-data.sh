#!/usr/bin/env bash
# Adds 164k leads for load tests (the shape used in the README's load test): 10k varied leads,
# and 154k sharing one mobile number, like the ones a register load test creates.
set -euo pipefail
PRIMARY=$(kubectl get cluster brighte-db -o jsonpath='{.status.currentPrimary}')
kubectl exec -i "$PRIMARY" -c postgres -- psql -q -v ON_ERROR_STOP=1 -d brighte <<'SQL'
INSERT INTO leads (id, name, email, mobile, postcode, "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Perf Lead ' || g, 'perf-' || g || '@perf.example.com', '04' || lpad((10000000 + g)::text, 8, '0'),
       lpad((2000 + g % 1000)::text, 4, '0'), now() - (g || ' minutes')::interval, now() FROM generate_series(1, 10000) g;
INSERT INTO leads (id, name, email, mobile, postcode, "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Load Test', 'load-' || gen_random_uuid() || '@perf.example.com', '0412345678', '2000', now(), now()
FROM generate_series(1, 154000);
INSERT INTO lead_service_types ("leadId", "serviceTypeId", "createdAt")
SELECT l.id, st.id, now() FROM leads l JOIN service_types st ON st.code = 'delivery' WHERE l.email LIKE '%@perf.example.com';
ANALYZE;
SELECT count(*) AS leads FROM leads;
SQL
