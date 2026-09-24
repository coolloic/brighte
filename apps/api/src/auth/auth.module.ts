import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions, type JwtSignOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthGuard } from './auth.guard.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';

const MIN_SECRET_LENGTH = 32;

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < MIN_SECRET_LENGTH) {
          throw new Error(`JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
        }
        // e.g. `15m`, `1h`; validated by jsonwebtoken on first sign.
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ?? '15m') as JwtSignOptions['expiresIn'];
        return {
          secret,
          signOptions: { algorithm: 'HS256', expiresIn },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
  ],
  providers: [AuthService, AuthResolver, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
