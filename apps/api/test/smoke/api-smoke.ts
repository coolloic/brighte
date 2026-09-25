// Black-box smoke test: real HTTP against the compiled API (`node dist/main.js`), the way the web
// app calls it. Covers every operation, edge cases and error codes across three servers: dev with
// rate limits raised (functional checks), dev with the real limits, and production mode.
//
// Run: pnpm --filter @brighte/api test:smoke   (needs `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`)
// Ports: SMOKE_PORT (default 4801) to SMOKE_PORT + 3. Test data uses a unique prefix and is deleted.
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { QueryTypes, Sequelize } from 'sequelize';

const API_DIR = join(import.meta.dirname, '../..');
process.loadEnvFile(join(API_DIR, '.env'));
const env = process.env;
const BASE_PORT = Number(env.SMOKE_PORT ?? 4801);
const P = `smoke-${Date.now()}`;
const mail = (n: string) => `${P}-${n}@test.dev`;

// ---------- harness ----------
type Result = { section: string; name: string; ok: boolean; err?: string };
const results: Result[] = [];
let section = '';
const group = (name: string) => (section = name);
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ section, name, ok: true });
  } catch (e) {
    results.push({ section, name, ok: false, err: (e as Error).message });
  }
}
function eq(actual: unknown, expected: unknown, label = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label} expected ${b}, got ${a}`);
}
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------- database (setup and cleanup only) ----------
const db = new Sequelize(env.DATABASE_URL!, { logging: false });
async function scalar(sql: string, replacements: Record<string, unknown> = {}): Promise<string> {
  const rows = await db.query<Record<string, unknown>>(sql, { replacements, type: QueryTypes.SELECT });
  return String(Object.values(rows[0] ?? {})[0]);
}
const exec = (sql: string, replacements: Record<string, unknown> = {}) => db.query(sql, { replacements });
const countLeads = (email: string) => scalar('select count(*) from leads where email = :email', { email });
const addServiceType = (code: string, active: boolean) =>
  exec(`insert into service_types (code, label, active, "createdAt", "updatedAt") values (:code, :code, :active, now(), now())`, { code, active });

// ---------- servers ----------
const procs: ChildProcess[] = [];
function spawnApi(port: number, extraEnv: Record<string, string>) {
  const child = spawn('node', ['dist/main.js'], {
    cwd: API_DIR,
    env: { ...env, PORT: String(port), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
  child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
  procs.push(child);
  return { child, output: () => output };
}
async function startServer(port: number, extraEnv: Record<string, string>): Promise<string> {
  const { output } = spawnApi(port, extraEnv);
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://localhost:${port}/`);
      return `http://localhost:${port}`;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`API on :${port} did not start:\n${output()}`);
}
async function portFree(port: number) {
  try {
    await fetch(`http://localhost:${port}/`);
    return false;
  } catch {
    return true;
  }
}

// ---------- HTTP helpers ----------
type GqlError = {
  message: string;
  path?: (string | number)[];
  extensions?: { code?: string; fields?: Record<string, string>; retryAfter?: number; stacktrace?: string[] };
};
type GqlResult = { status: number; headers: Headers; data: any; error?: GqlError; code?: string; fields?: Record<string, string> };

async function gql(base: string, query: string | undefined, variables?: unknown, opts: { token?: string; headers?: Record<string, string> } = {}): Promise<GqlResult> {
  const { token, headers = {} } = opts;
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token && { authorization: token.includes(' ') ? token : `Bearer ${token}` }), ...headers },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let body: { data?: any; errors?: GqlError[] } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // non-JSON body (e.g. 413 HTML): leave empty
  }
  const error = body.errors?.[0];
  return { status: res.status, headers: res.headers, data: body.data, error, code: error?.extensions?.code, fields: error?.extensions?.fields };
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(payload: object, { secret = env.JWT_SECRET!, alg = 'HS256' } = {}) {
  const head = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  if (alg === 'none') return `${head}.`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

const REGISTER = `mutation R($name: String!, $email: String!, $mobile: String!, $postcode: String!, $services: [String!]!) {
  register(name: $name, email: $email, mobile: $mobile, postcode: $postcode, services: $services) { id name email mobile postcode createdAt services { code label active } } }`;
const LEADS = `query L($limit: Int, $offset: Int, $serviceType: String, $sort: LeadSort) {
  leads(limit: $limit, offset: $offset, serviceType: $serviceType, sort: $sort) { total limit offset items { id name email services { code } } } }`;
const LEAD = `query($id: ID!) { lead(id: $id) { id name email mobile postcode services { code } } }`;
const LOGIN = `mutation($e: String!, $p: String!) { login(email: $e, password: $p) { accessToken user { id email role } } }`;
const ME = '{ me { id email role } }';
const CREATE_USER = `mutation($input: CreateUserInput!) { createUser(input: $input) { id email role } }`;
type RegisterVars = { name: string; email: string; mobile: string; postcode: string; services: string[] };
const valid = (n: string, over: Partial<RegisterVars> = {}): RegisterVars => ({
  name: `Lead ${n}`,
  email: mail(n),
  mobile: '0412 345 678',
  postcode: '2000',
  services: ['delivery'],
  ...over,
});
const registerDoc = (alias: string, email: string, mobile = '0412345678') =>
  `${alias}: register(name: "Smoke", email: "${email}", mobile: "${mobile}", postcode: "2000", services: ["delivery"]) { id }`;

// =====================================================================
async function functional(base: string) {
  const register = (vars: unknown) => gql(base, REGISTER, vars);
  const admin = (await gql(base, LOGIN, { e: 'admin@brighte.dev', p: env.SEED_ADMIN_PASSWORD })).data?.login.accessToken as string;
  const user = (await gql(base, LOGIN, { e: 'user@brighte.dev', p: env.SEED_USER_PASSWORD })).data?.login.accessToken as string;
  if (!admin || !user) throw new Error('Seed accounts cannot log in: run `pnpm db:seed`.');

  group('Transport & GraphQL protocol');
  await check('GET / is public and returns 200', async () => {
    const r = await fetch(`${base}/`);
    eq([r.status, await r.text()], [200, 'Hello World!']);
  });
  await check('Unknown REST route -> 404 JSON', async () => {
    const r = await fetch(`${base}/missing`);
    eq([r.status, ((await r.json()) as { statusCode: number }).statusCode], [404, 404]);
  });
  await check('GET query without preflight header -> 400 CSRF', async () => {
    const r = await fetch(`${base}/graphql?query=${encodeURIComponent('{ serviceTypes { code } }')}`);
    eq(r.status, 400);
    ok((await r.text()).includes('CSRF'), 'no CSRF message');
  });
  await check('GET query with apollo-require-preflight -> 200', async () => {
    const r = await fetch(`${base}/graphql?query=${encodeURIComponent('{ serviceTypes { code } }')}`, { headers: { 'apollo-require-preflight': 'true' } });
    eq(r.status, 200);
  });
  await check('Mutation over GET -> 405, nothing written', async () => {
    const q = `mutation { ${registerDoc('a', mail('get'))} }`;
    const r = await fetch(`${base}/graphql?query=${encodeURIComponent(q)}`, { headers: { 'apollo-require-preflight': 'true' } });
    eq(r.status, 405);
    eq(await countLeads(mail('get')), '0');
  });
  await check('POST text/plain -> 400 CSRF, nothing written', async () => {
    const r = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ query: `mutation { ${registerDoc('a', mail('csrf'))} }` }),
    });
    eq(r.status, 400);
    eq(await countLeads(mail('csrf')), '0');
  });
  const postRaw = (body: string) => fetch(`${base}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  await check('Batched request (JSON array) -> 400', async () => {
    eq((await postRaw(JSON.stringify([{ query: '{ serviceTypes { code } }' }, { query: '{ serviceTypes { code } }' }]))).status, 400);
  });
  await check('Body over 100kb -> 413', async () => {
    eq((await postRaw(JSON.stringify({ query: '{ serviceTypes { code } }', variables: { pad: 'x'.repeat(110_000) } }))).status, 413);
  });
  await check('Malformed JSON -> 400', async () => {
    eq((await postRaw('{"query": ')).status, 400);
  });
  await check('Missing query -> 400', async () => {
    eq((await gql(base, undefined)).status, 400);
  });
  await check('Syntax error -> 400 GRAPHQL_PARSE_FAILED', async () => {
    const r = await gql(base, '{ serviceTypes { code ');
    eq([r.status, r.code], [400, 'GRAPHQL_PARSE_FAILED']);
  });
  await check('Over 1000 tokens -> 400 GRAPHQL_PARSE_FAILED', async () => {
    const r = await gql(base, `{ ${'serviceTypes { code } '.repeat(300)} }`);
    eq([r.status, r.code], [400, 'GRAPHQL_PARSE_FAILED']);
  });
  await check('Unknown field -> 400 GRAPHQL_VALIDATION_FAILED, with a suggestion in dev', async () => {
    const r = await gql(base, '{ serviceTypess { code } }');
    eq([r.status, r.code], [400, 'GRAPHQL_VALIDATION_FAILED']);
    ok(r.error?.message.includes('Did you mean'), 'no dev suggestion');
  });
  await check('passwordHash is not queryable', async () => {
    eq((await gql(base, '{ users { passwordHash } }', {}, { token: admin })).code, 'GRAPHQL_VALIDATION_FAILED');
  });
  await check('Missing required argument -> 400 GRAPHQL_VALIDATION_FAILED', async () => {
    const r = await gql(base, 'mutation { register(name: "x", email: "x", mobile: "x", postcode: "x") { id } }');
    eq([r.status, r.code], [400, 'GRAPHQL_VALIDATION_FAILED']);
  });
  await check('Invalid enum literal -> GRAPHQL_VALIDATION_FAILED', async () => {
    eq((await gql(base, '{ leads(sort: RANDOM) { total } }', {}, { token: admin })).code, 'GRAPHQL_VALIDATION_FAILED');
  });
  for (const [label, run] of [
    ['wrong variable type (limit: "abc")', () => gql(base, LEADS, { limit: 'abc' }, { token: admin })],
    ['null for a required variable (email: null)', () => gql(base, REGISTER, { ...valid('nullvar'), email: null })],
    ['Int overflow (limit: 2^31)', () => gql(base, LEADS, { limit: 2 ** 31 }, { token: admin })],
  ] as const) {
    await check(`${label} -> 400 BAD_USER_INPUT without fields (client bug)`, async () => {
      const r = await run();
      eq([r.status, r.code, r.fields], [400, 'BAD_USER_INPUT', undefined]);
    });
  }
  await check('Introspection works outside production', async () => {
    ok((await gql(base, '{ __schema { queryType { name } } }')).data?.__schema, 'no __schema');
  });

  group('Response headers & CORS');
  await check('Security headers set, X-Powered-By absent, no CSP in dev', async () => {
    const h = (await fetch(`${base}/`)).headers;
    eq([h.get('x-content-type-options'), h.get('x-powered-by'), h.get('content-security-policy')], ['nosniff', null, null]);
    ok(h.get('strict-transport-security'), 'no HSTS');
  });
  const preflight = (origin: string) =>
    fetch(`${base}/graphql`, {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization' },
    });
  await check('Preflight from WEB_ORIGIN allowed: GET/POST, Authorization, no credentials', async () => {
    const h = (await preflight('http://localhost:3001')).headers;
    eq([h.get('access-control-allow-origin'), h.get('access-control-allow-methods'), h.get('access-control-allow-credentials')], ['http://localhost:3001', 'GET,POST', null]);
    ok(/authorization/i.test(h.get('access-control-allow-headers') ?? ''), 'Authorization not allowed');
  });
  await check('Another origin gets no CORS headers (preflight and POST)', async () => {
    eq((await preflight('https://evil.test')).headers.get('access-control-allow-origin'), null);
    eq((await gql(base, '{ serviceTypes { code } }', {}, { headers: { origin: 'https://evil.test' } })).headers.get('access-control-allow-origin'), null);
  });

  group('serviceTypes');
  await addServiceType(`${P}-retired`, false);
  await addServiceType(`${P}-new`, true);
  await check('Public; initial types in display order', async () => {
    const r = await gql(base, '{ serviceTypes { code label active } }');
    eq(r.data.serviceTypes.slice(0, 3), [
      { code: 'delivery', label: 'Delivery', active: true },
      { code: 'pick-up', label: 'Pick-up', active: true },
      { code: 'payment', label: 'Payment', active: true },
    ]);
  });
  await check('Retired types hidden; a type added in SQL appears at once', async () => {
    const codes = ((await gql(base, '{ serviceTypes { code } }')).data.serviceTypes as { code: string }[]).map((t) => t.code);
    ok(!codes.includes(`${P}-retired`) && codes.includes(`${P}-new`), JSON.stringify(codes));
  });

  group('register: happy paths & normalisation');
  let happy: Omit<RegisterVars, 'services'> & { id: string; services: { code: string }[] } = undefined!;
  await check('Anonymous register returns the lead with a UUID v7 id and its services', async () => {
    const r = await register(valid('happy', { services: ['payment', 'delivery'] }));
    ok(!r.error, r.error?.message ?? '');
    happy = r.data.register;
    ok(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(happy.id), `not v7: ${happy.id}`);
    eq(happy.services.map((s) => s.code), ['delivery', 'payment']);
  });
  await check('Trims name and postcode, lowercases email, normalises +61 mobile', async () => {
    const r = (await register({ name: '  Ada  Lovelace ', email: `  ${mail('Norm').toUpperCase()} `, mobile: '+61 412 345 678', postcode: ' 2000 ', services: [' delivery '] })).data.register;
    eq([r.name, r.email, r.mobile, r.postcode], ['Ada  Lovelace', mail('norm'), '0412345678', '2000']);
  });
  for (const [i, mobile] of ['(04) 1234 5678', '0412-345-678', '61412345678'].entries()) {
    await check(`Mobile ${mobile} -> 0412345678`, async () => {
      const r = await register(valid(`mobile-${i}`, { mobile }));
      eq(r.data?.register.mobile, '0412345678', r.error?.message);
    });
  }
  for (const [label, over, field, expected] of [
    ['Postcode 0800 keeps its leading zero', { postcode: '0800' }, 'postcode', '0800'],
    ['Unicode name kept', { name: 'Zoë 李' }, 'name', 'Zoë 李'],
    ['SQL-looking name stored as text', { name: "Robert'); DROP TABLE leads;--" }, 'name', "Robert'); DROP TABLE leads;--"],
    ['70-char name accepted', { name: 'x'.repeat(70) }, 'name', 'x'.repeat(70)],
  ] as const) {
    await check(label, async () => {
      eq((await register(valid(label.replace(/\W/g, ''), over))).data?.register[field], expected);
    });
  }
  await check('Duplicate service codes merged', async () => {
    eq((await register(valid('dupsvc', { services: ['delivery', 'delivery', ' delivery'] }))).data?.register.services.map((s: { code: string }) => s.code), ['delivery']);
  });
  await check('A service type added as a row is accepted', async () => {
    eq((await register(valid('newtype', { services: [`${P}-new`] }))).data?.register.services[0].code, `${P}-new`);
  });
  await check('Register with a token still works (public operation)', async () => {
    ok(!(await gql(base, REGISTER, valid('withtoken'), { token: user })).error, 'failed');
  });

  group('register: duplicates');
  await check('Same email in another case -> CONFLICT, original unchanged', async () => {
    const r = await register(valid('impostor', { email: mail('HAPPY'), name: 'Impostor', services: ['pick-up'] }));
    eq([r.code, r.error?.message], ['CONFLICT', 'Email is already registered']);
    eq(await scalar('select name from leads where email = :e', { e: mail('happy') }), 'Lead happy');
    eq(await scalar('select count(*) from lead_service_types where "leadId" = :id', { id: happy.id }), '2');
  });
  await check('5 concurrent registrations with one email -> 1 lead, 4 CONFLICT', async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => register(valid('race', { name: `Racer ${i}` }))));
    eq([rs.filter((r) => r.data?.register).length, rs.filter((r) => r.code === 'CONFLICT').length], [1, 4]);
    eq(await countLeads(mail('race')), '1');
  });

  group('register: validation (BAD_USER_INPUT + extensions.fields)');
  const invalid: [string, Partial<RegisterVars>, keyof RegisterVars][] = [
    ['blank name', { name: '   ' }, 'name'],
    ['71-char name', { name: 'x'.repeat(71) }, 'name'],
    ['empty email', { email: '' }, 'email'],
    ['email without @', { email: 'no-at.test.dev' }, 'email'],
    ['email without a domain dot', { email: 'a@b' }, 'email'],
    ['email over 255 chars', { email: `${'a'.repeat(250)}@test.dev` }, 'email'],
    ['landline number', { mobile: '0212345678' }, 'mobile'],
    ['9-digit mobile', { mobile: '041234567' }, 'mobile'],
    ['mobile with letters', { mobile: '04123abc78' }, 'mobile'],
    ['3-digit postcode', { postcode: '200' }, 'postcode'],
    ['5-digit postcode', { postcode: '20000' }, 'postcode'],
    ['postcode with letters', { postcode: 'ABCD' }, 'postcode'],
    ['no services', { services: [] }, 'services'],
    ['blank service code', { services: [''] }, 'services'],
    ['21 services', { services: Array.from({ length: 21 }, (_, i) => `s${i}`) }, 'services'],
    ['unknown service', { services: ['teleport'] }, 'services'],
    ['retired service', { services: [`${P}-retired`] }, 'services'],
    ['valid plus unknown service', { services: ['delivery', 'teleport'] }, 'services'],
  ];
  for (const [label, over, field] of invalid) {
    await check(`${label} -> fields.${field}, nothing stored`, async () => {
      const email = over.email ?? mail(`inv-${label.replace(/\W/g, '')}`);
      const r = await register(valid('x', { ...over, email }));
      eq(r.code, 'BAD_USER_INPUT');
      ok(r.fields?.[field], `fields: ${JSON.stringify(r.fields)}`);
      if (over.email === undefined) eq(await countLeads(email), '0');
    });
  }
  await check('Every invalid field reported at once', async () => {
    eq(Object.keys((await register({ name: '', email: 'x', mobile: '1', postcode: '1', services: [] })).fields ?? {}).sort(), ['email', 'mobile', 'name', 'postcode', 'services']);
  });
  await check('Unknown-service message names the codes', async () => {
    eq((await register(valid('msg', { services: ['teleport', 'warp'] }))).fields?.services, 'Unknown or unavailable service: teleport, warp');
  });

  group('login & tokens');
  await check('Login is case-insensitive on email and returns the user', async () => {
    const r = await gql(base, LOGIN, { e: 'ADMIN@Brighte.dev', p: env.SEED_ADMIN_PASSWORD });
    ok(r.data?.login.accessToken, 'no token');
    eq(r.data.login.user.role, 'ADMIN');
  });
  await check('Wrong password and unknown email give the same UNAUTHENTICATED message', async () => {
    const a = await gql(base, LOGIN, { e: 'admin@brighte.dev', p: 'wrong-password' });
    const b = await gql(base, LOGIN, { e: mail('nobody'), p: 'wrong-password' });
    eq([a.code, b.code, a.error?.message], ['UNAUTHENTICATED', 'UNAUTHENTICATED', b.error?.message]);
  });
  const now = Math.floor(Date.now() / 1000);
  const adminId = Number(await scalar(`select id from users where email = 'admin@brighte.dev'`));
  const [head, payload, signature] = user.split('.');
  const tampered = `${head}.${b64({ ...(JSON.parse(Buffer.from(payload, 'base64url').toString()) as object), role: 'ADMIN' })}.${signature}`;
  for (const [label, token] of [
    ['no token', undefined],
    ['Basic scheme', `Basic ${admin}`],
    ['"Bearer" without a token', 'Bearer '],
    ['garbage token', 'Bearer not.a.jwt'],
    ['token signed with another secret', jwt({ sub: adminId, role: 'ADMIN', iat: now, exp: now + 900 }, { secret: 'x'.repeat(32) })],
    ['expired token', jwt({ sub: adminId, role: 'ADMIN', iat: now - 1000, exp: now - 60 })],
    ['alg "none" token', jwt({ sub: adminId, role: 'ADMIN', iat: now, exp: now + 900 }, { alg: 'none' })],
    ['USER token with role edited to ADMIN', tampered],
  ] as const) {
    await check(`${label} -> UNAUTHENTICATED`, async () => {
      const r = await gql(base, '{ users { id } }', {}, { token });
      eq([r.code, r.data ?? null], ['UNAUTHENTICATED', null]);
    });
  }

  group('me / users / createUser');
  await check('me as USER and ADMIN', async () => {
    eq([(await gql(base, ME, {}, { token: user })).data.me.role, (await gql(base, ME, {}, { token: admin })).data.me.role], ['USER', 'ADMIN']);
  });
  await check('users: ADMIN ok, USER FORBIDDEN, anonymous UNAUTHENTICATED', async () => {
    ok((await gql(base, '{ users { email } }', {}, { token: admin })).data.users.length >= 2, 'no users');
    eq((await gql(base, '{ users { email } }', {}, { token: user })).code, 'FORBIDDEN');
    eq((await gql(base, '{ users { email } }')).code, 'UNAUTHENTICATED');
  });
  let createdId = '';
  await check('createUser: defaults to USER, lowercases email, ADMIN when asked', async () => {
    const a = await gql(base, CREATE_USER, { input: { email: mail('New').toUpperCase(), name: 'New', password: 'new-password' } }, { token: admin });
    eq([a.data?.createUser.email, a.data?.createUser.role], [mail('new'), 'USER']);
    createdId = a.data.createUser.id as string;
    eq((await gql(base, CREATE_USER, { input: { email: mail('boss'), name: 'Boss', password: 'boss-password', role: 'ADMIN' } }, { token: admin })).data?.createUser.role, 'ADMIN');
  });
  await check('createUser: duplicate -> CONFLICT, short password -> BAD_USER_INPUT', async () => {
    eq((await gql(base, CREATE_USER, { input: { email: mail('NEW'), name: 'Dup', password: 'dup-password' } }, { token: admin })).code, 'CONFLICT');
    eq((await gql(base, CREATE_USER, { input: { email: mail('short'), name: 'S', password: '1234567' } }, { token: admin })).code, 'BAD_USER_INPUT');
  });
  await check('createUser: USER -> FORBIDDEN, anonymous -> UNAUTHENTICATED, nothing created', async () => {
    eq((await gql(base, CREATE_USER, { input: { email: mail('byuser'), name: 'U', password: 'user-password' } }, { token: user })).code, 'FORBIDDEN');
    eq((await gql(base, CREATE_USER, { input: { email: mail('byanon'), name: 'A', password: 'anon-password' } })).code, 'UNAUTHENTICATED');
    eq(await scalar('select count(*) from users where email in (:a, :b)', { a: mail('byuser'), b: mail('byanon') }), '0');
  });
  await check("A deleted user's token -> UNAUTHENTICATED", async () => {
    const t = (await gql(base, LOGIN, { e: mail('new'), p: 'new-password' })).data.login.accessToken as string;
    await exec('delete from users where id = :id', { id: Number(createdId) });
    eq((await gql(base, ME, {}, { token: t })).code, 'UNAUTHENTICATED');
  });

  group('leads');
  const T = `${P}-list`;
  await addServiceType(T, true);
  const ids: string[] = [];
  for (const n of ['carol', 'alice', 'bob']) ids.push((await register(valid(`l-${n}`, { name: n, services: [T, 'pick-up'] }))).data.register.id as string);
  const list = (vars: object, token: string | undefined = admin) => gql(base, LEADS, vars, { token });
  const items = async (vars: object) => (await list(vars)).data.leads.items as { id: string; name: string; services: { code: string }[] }[];

  await check('Anonymous -> UNAUTHENTICATED, USER -> FORBIDDEN', async () => {
    eq([(await list({}, '')).code, (await list({}, user)).code], ['UNAUTHENTICATED', 'FORBIDDEN']);
  });
  await check('Defaults: limit 20, offset 0, newest first', async () => {
    const r = (await list({})).data.leads;
    eq([r.limit, r.offset, r.items[0].id], [20, 0, ids[2]]);
  });
  await check('Filter by type: total 3, stable non-overlapping pages', async () => {
    const p1 = (await list({ serviceType: T, limit: 2 })).data.leads;
    const p2 = (await list({ serviceType: T, limit: 2, offset: 2 })).data.leads;
    eq([p1.total, p2.total], [3, 3]);
    eq([...p1.items, ...p2.items].map((l: { id: string }) => l.id), [ids[2], ids[1], ids[0]]);
  });
  await check('Blank serviceType ("" or spaces) means no filter', async () => {
    const all = (await list({})).data.leads.total;
    eq([(await list({ serviceType: '' })).data?.leads.total, (await list({ serviceType: '  ' })).data?.leads.total], [all, all]);
  });
  await check('Offset past the end -> empty items, total kept; huge offset ok', async () => {
    const r = (await list({ serviceType: T, offset: 50 })).data.leads;
    eq([r.total, r.items.length], [3, 0]);
    eq((await list({ serviceType: T, offset: 2_000_000_000 })).data?.leads.items.length, 0);
  });
  await check('OLDEST_FIRST and NAME_ASC', async () => {
    eq((await items({ serviceType: T, sort: 'OLDEST_FIRST' })).map((l) => l.id), ids);
    eq((await items({ serviceType: T, sort: 'NAME_ASC' })).map((l) => l.name), ['alice', 'bob', 'carol']);
  });
  await check('Filtered leads return all their services', async () => {
    ok((await items({ serviceType: T })).every((l) => l.services.map((s) => s.code).sort().join() === ['pick-up', T].sort().join()), 'services cut by filter');
  });
  await check('Unknown serviceType -> empty page', async () => {
    eq((await list({ serviceType: 'teleport' })).data.leads, { total: 0, limit: 20, offset: 0, items: [] });
  });
  await check('A retired type still filters', async () => {
    await exec('update service_types set active = false where code = :code', { code: T });
    eq((await list({ serviceType: T })).data.leads.total, 3);
  });
  for (const [label, vars, field] of [
    ['limit 0', { limit: 0 }, 'limit'],
    ['limit 101', { limit: 101 }, 'limit'],
    ['limit -1', { limit: -1 }, 'limit'],
    ['offset -1', { offset: -1 }, 'offset'],
  ] as const) {
    await check(`${label} -> BAD_USER_INPUT fields.${field}`, async () => {
      const r = await list(vars);
      eq(r.code, 'BAD_USER_INPUT');
      ok(r.fields?.[field], JSON.stringify(r.fields));
    });
  }
  await check('limit 100 accepted', async () => {
    ok(!(await list({ limit: 100 })).error, 'rejected');
  });

  group('lead');
  await check('ADMIN gets the lead with its services', async () => {
    const r = await gql(base, LEAD, { id: happy.id }, { token: admin });
    eq(r.data.lead, { id: happy.id, name: happy.name, email: happy.email, mobile: happy.mobile, postcode: happy.postcode, services: happy.services.map((s) => ({ code: s.code })) });
  });
  await check('Unknown v7 and v4 ids -> null, no error', async () => {
    for (const id of ['01a0d358-0000-7000-8000-000000000000', '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b']) {
      const r = await gql(base, LEAD, { id }, { token: admin });
      eq([r.error, r.data?.lead], [undefined, null]);
    }
  });
  for (const id of ['42', '', 'not-a-uuid', "01a0d358'; drop table leads;--"]) {
    await check(`Malformed id ${JSON.stringify(id)} -> BAD_USER_INPUT fields.id`, async () => {
      const r = await gql(base, LEAD, { id }, { token: admin });
      eq(r.code, 'BAD_USER_INPUT');
      ok(r.fields?.id, JSON.stringify(r.fields));
    });
  }
  await check('Anonymous -> UNAUTHENTICATED, USER -> FORBIDDEN', async () => {
    eq([(await gql(base, LEAD, { id: happy.id })).code, (await gql(base, LEAD, { id: happy.id }, { token: user })).code], ['UNAUTHENTICATED', 'FORBIDDEN']);
  });
  await check('Client errors carry path; dev includes a stacktrace', async () => {
    const r = await register(valid('shape', { email: 'bad' }));
    eq(r.error?.path, ['register']);
    ok(Array.isArray(r.error?.extensions?.stacktrace), 'no dev stacktrace');
  });
}

// =====================================================================
async function rateLimits(base: string) {
  group('Rate limits (defaults: register 5, login 10, others 120 per minute)');
  await check('6 aliased registers in one request -> 5 saved, 6th TOO_MANY_REQUESTS', async () => {
    const r = await gql(base, `mutation { ${['a', 'b', 'c', 'd', 'e', 'f'].map((a) => registerDoc(a, mail(`rl-${a}`))).join(' ')} }`);
    eq([r.error?.path, r.code], [['f'], 'TOO_MANY_REQUESTS']);
    ok((r.error?.extensions?.retryAfter ?? 0) > 0, 'no retryAfter');
    eq(await scalar('select count(*) from leads where email like :p', { p: `${P}-rl-%` }), '5');
  });
  await check('Next register -> TOO_MANY_REQUESTS with Retry-After', async () => {
    const r = await gql(base, REGISTER, valid('rl-next'));
    eq(r.code, 'TOO_MANY_REQUESTS');
    ok(Number(r.headers.get('retry-after')) > 0, 'no Retry-After');
  });
  await check('A spoofed X-Forwarded-For does not reset the limit', async () => {
    eq((await gql(base, REGISTER, valid('rl-xff'), { headers: { 'x-forwarded-for': '203.0.113.9' } })).code, 'TOO_MANY_REQUESTS');
  });
  await check('11 bad logins -> 10 UNAUTHENTICATED, then TOO_MANY_REQUESTS', async () => {
    const codes: (string | undefined)[] = [];
    for (let i = 0; i < 11; i++) codes.push((await gql(base, LOGIN, { e: mail('nobody'), p: 'wrong-password' })).code);
    eq(codes, [...Array<string>(10).fill('UNAUTHENTICATED'), 'TOO_MANY_REQUESTS']);
  });
  await check('Other operations keep their own counters', async () => {
    ok((await gql(base, '{ serviceTypes { code } }')).data?.serviceTypes, 'serviceTypes blocked');
  });
  await check('Default limit: 120/min with X-RateLimit headers, then Retry-After', async () => {
    const rs: GqlResult[] = [];
    for (let i = 0; i < 125; i++) rs.push(await gql(base, '{ serviceTypes { code } }'));
    eq(rs.findIndex((r) => r.code === 'TOO_MANY_REQUESTS'), 119, 'first blocked (1 call already made)');
    eq([rs[0].headers.get('x-ratelimit-limit'), rs[0].headers.get('x-ratelimit-remaining')], ['120', '118']);
    ok(Number(rs[124].headers.get('retry-after')) > 0, 'no Retry-After');
  });
}

async function production(base: string) {
  group('Production mode');
  await check('Introspection disabled', async () => {
    eq((await gql(base, '{ __schema { queryType { name } } }')).code, 'GRAPHQL_VALIDATION_FAILED');
  });
  await check('No "Did you mean" suggestions on typos', async () => {
    const r = await gql(base, '{ serviceTypess { code } }');
    eq(r.code, 'GRAPHQL_VALIDATION_FAILED');
    ok(!r.error?.message.includes('Did you mean'), r.error?.message ?? '');
  });
  await check('No GraphiQL page', async () => {
    ok(!(await (await fetch(`${base}/graphql`, { headers: { accept: 'text/html' } })).text()).toLowerCase().includes('graphiql'), 'GraphiQL served');
  });
  await check('Content-Security-Policy header present', async () => {
    ok((await fetch(`${base}/`)).headers.get('content-security-policy'), 'no CSP');
  });
  await check('No stacktrace in errors', async () => {
    const r = await gql(base, REGISTER, valid('prod', { email: 'bad' }));
    eq([r.code, r.error?.extensions?.stacktrace], ['BAD_USER_INPUT', undefined]);
  });
  await check('CORS allows only the production WEB_ORIGIN', async () => {
    const pre = (origin: string) => fetch(`${base}/graphql`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } });
    eq([(await pre('https://app.brighte.test')).headers.get('access-control-allow-origin'), (await pre('http://localhost:3001')).headers.get('access-control-allow-origin')], ['https://app.brighte.test', null]);
  });
}

async function startupChecks(port: number) {
  group('Startup');
  await check('Production without WEB_ORIGIN refuses to start', async () => {
    const { child, output } = spawnApi(port, { NODE_ENV: 'production', WEB_ORIGIN: '' });
    const code = await new Promise<number | null>((r) => child.on('exit', r));
    ok(code !== 0, `exit code ${code}`);
    ok(output().includes('WEB_ORIGIN must be set in production'), output().slice(0, 300));
  });
}

// =====================================================================
const high = { RATE_LIMIT_PER_MINUTE: '100000', RATE_LIMIT_LOGIN_PER_MINUTE: '100000', RATE_LIMIT_REGISTER_PER_MINUTE: '100000' };
const realLimits = { RATE_LIMIT_PER_MINUTE: '', RATE_LIMIT_LOGIN_PER_MINUTE: '', RATE_LIMIT_REGISTER_PER_MINUTE: '' };
const ports = [0, 1, 2, 3].map((i) => BASE_PORT + i);
for (const port of ports) {
  if (!(await portFree(port))) throw new Error(`Port ${port} is in use; set SMOKE_PORT to another base port.`);
}
try {
  await functional(await startServer(ports[0], { ...high, NODE_ENV: 'development', WEB_ORIGIN: 'http://localhost:3001' }));
  await rateLimits(await startServer(ports[1], { ...realLimits, NODE_ENV: 'development', WEB_ORIGIN: 'http://localhost:3001' }));
  await production(await startServer(ports[2], { ...high, NODE_ENV: 'production', WEB_ORIGIN: 'https://app.brighte.test' }));
  await startupChecks(ports[3]);
} finally {
  for (const p of procs) if (p.exitCode === null) p.kill();
  await exec('delete from leads where email like :p', { p: `${P}-%` });
  await exec('delete from users where email like :p', { p: `${P}-%` });
  await exec('delete from service_types where code like :p', { p: `${P}-%` });
  await db.close();
}

let current = '';
for (const r of results) {
  if (r.section !== current) console.log(`\n## ${(current = r.section)}`);
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n        ${r.err}`}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exitCode = failed ? 1 : 0;
