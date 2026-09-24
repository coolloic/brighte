import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema } from 'graphql';

const root = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

const operations = () => {
  const schema = buildSchema(read('src/schema.gql'));
  return [schema.getQueryType(), schema.getMutationType()].flatMap((type) => Object.values(type?.getFields() ?? {}));
};

// Guards the API reference (schema descriptions + spectaql.yml) against drift from the code.
describe('API docs', () => {
  it('every query and mutation documents its Auth level and Errors', () => {
    const fields = operations();
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.description, `${field.name} lacks **Auth:**`).toMatch(/\*\*Auth:\*\* \S/);
      expect(field.description, `${field.name} lacks **Errors:**`).toMatch(/\*\*Errors:\*\* \S/);
    }
  });

  it('every error code an operation lists is explained in the spectaql.yml error table', () => {
    const table = read('spectaql.yml');
    for (const field of operations()) {
      const errorsLine = field.description!.split('**Errors:**')[1];
      const codes = errorsLine.match(/`([A-Z_]+)`/g) ?? [];
      expect(codes.length, `${field.name} lists no error codes`).toBeGreaterThan(0);
      for (const code of codes) {
        expect(table, `${field.name}: ${code} missing from the error table`).toContain(`| ${code} |`);
      }
    }
  });
});
