import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema } from 'graphql';
import { ERRORS } from './common/errors/error-codes.js';

const root = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

// Guards the hand-written parts of the API docs (spectaql.yml) against drift from the code.
describe('API docs', () => {
  it('error table in spectaql.yml lists every error code with its HTTP status', () => {
    const docs = read('spectaql.yml');
    for (const [code, { status }] of Object.entries(ERRORS)) {
      expect(docs, `${code} missing or wrong status`).toMatch(new RegExp(`\\| \`${code}\` \\| ${status} \\|`));
    }
  });

  it('every query and mutation documents its Auth level and Errors', () => {
    const schema = buildSchema(read('src/schema.gql'));
    const fields = [schema.getQueryType(), schema.getMutationType()].flatMap((type) =>
      Object.values(type?.getFields() ?? {}),
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.description, `${field.name} lacks **Auth:**`).toContain('**Auth:**');
      expect(field.description, `${field.name} lacks **Errors:**`).toContain('**Errors:**');
    }
  });
});
