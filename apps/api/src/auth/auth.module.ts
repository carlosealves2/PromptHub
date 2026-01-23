import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, PermissionsGuard, RolesGuard } from './guards';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule provides authentication and authorization functionality.
 *
 * This module configures:
 * - Passport JWT authentication strategy
 * - JWT token generation and validation via @nestjs/jwt
 * - Authentication guards (JwtAuthGuard, RolesGuard, PermissionsGuard)
 * - Authentication endpoints via AuthController
 *
 * Configuration:
 * - JWT_SECRET: Secret key for signing tokens (required)
 * - JWT_EXPIRATION: Access token expiration (default: 3600s)
 * - JWT_REFRESH_EXPIRATION: Refresh token expiration (default: 7d)
 *
 * Usage:
 * 1. Import AuthModule in AppModule
 * 2. Apply JwtAuthGuard globally via APP_GUARD
 * 3. Use @Public() decorator for unauthenticated routes
 * 4. Use @Roles() and @Permissions() decorators for authorization
 */
@Module({
  imports: [
    // Import UsersModule to access UsersService for user operations
    UsersModule,

    // Configure Passport with JWT as the default strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Configure JWT module with async factory for dynamic configuration
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '3600s'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Core authentication service
    AuthService,

    // Passport JWT strategy for token validation
    JwtStrategy,

    // Authentication and authorization guards
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    // Export AuthService for use in other modules (e.g., GraphQL resolvers)
    AuthService,

    // Export guards for use in other modules or global registration
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,

    // Export JwtModule for token operations in other modules
    JwtModule,
  ],
})
export class AuthModule {}
