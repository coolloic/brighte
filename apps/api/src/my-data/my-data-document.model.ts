import { Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { v7 as uuidv7 } from 'uuid';

/** Something a chat visitor saved: a profile version, a tailored CV or a cover letter. Its chunks (with embeddings) are in my_data_chunks. */
@Table({ tableName: 'my_data_documents', updatedAt: false })
export class MyDataDocument extends Model {
  @PrimaryKey
  @Default(() => uuidv7())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  /** Lowercase. */
  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  /** `profile`, `tailored_cv` or `cover_letter`. */
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare kind: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare title: string;

  /** The block's JSON as the chat showed it. */
  @Column({ type: DataType.JSONB, allowNull: false })
  declare content: unknown;

  declare createdAt: Date;
}
