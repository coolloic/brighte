import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';

export const REQUEST_ID_HEADER = 'x-request-id';
// A caller's id (the web server's, a load balancer's trace id) is kept only if it looks like one,
// so a client can't write arbitrary text into the logs through it.
const VALID_REQUEST_ID = /^[\w-]{8,128}$/;

/**
 * The request's id: the caller's X-Request-Id if valid, a new UUID otherwise. Sent back in the
 * response's X-Request-Id and added to every log line written while handling the request.
 */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/**
 * nestjs-pino settings: one JSON object per line, readable by any log collector. Pretty-printed
 * instead when a developer runs the API in a terminal. LOG_LEVEL sets the level (default info;
 * silent under Vitest, where NODE_ENV is test).
 */
export function loggerParams(env: NodeJS.ProcessEnv = process.env): Params {
  const pretty = env.NODE_ENV !== 'production' && process.stdout.isTTY;
  return {
    pinoHttp: {
      level: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
      genReqId: requestId,
      // Lines logged during a request carry its id only, not the whole request.
      quietReqLogger: true,
      // GraphQL requests get one line per operation instead (operationLogPlugin): here every one
      // would read "POST /graphql 200". Health probes every few seconds would drown the rest.
      autoLogging: { ignore: (req) => /^\/(graphql|health)(\/|\?|$)/.test(req.url ?? '') },
      // No headers: they hold the bearer token, and add little.
      serializers: {
        req: ({ method, url }: { method: string; url: string }) => ({ method, url }),
        res: ({ statusCode }: { statusCode: number }) => ({ statusCode }),
      },
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      ...(pretty && { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
    },
  };
}
