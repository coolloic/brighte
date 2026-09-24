import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, Op, UniqueConstraintError } from 'sequelize';
import { AppModule } from './../src/app.module.js';
import { Lead, LeadServiceType, ServiceType } from './../src/leads/index.js';

const PREFIX = `e2e-leads-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;

describe('Leads data model (e2e)', () => {
  let app: INestApplication;
  let leads: typeof Lead;
  let serviceTypes: typeof ServiceType;
  let joins: typeof LeadServiceType;

  const typeId = async (code: string) => (await serviceTypes.findOne({ where: { code }, rejectOnEmpty: true })).id;

  const createLead = async (name: string, codes: string[]) => {
    const lead = await leads.create({ name, email: email(name), mobile: '0400000000', postcode: '2000' });
    await joins.bulkCreate(await Promise.all(codes.map(async (code) => ({ leadId: lead.id, serviceTypeId: await typeId(code) }))));
    return lead;
  };

  const codesOf = async (leadId: string) => {
    const lead = await leads.findByPk(leadId, { include: [ServiceType], rejectOnEmpty: true });
    return lead.services!.map((s) => s.code).sort();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    leads = moduleRef.get<typeof Lead>(getModelToken(Lead));
    serviceTypes = moduleRef.get<typeof ServiceType>(getModelToken(ServiceType));
    joins = moduleRef.get<typeof LeadServiceType>(getModelToken(LeadServiceType));
  });

  afterAll(async () => {
    await leads.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await serviceTypes.destroy({ where: { code: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  it('ships the initial service types', async () => {
    const codes = (await serviceTypes.findAll({ where: { code: ['delivery', 'pick-up', 'payment'] } })).map((s) => s.code);
    expect(codes.sort()).toEqual(['delivery', 'payment', 'pick-up']);
  });

  it('gives leads time-ordered UUID v7 ids', async () => {
    const first = await createLead('first', []);
    const second = await createLead('second', []);
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second.id > first.id).toBe(true);
  });

  it('links a lead to several service types', async () => {
    const lead = await createLead('multi', ['delivery', 'payment']);
    expect(await codesOf(lead.id)).toEqual(['delivery', 'payment']);
  });

  it('filters leads by service type through the join table', async () => {
    const pickup = await createLead('pickup', ['pick-up']);
    const delivery = await createLead('delivery-only', ['delivery']);

    const found = await leads.findAll({
      where: { email: { [Op.like]: `${PREFIX}-%` } },
      include: [{ model: ServiceType, where: { code: 'pick-up' }, attributes: [] }],
    });
    const ids = found.map((l) => l.id);
    expect(ids).toContain(pickup.id);
    expect(ids).not.toContain(delivery.id);
  });

  it('accepts a new service type as data, with no migration', async () => {
    await serviceTypes.create({ code: `${PREFIX}-catering`, label: 'Catering' });
    const lead = await createLead('catering', [`${PREFIX}-catering`, 'delivery']);
    expect(await codesOf(lead.id)).toEqual([`${PREFIX}-catering`, 'delivery'].sort());
  });

  it('rejects the same service twice for one lead', async () => {
    const lead = await createLead('twice', ['delivery']);
    await expect(joins.create({ leadId: lead.id, serviceTypeId: await typeId('delivery') })).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
  });

  it('rejects a second lead with the same email', async () => {
    await createLead('dup', ['payment']);
    await expect(
      leads.create({ name: 'Dup again', email: email('dup'), mobile: '0400000001', postcode: '3000' }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });

  it('keeps a service type in use from being deleted, but lets it be retired', async () => {
    const retiring = await serviceTypes.create({ code: `${PREFIX}-retiring`, label: 'Retiring' });
    const lead = await createLead('retiring', [`${PREFIX}-retiring`]);

    await expect(retiring.destroy()).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await retiring.update({ active: false });
    expect(await codesOf(lead.id)).toEqual([`${PREFIX}-retiring`]);
  });

  it('removes a lead\'s interests when the lead is deleted', async () => {
    const lead = await createLead('gone', ['delivery', 'pick-up']);
    await lead.destroy();
    expect(await joins.count({ where: { leadId: lead.id } })).toBe(0);
  });
});
