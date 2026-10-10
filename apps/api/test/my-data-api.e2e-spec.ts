import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { MyDataDocument } from './../src/my-data/index.js';

// Runs with MY_DATA=on and the fake embedder (vitest.config.e2e.ts): texts sharing words are close.
const PREFIX = `e2e-mydata-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;

type GqlError = { message: string; extensions?: { code?: string; fields?: Record<string, string> } };
type GqlResponse<T> = { data?: T | null; errors?: GqlError[] };
type Summary = { id: string; kind: string; title: string; createdAt: string };
type Match = { text: string; score: number; document: Summary };

const SAVE = `mutation($email: String!, $kind: MyDataKind!, $title: String!, $content: String!, $chunks: [String!]!) {
  saveMyData(email: $email, kind: $kind, title: $title, content: $content, chunks: $chunks) { id kind title createdAt }
}`;
const GET = `query($email: String!) { myData(email: $email) { profile documents { id kind title } } }`;
const SEARCH = `query($email: String!, $query: String!, $limit: Int) {
  searchMyData(email: $email, query: $query, limit: $limit) { text score document { kind title } }
}`;
const DELETE = `mutation($email: String!) { deleteMyData(email: $email) }`;

describe('My data API (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let documents: typeof MyDataDocument;

  const gql = async <T>(query: string, variables?: Record<string, unknown>) =>
    (await request(app.getHttpServer()).post('/graphql').send({ query, variables })).body as GqlResponse<T>;

  const save = (owner: string, kind: string, title: string, content: object, chunks: string[]) =>
    gql<{ saveMyData: Summary }>(SAVE, { email: owner, kind, title, content: JSON.stringify(content), chunks });
  const search = (owner: string, query: string, limit?: number) => gql<{ searchMyData: Match[] }>(SEARCH, { email: owner, query, limit });
  const chunkCount = async (owner: string) =>
    Number((await sequelize.query<{ count: string }>('SELECT count(*) FROM my_data_chunks WHERE email = $1', { bind: [owner], type: QueryTypes.SELECT }))[0].count);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    sequelize = moduleRef.get<Sequelize>(getConnectionToken());
    documents = moduleRef.get<typeof MyDataDocument>(getModelToken(MyDataDocument));
  });

  afterAll(async () => {
    await documents.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  it('saves a profile without a token, keyed by the lowercased email, and returns it', async () => {
    const owner = email('save');
    const res = await save(owner.toUpperCase(), 'PROFILE', 'Jane Citizen', { basics: { name: 'Jane Citizen' } }, ['Jane Citizen, Front-end Engineer']);
    expect(res.errors).toBeUndefined();
    expect(res.data!.saveMyData).toMatchObject({ kind: 'PROFILE', title: 'Jane Citizen' });

    const got = await gql<{ myData: { profile: string; documents: Summary[] } }>(GET, { email: owner });
    expect(JSON.parse(got.data!.myData.profile)).toEqual({ basics: { name: 'Jane Citizen' } });
    expect(got.data!.myData.documents).toEqual([]);
    expect(await chunkCount(owner)).toBe(1);
  });

  it('returns null for an email with nothing saved', async () => {
    const res = await gql<{ myData: null }>(GET, { email: email('nobody') });
    expect(res.errors).toBeUndefined();
    expect(res.data!.myData).toBeNull();
  });

  it('keeps every profile version, returns the newest, and searches only the newest', async () => {
    const owner = email('versions');
    await save(owner, 'PROFILE', 'Jane v1', { v: 1 }, ['Globex role ended in 2021']);
    await save(owner, 'PROFILE', 'Jane v2', { v: 2 }, ['Globex role ended in 2020']);
    const got = await gql<{ myData: { profile: string } }>(GET, { email: owner });
    expect(JSON.parse(got.data!.myData.profile)).toEqual({ v: 2 });
    expect(await documents.count({ where: { email: owner } })).toBe(2);

    const matches = (await search(owner, 'Globex role ended')).data!.searchMyData;
    expect(matches.map((match) => match.text)).toEqual(['Globex role ended in 2020']);
  });

  it('finds the closest chunks first, across profiles, tailored CVs and cover letters', async () => {
    const owner = email('search');
    await save(owner, 'PROFILE', 'Jane Citizen', { basics: {} }, ['Mentored two graduate engineers', 'Led the React rebuild of the loan portal']);
    await save(owner, 'COVER_LETTER', 'Senior Engineer · Brightpath', { greeting: 'Hi' }, ['I ran the accessibility audit and added automated accessibility checks to CI']);
    await save(owner, 'TAILORED_CV', 'Engineer · Acme', { job: {} }, ['Built a design system in React']);

    const matches = (await search(owner, 'accessibility audit checks', 2)).data!.searchMyData;
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ text: 'I ran the accessibility audit and added automated accessibility checks to CI', document: { kind: 'COVER_LETTER', title: 'Senior Engineer · Brightpath' } });
    expect(matches[0].score).toBeGreaterThan(matches[1].score);

    const list = (await gql<{ myData: { documents: Summary[] } }>(GET, { email: owner })).data!.myData.documents;
    expect(list.map((document) => document.kind)).toEqual(['TAILORED_CV', 'COVER_LETTER']);
  });

  it("never returns another email's chunks", async () => {
    await save(email('alice'), 'PROFILE', 'Alice', {}, ['Kubernetes platform engineering']);
    await save(email('bob'), 'PROFILE', 'Bob', {}, ['Kubernetes platform engineering at scale']);
    const matches = (await search(email('alice'), 'Kubernetes platform')).data!.searchMyData;
    expect(matches.map((match) => match.text)).toEqual(['Kubernetes platform engineering']);
  });

  it('deletes everything saved for an email, chunks included', async () => {
    const owner = email('delete');
    await save(owner, 'PROFILE', 'Jane', {}, ['one', 'two']);
    await save(owner, 'COVER_LETTER', 'Letter', {}, ['three']);
    const res = await gql<{ deleteMyData: number }>(DELETE, { email: owner });
    expect(res.data!.deleteMyData).toBe(2);
    expect(await chunkCount(owner)).toBe(0);
    expect((await gql<{ deleteMyData: number }>(DELETE, { email: owner })).data!.deleteMyData).toBe(0);
  });

  it.each([
    ['an invalid email', { email: 'jane' }, 'email'],
    ['content that is not a JSON object', { content: '"text"' }, 'content'],
    ['no chunks', { chunks: [] }, 'chunks'],
  ])('rejects saving %s with BAD_USER_INPUT, storing nothing', async (_, override, field) => {
    const owner = email('invalid');
    const res = await gql(SAVE, { email: owner, kind: 'PROFILE', title: 'Jane', content: '{}', chunks: ['text'], ...override });
    expect(res.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
    expect(res.errors?.[0].extensions?.fields?.[field]).toBeTruthy();
    expect(await documents.count({ where: { email: owner } })).toBe(0);
  });

  it('refuses every operation with FORBIDDEN while MY_DATA is off', async () => {
    process.env.MY_DATA = 'off';
    try {
      const owner = email('off');
      const results = await Promise.all([
        save(owner, 'PROFILE', 'Jane', {}, ['text']),
        gql(GET, { email: owner }),
        search(owner, 'text'),
        gql(DELETE, { email: owner }),
      ]);
      for (const res of results) expect(res.errors?.[0].extensions?.code).toBe('FORBIDDEN');
      expect(await documents.count({ where: { email: owner } })).toBe(0);
    } finally {
      process.env.MY_DATA = 'on';
    }
  });
});
