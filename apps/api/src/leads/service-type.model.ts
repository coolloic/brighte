import { Field, ObjectType } from '@nestjs/graphql';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** A service a lead can be interested in. Rows, not an enum: types change without a deploy. */
@ObjectType({ description: 'A service a lead can be interested in, e.g. `delivery`.' })
@Table({ tableName: 'service_types' })
export class ServiceType extends Model {
  declare id: number;

  /** Stable key used by the API, e.g. `pick-up`. Never renamed once in use. */
  @Field({ description: 'Stable key, e.g. `pick-up`. Pass it to `register` and the `leads` filter.' })
  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare code: string;

  @Field({ description: 'Display name, e.g. `Pick-up`.' })
  @Column({ type: DataType.STRING, allowNull: false })
  declare label: string;

  /** Retired types keep existing interests but are no longer offered. */
  @Field({ description: 'False once retired: existing leads keep it, but `register` no longer accepts it.' })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;
}
