import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/** HTTP-level hardening shared by main.ts and the e2e tests. */
export function configureApp(app: NestExpressApplication, env: NodeJS.ProcessEnv = process.env): void {
  const production = env.NODE_ENV === 'production';

  // Comma-separated list of browser origins allowed to call the API.
  // Outside production, the local web app (WEB_PORT from the root .env) is allowed by default.
  const origins = (env.WEB_ORIGIN ?? (production ? '' : `http://localhost:${env.WEB_PORT ?? 3001}`))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (production && origins.length === 0) throw new Error('WEB_ORIGIN must be set in production');

  // Behind a load balancer, set TRUST_PROXY to the number of proxy hops (e.g. 1) so req.ip, and
  // with it rate limiting, is the client's address rather than the proxy's. Leave it unset
  // otherwise: trusting X-Forwarded-For from anyone lets a client choose its own IP.
  if (env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);

  // CSP is off outside production because dev GraphiQL loads its scripts from a CDN.
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Auth is a bearer token, not a cookie, so browsers never need to send credentials.
    credentials: false,
    maxAge: 600,
  });
}
