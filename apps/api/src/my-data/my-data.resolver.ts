import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/index.js';
import { validate } from '../common/index.js';
import { MyData, MyDataDocumentSummary, MyDataKind, MyDataMatch } from './dto/my-data.js';
import { emailSchema, MAX_CHUNK_LENGTH, MAX_CHUNKS, MAX_MATCHES, MAX_QUERY_LENGTH, saveMyDataSchema, searchMyDataSchema } from './my-data.schemas.js';
import { MyDataService } from './my-data.service.js';

// Public, because the chat has no accounts: the email is the key. That's only safe on one person's
// own machine, so every operation refuses unless MY_DATA=on, which the API won't start with in
// production (see my-data.config.ts).
const AUTH = '**Auth:** Public, and only when the API runs with `MY_DATA=on` (local use only: refused in production).';
const OFF = '`FORBIDDEN` (MY_DATA is off)';

@Resolver()
export class MyDataResolver {
  constructor(private readonly myData: MyDataService) {}

  @Public()
  @Mutation(() => MyDataDocumentSummary, {
    description: [
      "Save a document from the chat for an email: a profile version, a tailored CV or a cover letter, with its text in chunks. Each chunk is embedded (a local model) for `searchMyData`. Every profile saved is kept; the newest is the email's profile.",
      AUTH,
      `**Errors:** ${OFF}, \`BAD_USER_INPUT\` (invalid email, title empty or over 200 characters, content not a JSON object or over 64 KB, or not 1 to ${MAX_CHUNKS} chunks of up to ${MAX_CHUNK_LENGTH} characters; \`extensions.fields\` names each), \`TOO_MANY_REQUESTS\`.`,
    ].join('\n\n'),
  })
  saveMyData(
    @Args('email', { description: 'The key: stored lowercase.' }) email: string,
    @Args('kind', { type: () => MyDataKind }) kind: MyDataKind,
    @Args('title') title: string,
    @Args('content', { description: 'The document as a JSON object (the chat block).' }) content: string,
    @Args('chunks', { type: () => [String], description: 'The text to embed and search, in chunks.' }) chunks: string[],
  ): Promise<MyDataDocumentSummary> {
    return this.myData.save(validate(saveMyDataSchema, { email, kind, title, content, chunks }));
  }

  @Public()
  @Query(() => MyData, {
    name: 'myData',
    nullable: true,
    description: ['What is saved for an email: the newest profile, and a list of the saved tailored CVs and cover letters. Null when nothing is saved.', AUTH, `**Errors:** ${OFF}, \`BAD_USER_INPUT\` (invalid email), \`TOO_MANY_REQUESTS\`.`].join('\n\n'),
  })
  getMyData(@Args('email') email: string): Promise<MyData | null> {
    return this.myData.get(validate(emailSchema, { email }).email);
  }

  @Public()
  @Query(() => [MyDataMatch], {
    description: [
      "The saved chunks closest in meaning to `query`, most similar first, from the email's newest profile and all its tailored CVs and cover letters.",
      AUTH,
      `**Errors:** ${OFF}, \`BAD_USER_INPUT\` (invalid email, \`query\` empty or over ${MAX_QUERY_LENGTH} characters, \`limit\` outside 1–${MAX_MATCHES}), \`TOO_MANY_REQUESTS\`.`,
    ].join('\n\n'),
  })
  searchMyData(
    @Args('email') email: string,
    @Args('query') query: string,
    @Args('limit', { type: () => Int, defaultValue: 6 }) limit: number,
  ): Promise<MyDataMatch[]> {
    const input = validate(searchMyDataSchema, { email, query, limit });
    return this.myData.search(input.email, input.query, input.limit);
  }

  @Public()
  @Mutation(() => Int, {
    description: ['Delete everything saved for an email. Returns how many documents were deleted (0 when there were none).', AUTH, `**Errors:** ${OFF}, \`BAD_USER_INPUT\` (invalid email), \`TOO_MANY_REQUESTS\`.`].join('\n\n'),
  })
  deleteMyData(@Args('email') email: string): Promise<number> {
    return this.myData.delete(validate(emailSchema, { email }).email);
  }
}
