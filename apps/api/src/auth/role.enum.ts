import { registerEnumType } from '@nestjs/graphql';

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

registerEnumType(Role, { name: 'Role', description: 'Access level of a user.' });
