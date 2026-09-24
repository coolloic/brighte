import { BelongsToMany, Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { v7 as uuidv7 } from 'uuid';
import { LeadServiceType } from './lead-service-type.model.js';
import { ServiceType } from './service-type.model.js';

/** An expression of interest in Brighte Eats. */
@Table({ tableName: 'leads' })
export class Lead extends Model {
  /** UUID v7: time-ordered for index locality, not guessable. Postgres 17 has no uuidv7(), so it is generated here. */
  @PrimaryKey
  @Default(() => uuidv7())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  /** Stored lowercase; unique so a repeat registration cannot create a second lead. */
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare mobile: string;

  @Column({ type: DataType.STRING(4), allowNull: false })
  declare postcode: string;

  @BelongsToMany(() => ServiceType, () => LeadServiceType)
  declare services?: ServiceType[];

  declare createdAt: Date;
}
