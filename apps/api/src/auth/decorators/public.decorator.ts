import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for marking routes as public
 * Used by JwtAuthGuard to skip authentication
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route or controller as public
 *
 * Routes marked with @Public() will bypass JWT authentication.
 * Use this for endpoints like login, register, and public resources.
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login')
 * login(@Body() loginDto: LoginDto) {
 *   return this.authService.login(loginDto);
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
