import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Roles Authorization Guard
 *
 * Checks if the authenticated user has the required roles to access a route.
 * The user must have at least one of the specified roles.
 *
 * This guard should be used after JwtAuthGuard to ensure the user is authenticated.
 * Use the @Roles() decorator to specify required roles on routes or controllers.
 *
 * @example
 * ```typescript
 * // Apply globally in app.module.ts (after JwtAuthGuard)
 * providers: [
 *   {
 *     provide: APP_GUARD,
 *     useClass: JwtAuthGuard,
 *   },
 *   {
 *     provide: APP_GUARD,
 *     useClass: RolesGuard,
 *   },
 * ]
 *
 * // Require specific roles on routes
 * @Roles('admin')
 * @Get('admin/users')
 * getAllUsers() { ... }
 *
 * // Multiple roles (user needs at least one)
 * @Roles('admin', 'moderator')
 * @Delete(':id')
 * deleteItem() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Determines if the current request can proceed based on user roles
   *
   * First checks if the route has required roles via the @Roles decorator.
   * If no roles are required, allows the request to proceed.
   * Otherwise, fetches the user with roles and checks for a matching role.
   *
   * @param context - The execution context containing request details
   * @returns Boolean indicating if the request is authorized
   * @throws ForbiddenException if user lacks required roles
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from route metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get the authenticated user from the request
    const request = context.switchToHttp().getRequest();
    const requestUser = request.user;

    // If no user is authenticated, deny access
    if (!requestUser || !requestUser.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Fetch user with roles from database
    const user = await this.userRepository.findOne({
      where: { id: requestUser.id },
      relations: ['roles'],
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Check if user has at least one of the required roles
    const userRoleNames = user.roles.map((role) => role.name);
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoleNames.includes(role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
