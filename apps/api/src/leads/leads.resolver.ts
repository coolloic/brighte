import { Args, Context, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Public, Role, Roles } from '../auth/index.js';
import { RateLimits, ThrottlePerMinute, validate } from '../common/index.js';
import { LeadPage, LeadSort } from './dto/lead-page.js';
import { Lead } from './lead.model.js';
import { leadIdSchema, leadsArgsSchema, MAX_LEADS_LIMIT, registerSchema } from './leads.schemas.js';
import { LeadsService } from './leads.service.js';
import { ServiceType } from './service-type.model.js';

@Resolver(() => Lead)
export class LeadsResolver {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @ThrottlePerMinute(RateLimits.register)
  @Mutation(() => Lead, {
    description: [
      'Register interest in Brighte Eats. `services` takes service type codes (see `serviceTypes`); duplicates are ignored. The email is stored lowercase and the mobile as `04xxxxxxxx`.',
      '**Auth:** Public.',
      '**Errors:** `BAD_USER_INPUT` (a field is invalid, or a service code is unknown or retired; `extensions.fields` maps each field to a message), `CONFLICT` (email already registered; nothing is changed), `TOO_MANY_REQUESTS` (more than 5 registrations a minute from one IP by default).',
    ].join('\n\n'),
  })
  register(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('mobile', { description: 'Australian mobile, e.g. `0412 345 678` or `+61412345678`.' }) mobile: string,
    @Args('postcode', { description: '4 digits.' }) postcode: string,
    @Args('services', { type: () => [String], description: 'At least one service type code.' }) services: string[],
  ): Promise<Lead> {
    return this.leadsService.register(validate(registerSchema, { name, email, mobile, postcode, services }));
  }

  @Roles(Role.ADMIN)
  @Query(() => LeadPage, {
    name: 'leads',
    description: [
      'Leads, one page at a time. An unknown `serviceType` returns an empty page.',
      '**Auth:** `ADMIN`.',
      `**Errors:** \`UNAUTHENTICATED\`, \`FORBIDDEN\` (caller is not \`ADMIN\`), \`BAD_USER_INPUT\` (\`limit\` outside 1–${MAX_LEADS_LIMIT}, or negative \`offset\`).`,
    ].join('\n\n'),
  })
  listLeads(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @Args('serviceType', { type: () => String, nullable: true, description: 'Only leads interested in this service type code. Blank or omitted: no filter.' })
    serviceType: string | undefined,
    @Args('sort', { type: () => LeadSort, defaultValue: LeadSort.NEWEST_FIRST }) sort: LeadSort,
  ): Promise<LeadPage> {
    return this.leadsService.list({ ...validate(leadsArgsSchema, { limit, offset, serviceType }), sort });
  }

  @Roles(Role.ADMIN)
  @Query(() => Lead, {
    nullable: true,
    description: [
      'One lead with its service interests, or null if no lead has this id.',
      '**Auth:** `ADMIN`.',
      '**Errors:** `UNAUTHENTICATED`, `FORBIDDEN` (caller is not `ADMIN`), `BAD_USER_INPUT` (`id` is not a UUID).',
    ].join('\n\n'),
  })
  lead(@Args('id', { type: () => ID }) id: string): Promise<Lead | null> {
    return this.leadsService.findById(validate(leadIdSchema, { id }).id);
  }

  // Batched per request: listing 100 leads costs one services query, not 100.
  @ResolveField('services', () => [ServiceType], { description: 'Service types this lead is interested in.' })
  services(@Parent() lead: Lead, @Context() context: object): Promise<ServiceType[]> {
    return this.leadsService.servicesLoader(context).load(lead.id);
  }
}

@Resolver(() => ServiceType)
export class ServiceTypesResolver {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Query(() => [ServiceType], {
    description: [
      'Service types a lead can choose, in display order. Retired types are left out.',
      '**Auth:** Public.',
      '**Errors:** none expected; `INTERNAL_SERVER_ERROR` on an unexpected failure.',
    ].join('\n\n'),
  })
  serviceTypes(): Promise<ServiceType[]> {
    return this.leadsService.activeServiceTypes();
  }
}
