import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import DataLoader from 'dataloader';
import { Op, UniqueConstraintError, type Includeable, type Order, type WhereOptions } from 'sequelize';
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
  [LeadSort.NAME_DESC]: [
    ['name', 'DESC'],
    ['id', 'DESC'],
  ],
  [LeadSort.EMAIL_ASC]: [
    ['email', 'ASC'],
    ['id', 'ASC'],
  ],
  [LeadSort.EMAIL_DESC]: [
    ['email', 'DESC'],
    ['id', 'DESC'],
  ],
  [LeadSort.POSTCODE_ASC]: [
    ['postcode', 'ASC'],
    ['createdAt', 'DESC'],
    ['id', 'DESC'],
  ],
  [LeadSort.POSTCODE_DESC]: [
    ['postcode', 'DESC'],
    ['createdAt', 'DESC'],
    ['id', 'DESC'],
  ],
};

export type ListLeadsArgs = { limit: number; offset: number; serviceType?: string; search?: string; sort: LeadSort };

/** `text` for a LIKE pattern, matched literally: `%`, `_` and `\` lose their special meaning. */
const likeLiteral = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Leads matching `search`: name or email containing it (any case), postcode starting with it, or,
 * when it has 3+ digits, a mobile containing those digits ("0412 345" finds 0412345678). Name and
 * email use trigram indexes (migration add-leads-search-indexes).
 */
function searchWhere(search: string): WhereOptions {
  const text = likeLiteral(search);
  const digits = search.replace(/\D/g, '');
  return {
    [Op.or]: [
      { name: { [Op.iLike]: `%${text}%` } },
      { email: { [Op.iLike]: `%${text}%` } },
      { postcode: { [Op.like]: `${text}%` } },
      ...(digits.length >= 3 ? [{ mobile: { [Op.like]: `%${digits}%` } }] : []),
    ],
  };
}

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

  async list({ limit, offset, serviceType, search, sort }: ListLeadsArgs): Promise<LeadPage> {
    let include: Includeable[] = [];
    if (serviceType) {
      // Retired types still filter, so old leads stay findable.
      const type = await this.serviceTypeModel.findOne({ where: { code: serviceType } });
      if (!type) return { items: [], total: 0, limit, offset };
      include = [{ model: LeadServiceType, attributes: [], where: { serviceTypeId: type.id } }];
    }

    const { rows, count } = await this.leadModel.findAndCountAll({
      where: search ? searchWhere(search) : undefined,
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
