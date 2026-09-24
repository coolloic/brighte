import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** A service a lead can be interested in. Rows, not an enum: types change without a deploy. */
@Table({ tableName: 'service_types' })
export class ServiceType extends Model {
  declare id: number;

  /** Stable key used by the API, e.g. `pick-up`. Never renamed once in use. */
  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare label: string;

  /** Retired types keep existing interests but are no longer offered. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;
}
