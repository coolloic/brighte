import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Lead } from './lead.model.js';
import { LeadServiceType } from './lead-service-type.model.js';
import { LeadsResolver, ServiceTypesResolver } from './leads.resolver.js';
import { LeadsService } from './leads.service.js';
import { ServiceType } from './service-type.model.js';

@Module({
  imports: [SequelizeModule.forFeature([Lead, ServiceType, LeadServiceType])],
  providers: [LeadsService, LeadsResolver, ServiceTypesResolver],
})
export class LeadsModule {}
