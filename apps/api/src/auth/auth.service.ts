import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, RefreshTokenDto, TokenResponseDto, UserInfoDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Number of bcrypt salt rounds for password hashing
 * 12 rounds is recommended for 2026+ as per spec
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * AuthService handles all authentication operations including
 * user registration, login, token refresh, and logout.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   * Creates a user with hashed password and returns tokens
   *
   * @param registerDto - The registration data (email, password, name)
   * @returns Token response with access/refresh tokens and user info
   */
  async register(registerDto: RegisterDto): Promise<TokenResponseDto> {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(registerDto.password, BCRYPT_SALT_ROUNDS);

    // Create the user with hashed password
    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
    });

    // Generate tokens and store refresh token hash
    return this.generateTokens(user);
  }

  /**
   * Authenticate a user and return tokens
   *
   * @param loginDto - The login credentials (email, password)
   * @returns Token response with access/refresh tokens and user info
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    // Validate user credentials
    const user = await this.validateUserCredentials(loginDto.email, loginDto.password);

    // Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated');
    }

    // Generate tokens and store refresh token hash
    return this.generateTokens(user);
  }

  /**
   * Validate user credentials for login
   *
   * @param email - The user's email
   * @param password - The plain text password to verify
   * @returns The authenticated user
   * @throws UnauthorizedException if credentials are invalid
   */
  async validateUserCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);

    // Use constant-time comparison to prevent timing attacks
    // If user doesn't exist, we still compare against a dummy hash
    if (!user) {
      // Perform a dummy comparison to prevent timing attacks
      await bcrypt.compare(password, '$2b$12$invalid.hash.to.prevent.timing.attacks');
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  /**
   * Refresh access and refresh tokens
   * Validates the refresh token and issues new tokens (token rotation)
   *
   * @param refreshTokenDto - The refresh token data
   * @returns New token response with rotated tokens
   * @throws UnauthorizedException if refresh token is invalid
   */
  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    try {
      // Verify the refresh token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshTokenDto.refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });

      // Get the user
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new ForbiddenException('Your account has been deactivated');
      }

      // Verify the refresh token hash matches
      if (!user.refreshTokenHash) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshTokenDto.refreshToken,
        user.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens (token rotation)
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout a user by invalidating their refresh token
   *
   * @param userId - The ID of the user to logout
   */
  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  /**
   * Get user profile by ID
   *
   * @param userId - The user's ID
   * @returns The user with roles loaded
   * @throws UnauthorizedException if user not found
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.usersService.findByIdWithRoles(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Generate access and refresh tokens for a user
   * Also stores the hashed refresh token in the database
   *
   * @param user - The user to generate tokens for
   * @returns Token response with access/refresh tokens and user info
   */
  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    // Generate access token
    const accessToken = await this.jwtService.signAsync(payload);

    // Generate refresh token with longer expiration
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });

    // Hash and store the refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    // Extract roles from user (if loaded)
    const roleNames = user.roles?.map((role) => role.name) || [];

    // Build user info response
    const userInfo: UserInfoDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles: roleNames,
    };

    // Calculate expiration time in seconds
    const expiresIn = this.getExpiresInSeconds();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      user: userInfo,
    };
  }

  /**
   * Get the refresh token secret from configuration
   * Uses JWT_REFRESH_SECRET if set, otherwise falls back to JWT_SECRET
   */
  private getRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') ||
           this.configService.get<string>('JWT_SECRET', '');
  }

  /**
   * Get the access token expiration in seconds
   * Parses the JWT_EXPIRATION config value (e.g., '3600s', '1h', '15m')
   */
  private getExpiresInSeconds(): number {
    const expiration = this.configService.get<string>('JWT_EXPIRATION', '3600s');

    // Parse duration string (e.g., '3600s', '1h', '15m', '1d')
    const match = expiration.match(/^(\d+)(s|m|h|d)?$/);
    if (!match) {
      return 3600; // Default to 1 hour
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] || 's';

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }
}
