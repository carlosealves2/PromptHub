import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT token payload interface
 */
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat?: number; // issued at
  exp?: number; // expiration
}

/**
 * Validated user object returned from JWT strategy
 * This gets attached to request.user
 */
export interface ValidatedUser {
  id: string;
  email: string;
}

/**
 * JWT Passport Strategy for token validation
 *
 * Validates JWT tokens from Authorization Bearer header.
 * The strategy name 'jwt' must match the name used in AuthGuard('jwt').
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Always validate token expiration for security
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validates the JWT payload and returns the user object
   *
   * This method is called after the token is verified.
   * The returned object is attached to request.user.
   *
   * @param payload - The decoded JWT payload
   * @returns The validated user object
   * @throws UnauthorizedException if payload is invalid
   */
  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user object that will be attached to request.user
    // Note: Full user lookup with roles/permissions is done in guards/services
    // when needed, to avoid unnecessary database queries on every request
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
