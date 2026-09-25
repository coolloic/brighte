import { Logger } from '@nestjs/common';
import { parse, type OperationDefinitionNode } from 'graphql';
import { operationLogPlugin } from './operation-log.plugin.js';

/** Runs the plugin over one request, as Apollo would, and returns what it logged. */
async function logFor(query: string, { errors, user }: { errors?: { extensions?: { code?: unknown } }[]; user?: object } = {}) {
  const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const operation = parse(query).definitions[0] as OperationDefinitionNode;
  const requestContext = {
    operationName: operation.name?.value ?? null,
    operation,
    request: { variables: { password: 'hunter2-secret' } },
    response: { body: { kind: 'single', singleResult: { errors } } },
    contextValue: { req: { ip: '203.0.113.7', user } },
  };
  const listener = await operationLogPlugin.requestDidStart!(requestContext as never);
  await listener!.willSendResponse!(requestContext as never);
  return { info: info.mock.calls, warn: warn.mock.calls };
}

describe('operationLogPlugin', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a successful operation at info, with its caller', async () => {
    const { info, warn } = await logFor('query Leads { leads(limit: 1, offset: 0) { total } serviceTypes { code } }', {
      user: { id: 7, role: 'ADMIN' },
    });
    expect(warn).toEqual([]);
    expect(info).toEqual([
      [
        expect.objectContaining({
          msg: 'GraphQL operation',
          operation: 'Leads',
          type: 'query',
          fields: ['leads', 'serviceTypes'],
          userId: 7,
          role: 'ADMIN',
          ip: '203.0.113.7',
          durationMs: expect.any(Number) as number,
        }),
      ],
    ]);
  });

  it('logs a failed operation at warn, with each error code once', async () => {
    const { info, warn } = await logFor('mutation { a: register { id } b: register { id } }', {
      errors: [{ extensions: { code: 'TOO_MANY_REQUESTS' } }, { extensions: { code: 'TOO_MANY_REQUESTS' } }, {}],
    });
    expect(info).toEqual([]);
    expect(warn[0][0]).toMatchObject({ msg: 'GraphQL operation failed', type: 'mutation', errors: ['TOO_MANY_REQUESTS', 'UNKNOWN'] });
  });

  it('never logs variables', async () => {
    const { info } = await logFor('mutation Login { login { accessToken } }');
    expect(JSON.stringify(info)).not.toContain('hunter2-secret');
  });
});
