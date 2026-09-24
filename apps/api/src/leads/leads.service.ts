import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import DataLoader from 'dataloader';
import { UniqueConstraintError, type Includeable, type Order } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BadUserInputError, ConflictError } from '../common/index.js';
import { LeadSort, type LeadPage } from './dto/lead-page.js';
import { Lead } from './lead.model.js';
import { LeadServiceType } from './lead-service-type.model.js';
import type { RegisterInput } from './leads.schemas.js';
import { ServiceType } from './service-type.model.js';

// Every order ends with id so rows with equal keys keep a stable position across pages.
const ORDER: Record<LeadSort, Order> = {
  [LeadSort.NEWEST_FIRST]: [
    ['createdAt', 'DESC'],
    ['id', 'DESC'],
  ],
  [LeadSort.OLDEST_FIRST]: [
    ['createdAt', 'ASC'],
    ['id', 'ASC'],
  ],
  [LeadSort.NAME_ASC]: [
    ['name', 'ASC'],
    ['id', 'ASC'],
  ],
};

export type ListLeadsArgs = { limit: number; offset: number; serviceType?: string; sort: LeadSort };

@Injectable()
export class LeadsService {
  // One loader per GraphQL request, keyed by its context object, so batching and caching
  // never cross requests. Entries are dropped with the context.
  private readonly servicesLoaders = new WeakMap<object, DataLoader<string, ServiceType[]>>();

  constructor(
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(ServiceType) private readonly serviceTypeModel: typeof ServiceType,
    @InjectModel(LeadServiceType) private readonly leadServiceTypeModel: typeof LeadServiceType,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  activeServiceTypes(): Promise<ServiceType[]> {
    return this.serviceTypeModel.findAll({ where: { active: true }, order: [['id', 'ASC']] });
  }

  async register(input: RegisterInput): Promise<Lead> {
    const types = await this.serviceTypeModel.findAll({ where: { code: input.services, active: true } });
    const unknown = input.services.filter((code) => !types.some((type) => type.code === code));
    if (unknown.length > 0) {
      throw new BadUserInputError('Invalid input', { services: `Unknown or unavailable service: ${unknown.join(', ')}` });
    }

    try {
      return await this.sequelize.transaction(async (transaction) => {
        const lead = await this.leadModel.create(
          { name: input.name, email: input.email, mobile: input.mobile, postcode: input.postcode },
          { transaction },
        );
        await this.leadServiceTypeModel.bulkCreate(
          types.map((type) => ({ leadId: lead.id, serviceTypeId: type.id })),
          { transaction },
        );
        return lead;
      });
    } catch (err) {
      // The unique email constraint, not a prior lookup, decides: two concurrent registrations
      // with one email cannot both succeed.
      if (err instanceof UniqueConstraintError) throw new ConflictError('Email is already registered');
      throw err;
    }
  }

  async list({ limit, offset, serviceType, sort }: ListLeadsArgs): Promise<LeadPage> {
    let include: Includeable[] = [];
    if (serviceType) {
      // Retired types still filter, so old leads stay findable.
      const type = await this.serviceTypeModel.findOne({ where: { code: serviceType } });
      if (!type) return { items: [], total: 0, limit, offset };
      include = [{ model: LeadServiceType, attributes: [], where: { serviceTypeId: type.id } }];
    }

    const { rows, count } = await this.leadModel.findAndCountAll({
      include,
      order: ORDER[sort],
      limit,
      offset,
      distinct: true,
    });
    return { items: rows, total: count, limit, offset };
  }

  findById(id: string): Promise<Lead | null> {
    return this.leadModel.findByPk(id);
  }

  servicesLoader(context: object): DataLoader<string, ServiceType[]> {
    let loader = this.servicesLoaders.get(context);
    if (!loader) {
      loader = new DataLoader((leadIds) => this.servicesFor(leadIds));
      this.servicesLoaders.set(context, loader);
    }
    return loader;
  }

  /** One query for the services of every lead in the batch. */
  private async servicesFor(leadIds: readonly string[]): Promise<ServiceType[][]> {
    const rows = await this.leadServiceTypeModel.findAll({
      where: { leadId: [...leadIds] },
      include: [ServiceType],
      order: [['serviceTypeId', 'ASC']],
    });
    const byLead = new Map<string, ServiceType[]>(leadIds.map((id) => [id, []]));
    for (const row of rows) byLead.get(row.leadId)?.push(row.serviceType!);
    return leadIds.map((id) => byLead.get(id) ?? []);
  }
}
