import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SequelizeModule } from '@nestjs/sequelize';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { Request, Response } from 'express';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { formatGraphqlError } from './common/errors/format-graphql-error.js';
import { appValidationPipe } from './common/validation/validation.pipe.js';
import { validateEnv } from './config/env.validation.js';
import { UsersModule } from './users/users.module.js';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        uri: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadModels: true,
        // Dev convenience only; use migrations in production.
        synchronize: !isProd,
        logging: false,
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // API docs: Apollo Sandbox at /graphql in dev. Schema is not discoverable in production.
      playground: false,
      introspection: !isProd,
      plugins: isProd ? [] : [ApolloServerPluginLandingPageLocalDefault()],
      includeStacktraceInErrorResponses: false,
      // Use the status set by AllExceptionsFilter (401, 403, 409...) instead of always 200.
      preserveHttpStatusForExecutionErrors: false,
      formatError: formatGraphqlError,
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_PIPE, useValue: appValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
