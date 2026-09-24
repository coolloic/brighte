import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, DataType, DefaultScope, Model, Scopes, Table } from 'sequelize-typescript';
import { Role } from '../auth/index.js';

@ObjectType()
// The password hash is only loaded when asked for via the `withPassword` scope.
@DefaultScope(() => ({ attributes: { exclude: ['passwordHash'] } }))
@Scopes(() => ({ withPassword: { attributes: { include: ['passwordHash'] } } }))
@Table({ tableName: 'users' })
export class User extends Model {
  @Field(() => ID)
  declare id: number;

  @Field()
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Field()
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Field(() => Role)
  @Column({ type: DataType.ENUM(...Object.values(Role)), allowNull: false, defaultValue: Role.USER })
  declare role: Role;

  // Deliberately not a GraphQL @Field: must never be exposed.
  @Column({ type: DataType.STRING, allowNull: false })
  declare passwordHash: string;

  @Field()
  declare createdAt: Date;
}
