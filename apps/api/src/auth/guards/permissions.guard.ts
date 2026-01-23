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
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Permissions Authorization Guard
 *
 * Checks if the authenticated user has the required permissions to access a route.
 * The user must have ALL of the specified permissions (permissions are checked through roles).
 *
 * This guard should be used after JwtAuthGuard to ensure the user is authenticated.
 * Use the @Permissions() decorator to specify required permissions on routes or controllers.
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
 *     useClass: PermissionsGuard,
 *   },
 * ]
 *
 * // Require specific permission on routes
 * @Permissions('users:read')
 * @Get()
 * findAll() { ... }
 *
 * // Multiple permissions (user needs ALL of them)
 * @Permissions('users:read', 'users:write')
 * @Patch(':id')
 * update() { ... }
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Determines if the current request can proceed based on user permissions
   *
   * First checks if the route has required permissions via the @Permissions decorator.
   * If no permissions are required, allows the request to proceed.
   * Otherwise, fetches the user with roles and permissions and checks for all required permissions.
   *
   * @param context - The execution context containing request details
   * @returns Boolean indicating if the request is authorized
   * @throws ForbiddenException if user lacks required permissions
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from route metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get the authenticated user from the request
    const request = context.switchToHttp().getRequest();
    const requestUser = request.user;

    // If no user is authenticated, deny access
    if (!requestUser || !requestUser.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Fetch user with roles and permissions from database
    const user = await this.userRepository.findOne({
      where: { id: requestUser.id },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Collect all permission names from all user roles
    const userPermissions = new Set<string>();
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        userPermissions.add(permission.name);
      }
    }

    // Check if user has ALL of the required permissions
    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
