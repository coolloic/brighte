import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { v7 as uuidv7 } from 'uuid';
import { ForbiddenError } from '../common/index.js';
import { MyDataKind, type MyData, type MyDataDocumentSummary, type MyDataMatch } from './dto/my-data.js';
import { Embedder } from './embedder.js';
import { MyDataDocument } from './my-data-document.model.js';
import { myDataEnabled } from './my-data.config.js';
import type { SaveMyDataInput } from './my-data.schemas.js';

/** pgvector's text form: "[0.1,0.2,…]". Sent as a bind parameter and cast with ::vector. */
const vectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

const summary = (document: { id: string; kind: string; title: string; createdAt: Date }): MyDataDocumentSummary => ({
  id: document.id,
  kind: document.kind as MyDataKind,
  title: document.title,
  createdAt: new Date(document.createdAt),
});

type MatchRow = { text: string; score: number; id: string; kind: string; title: string; createdAt: Date };

@Injectable()
export class MyDataService {
  private readonly logger = new Logger(MyDataService.name);

  constructor(
    @InjectModel(MyDataDocument) private readonly documents: typeof MyDataDocument,
    @InjectConnection() private readonly sequelize: Sequelize,
    @Inject(Embedder) private readonly embedder: Embedder,
  ) {}

  private assertEnabled() {
    if (!myDataEnabled()) throw new ForbiddenError('My data is off: set MY_DATA=on to use it (local use only).');
  }

  /** Embeds the chunks, then stores the document and its chunks in one transaction. */
  async save({ email, kind, title, content, chunks }: SaveMyDataInput): Promise<MyDataDocumentSummary> {
    this.assertEnabled();
    // Before the transaction: the model can take seconds, and a transaction shouldn't hold a connection that long.
    const vectors = await this.embedder.embed(chunks);
    const document = await this.sequelize.transaction(async (transaction) => {
      const created = await this.documents.create({ email, kind, title, content: JSON.parse(content) as unknown }, { transaction });
      for (const [index, text] of chunks.entries()) {
        await this.sequelize.query(
          'INSERT INTO my_data_chunks (id, "documentId", email, text, embedding, "createdAt") VALUES ($1, $2, $3, $4, $5::vector, now())',
          { bind: [uuidv7(), created.id, email, text, vectorLiteral(vectors[index])], transaction },
        );
      }
      return created;
    });
    this.logger.log({ event: 'my_data.saved', kind, chunks: chunks.length }, 'My data saved');
    return summary(document);
  }

  /** The newest profile and the other documents' summaries, or null when nothing is saved. */
  async get(email: string): Promise<MyData | null> {
    this.assertEnabled();
    const [profile, others] = await Promise.all([
      this.documents.findOne({ where: { email, kind: MyDataKind.PROFILE }, order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
      this.documents.findAll({
        where: { email, kind: [MyDataKind.TAILORED_CV, MyDataKind.COVER_LETTER] },
        attributes: ['id', 'kind', 'title', 'createdAt'],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      }),
    ]);
    if (!profile && others.length === 0) return null;
    return { profile: profile ? JSON.stringify(profile.content) : null, documents: others.map(summary) };
  }

  /**
   * The saved chunks closest to the query (cosine), from the newest profile and every tailored CV
   * and cover letter: older profile versions are left out, so a corrected fact doesn't come back.
   */
  async search(email: string, query: string, limit: number): Promise<MyDataMatch[]> {
    this.assertEnabled();
    const [vector] = await this.embedder.embed([query]);
    const rows = await this.sequelize.query<MatchRow>(
      `SELECT c.text, 1 - (c.embedding <=> $1::vector) AS score, d.id, d.kind, d.title, d."createdAt"
         FROM my_data_chunks c
         JOIN my_data_documents d ON d.id = c."documentId"
        WHERE c.email = $2
          AND (d.kind <> 'profile' OR d.id = (
                SELECT id FROM my_data_documents
                 WHERE email = $2 AND kind = 'profile'
                 ORDER BY "createdAt" DESC, id DESC LIMIT 1))
        ORDER BY c.embedding <=> $1::vector
        LIMIT $3`,
      { bind: [vectorLiteral(vector), email, limit], type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({ text: row.text, score: Number(row.score), document: summary(row) }));
  }

  /** Deletes every document (and, by cascade, chunk) saved for the email. Returns how many documents went. */
  async delete(email: string): Promise<number> {
    this.assertEnabled();
    return this.documents.destroy({ where: { email } });
  }
}
