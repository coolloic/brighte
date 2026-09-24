import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { formatError } from './common/format-error.js';
import { GraphqlExceptionFilter } from './common/graphql-exception.filter.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        uri: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadModels: true,
        // Schema is owned by migrations (src/database/migrations), never synced from models.
        synchronize: false,
        logging: false,
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Expose the HTTP request so the auth guard can read the Authorization header.
      context: ({ req }: { req: unknown }) => ({ req }),
      formatError,
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: GraphqlExceptionFilter }],
})
export class AppModule {}
