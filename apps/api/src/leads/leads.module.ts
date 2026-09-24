import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Lead } from './lead.model.js';
import { LeadServiceType } from './lead-service-type.model.js';
import { ServiceType } from './service-type.model.js';

@Module({
  imports: [SequelizeModule.forFeature([Lead, ServiceType, LeadServiceType])],
})
export class LeadsModule {}
