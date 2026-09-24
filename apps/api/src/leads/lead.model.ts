import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { LeadServiceType } from './lead-service-type.model.js';
import { ServiceType } from './service-type.model.js';

/** An expression of interest in Brighte Eats. */
@Table({ tableName: 'leads' })
export class Lead extends Model {
  declare id: number;

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
