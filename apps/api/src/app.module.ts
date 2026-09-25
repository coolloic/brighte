import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import {
  databaseOptions,
  formatError,
  GqlThrottlerGuard,
  GraphqlExceptionFilter,
  loggerParams,
  operationLogPlugin,
  RATE_LIMIT_WINDOW_MS,
  RateLimits,
} from './common/index.js';
import { HealthController } from './health.controller.js';
import { LeadsModule } from './leads/leads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // apps/api/.env first, then the root .env (shared ports); a variable already set wins.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // Structured request logs with a request id (see common/logging.ts); main.ts routes Nest's logger here.
    LoggerModule.forRoot(loggerParams()),
    // Per client IP and per operation; stricter limits on login and register (see RateLimits).
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: RATE_LIMIT_WINDOW_MS, limit: RateLimits.default }] }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        uri: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadModels: true,
        // Schema is owned by migrations (src/database/migrations), never synced from models.
        synchronize: false,
        logging: false,
        // Pool size and timeouts (DB_POOL_MAX, DB_STATEMENT_TIMEOUT_MS): see common/database.ts.
        ...databaseOptions(),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Expose the HTTP request and response: the auth guard reads the Authorization header,
      // the rate limiter sets Retry-After and X-RateLimit-* headers.
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      // Cap document size before parsing: a huge query costs CPU even if it is invalid.
      parseOptions: { maxTokens: 1000 },
      // Introspection is off in production; without this, "Did you mean ...?" hints on typos
      // would still reveal field names one guess at a time.
      hideSchemaDetailsFromClientErrors: process.env.NODE_ENV === 'production',
      formatError,
      plugins: [operationLogPlugin],
    }),
    UsersModule,
    AuthModule,
    LeadsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: GraphqlExceptionFilter },
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
  ],
})
export class AppModule {}
