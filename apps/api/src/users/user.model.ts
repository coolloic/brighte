import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

@ObjectType()
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

  @Field()
  declare createdAt: Date;
}
