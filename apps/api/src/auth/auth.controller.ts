import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, RegisterDto, TokenResponseDto } from './dto';
import { CurrentUser, Public } from './decorators';
import { ValidatedUser } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';

/**
 * Authentication Controller
 *
 * Handles all authentication-related REST endpoints including
 * user registration, login, token refresh, logout, and profile access.
 *
 * Routes:
 * - POST /auth/register - Register a new user (public)
 * - POST /auth/login - Login with credentials (public)
 * - POST /auth/refresh - Refresh access token (public, requires refresh token)
 * - POST /auth/logout - Logout current user (authenticated)
 * - GET /auth/profile - Get current user profile (authenticated)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   *
   * Creates a new user account with the provided credentials and returns
   * access and refresh tokens.
   *
   * @param registerDto - Registration data (email, password, optional name)
   * @returns Token response with access/refresh tokens and user info
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<TokenResponseDto> {
    return this.authService.register(registerDto);
  }

  /**
   * Login with credentials
   *
   * Authenticates a user with email and password, returning access and
   * refresh tokens on success.
   *
   * @param loginDto - Login credentials (email, password)
   * @returns Token response with access/refresh tokens and user info
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * Refresh access token
   *
   * Exchanges a valid refresh token for new access and refresh tokens.
   * Implements token rotation - the old refresh token is invalidated.
   *
   * @param refreshTokenDto - The refresh token
   * @returns New token response with rotated tokens
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  /**
   * Logout current user
   *
   * Invalidates the user's refresh token, effectively logging them out.
   * Requires a valid access token.
   *
   * @param user - The current authenticated user
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: ValidatedUser): Promise<void> {
    await this.authService.logout(user.id);
  }

  /**
   * Get current user profile
   *
   * Returns the authenticated user's profile information including
   * their roles and permissions.
   *
   * @param user - The current authenticated user
   * @returns The user's profile with roles
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: ValidatedUser): Promise<User> {
    return this.authService.getProfile(user.id);
  }
}
