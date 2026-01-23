import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard
 *
 * Extends Passport's AuthGuard to provide JWT authentication for protected routes.
 * Checks for the @Public decorator to allow bypassing authentication on specific routes.
 *
 * This guard should be applied globally in the app module to protect all routes by default.
 * Use the @Public() decorator on routes that should be accessible without authentication.
 *
 * @example
 * ```typescript
 * // Apply globally in app.module.ts
 * providers: [
 *   {
 *     provide: APP_GUARD,
 *     useClass: JwtAuthGuard,
 *   },
 * ]
 *
 * // Mark specific routes as public
 * @Public()
 * @Post('login')
 * login() { ... }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determines if the current request can proceed
   *
   * First checks if the route is marked as public using the @Public decorator.
   * If public, allows the request to proceed without authentication.
   * Otherwise, delegates to the parent AuthGuard for JWT validation.
   *
   * @param context - The execution context containing request details
   * @returns Boolean indicating if the request is authorized, or an Observable/Promise that resolves to a boolean
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if the route or controller is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If public, allow the request without authentication
    if (isPublic) {
      return true;
    }

    // Otherwise, perform JWT authentication via Passport
    return super.canActivate(context);
  }
}
