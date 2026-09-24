import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { Lead } from './lead.model.js';
import { ServiceType } from './service-type.model.js';

/** Join table: one row per service a lead is interested in. The composite key prevents duplicates. */
@Table({ tableName: 'lead_service_types', updatedAt: false })
export class LeadServiceType extends Model {
  @PrimaryKey
  @ForeignKey(() => Lead)
  @Column({ type: DataType.UUID, allowNull: false })
  declare leadId: string;

  @PrimaryKey
  @ForeignKey(() => ServiceType)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare serviceTypeId: number;

  @BelongsTo(() => ServiceType)
  declare serviceType?: ServiceType;
}
