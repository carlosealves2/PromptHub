import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';

// Auth & RBAC modules
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { GroupsModule } from '../groups/groups.module';

// Guards for global authentication and authorization
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from '../auth/guards';

// Database configuration
import { databaseConfig } from '../config/database.config';

/**
 * AppModule is the root module of the application.
 *
 * It integrates:
 * - ConfigModule: Global configuration management
 * - TypeOrmModule: PostgreSQL database connection with entities
 * - GraphQLModule: Apollo GraphQL server
 * - AuthModule: JWT authentication with Passport
 * - UsersModule: User management endpoints
 * - RolesModule: Role management endpoints
 * - PermissionsModule: Permission management endpoints
 * - GroupsModule: Group management endpoints
 *
 * Global Guards (applied to all routes):
 * - JwtAuthGuard: Validates JWT tokens (use @Public() to bypass)
 * - RolesGuard: Enforces role requirements (use @Roles() to specify)
 * - PermissionsGuard: Enforces permission requirements (use @Permissions() to specify)
 */
@Module({
  imports: [
    // Global configuration - environment variables accessible everywhere
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // TypeORM database connection with async configuration
    TypeOrmModule.forRootAsync(databaseConfig),

    // GraphQL with Apollo driver
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'apps/api/src/schema.gql'),
        introspection: configService.get('GRAPHQL_INTROSPECTION', 'false') === 'true',
        csrfPrevention: configService.get('GRAPHQL_CSRF_PREVENTION', 'true') === 'true',
      }),
    }),

    // Authentication module (JWT, Passport, guards)
    AuthModule,

    // Feature modules
    UsersModule,
    RolesModule,
    PermissionsModule,
    GroupsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,

    // Global JWT authentication guard
    // All routes require authentication by default
    // Use @Public() decorator to bypass authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global roles guard
    // Use @Roles('admin', 'moderator') to restrict access
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global permissions guard
    // Use @Permissions('users:read', 'users:write') to restrict access
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
