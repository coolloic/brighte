import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, DataType, DefaultScope, Model, Scopes, Table } from 'sequelize-typescript';
import { Role } from '../auth/role.enum.js';

@ObjectType({ description: 'A registered user.' })
// Never load the password hash unless explicitly asked for via the `withPassword` scope.
@DefaultScope(() => ({ attributes: { exclude: ['passwordHash'] } }))
@Scopes(() => ({ withPassword: { attributes: { include: ['passwordHash'] } } }))
@Table({ tableName: 'users', underscored: true })
export class User extends Model {
  @Field(() => ID, { description: 'Unique user id.' })
  declare id: number;

  @Field({ description: 'Email address, unique and lowercase.' })
  @Column({ type: DataType.STRING(254), allowNull: false, unique: true })
  declare email: string;

  @Field({ description: 'Display name.' })
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Field(() => Role, { description: 'Access level.' })
  @Column({ type: DataType.ENUM(...Object.values(Role)), allowNull: false, defaultValue: Role.USER })
  declare role: Role;

  // Deliberately not a GraphQL @Field: must never be exposed.
  @Column({ type: DataType.STRING, allowNull: false })
  declare passwordHash: string;

  @Field({ description: 'When the account was created.' })
  declare createdAt: Date;
}
