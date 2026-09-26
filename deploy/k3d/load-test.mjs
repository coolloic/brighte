// Load test against the k3d cluster (or any deployment with the same routes).
//   node deploy/k3d/load-test.mjs [scenario,...] [connections,...] [seconds]
//   e.g. node deploy/k3d/load-test.mjs register,web 50,200 20
// Scenarios: health, read, register, leads, search, web, and mixed (register and search at the same
// time, half the connections each). BASE_URL defaults to http://localhost:8080.
// Prints one JSON line per run: successful requests/s (okPerSec), the success rate, latency
// percentiles (ms, all responses), and every kind of failure. Fast failures (a 503 from the
// ingress, a GraphQL error) count as requests but not as successes.
import { randomInt, randomUUID } from "node:crypto";
import autocannon from "autocannon";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-dev-password";
const [scenarioArg = "health,read,register,leads,search,web", levelArg = "10,50,200", secondsArg = "15"] = process.argv.slice(2);

const gql = (query, variables) => JSON.stringify({ query, variables });
const json = { "content-type": "application/json" };

const REGISTER = `mutation Register($name: String!, $email: String!, $mobile: String!, $postcode: String!, $services: [String!]!) {
  register(name: $name, email: $email, mobile: $mobile, postcode: $postcode, services: $services) { id }
}`;
const LEADS = `query Leads($limit: Int, $offset: Int, $search: String, $sort: LeadSort) {
  leads(limit: $limit, offset: $offset, search: $search, sort: $sort) {
    total items { id name email mobile postcode createdAt services { code } }
  }
}`;

// Retried: right after a heavy run the API's pool can still be busy with queued requests.
async function adminToken(attempt = 1) {
  try {
    return await login();
  } catch (error) {
    if (attempt >= 5) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return adminToken(attempt + 1);
  }
}

async function login() {
  const res = await fetch(`${BASE}/graphql`, {
    method: "POST",
    headers: json,
    body: gql("mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { accessToken } }", {
      email: "admin@brighte.dev",
      password: ADMIN_PASSWORD,
    }),
  });
  const body = await res.json();
  if (!body.data) throw new Error(`Login failed: ${JSON.stringify(body.errors)}`);
  return body.data.login.accessToken;
}

const token = await adminToken();
const admin = { ...json, authorization: `Bearer ${token}` };

const scenarios = {
  health: { path: "/health/live", request: () => ({ method: "GET" }) },
  read: { path: "/graphql", request: () => ({ method: "POST", headers: json, body: gql("query { serviceTypes { code label } }") }) },
  register: {
    path: "/graphql",
    request: () => ({
      method: "POST",
      headers: json,
      body: gql(REGISTER, {
        name: "Load Test",
        email: `reg-${randomUUID()}@perf.example.com`,
        mobile: "0412 345 678",
        postcode: "2000",
        services: ["delivery", "payment"],
      }),
    }),
  },
  leads: {
    path: "/graphql",
    request: () => ({ method: "POST", headers: admin, body: gql(LEADS, { limit: 20, offset: randomInt(0, 500) * 20, sort: "NEWEST_FIRST" }) }),
  },
  search: {
    path: "/graphql",
    request: () => ({ method: "POST", headers: admin, body: gql(LEADS, { limit: 20, offset: 0, search: `perf-${randomInt(1, 10000)}@`, sort: "NAME_ASC" }) }),
  },
  web: { path: "/", request: () => ({ method: "GET" }) },
};

async function measure(name, connections, seconds) {
  const scenario = scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario: ${name}`);
  let graphqlErrors = 0;
  const result = await autocannon({
    url: `${BASE}${scenario.path}`,
    connections,
    duration: seconds,
    requests: [
      {
        setupRequest: (req) => ({ ...req, ...scenario.request() }),
        onResponse: (status, body) => {
          if (scenario.path === "/graphql" && body.includes('"errors"')) graphqlErrors++;
        },
      },
    ],
  });
  const failed = result.non2xx + result.errors + result.timeouts + graphqlErrors;
  const ok = result.requests.total - result.non2xx - graphqlErrors;
  return {
    scenario: name,
    connections,
    okPerSec: Math.round(ok / seconds),
    successRate: result.requests.total ? Number((ok / result.requests.total).toFixed(4)) : 0,
    p50: result.latency.p50,
    p97_5: result.latency.p97_5,
    p99: result.latency.p99,
    total: result.requests.total,
    failed,
    non2xx: result.non2xx,
    errors: result.errors + result.timeouts,
    graphqlErrors,
  };
}

const seconds = Number(secondsArg);
for (const name of scenarioArg.split(",")) {
  for (const connections of levelArg.split(",").map(Number)) {
    if (name === "mixed") {
      const half = Math.max(1, Math.round(connections / 2));
      const results = await Promise.all([measure("register", half, seconds), measure("search", half, seconds)]);
      for (const r of results) console.log(JSON.stringify({ ...r, scenario: `mixed:${r.scenario}` }));
    } else {
      console.log(JSON.stringify(await measure(name, connections, seconds)));
    }
  }
}
