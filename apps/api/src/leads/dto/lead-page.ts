import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Lead } from '../lead.model.js';

export enum LeadSort {
  NEWEST_FIRST = 'NEWEST_FIRST',
  OLDEST_FIRST = 'OLDEST_FIRST',
  NAME_ASC = 'NAME_ASC',
  NAME_DESC = 'NAME_DESC',
  EMAIL_ASC = 'EMAIL_ASC',
  EMAIL_DESC = 'EMAIL_DESC',
  POSTCODE_ASC = 'POSTCODE_ASC',
  POSTCODE_DESC = 'POSTCODE_DESC',
}

registerEnumType(LeadSort, {
  name: 'LeadSort',
  description: 'Order of `leads`. Ties are broken by id, so pages are stable.',
});

@ObjectType({ description: 'One page of leads (limit/offset pagination).' })
export class LeadPage {
  @Field(() => [Lead])
  items: Lead[];

  @Field(() => Int, { description: 'Leads matching the filter, across all pages.' })
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;
}
