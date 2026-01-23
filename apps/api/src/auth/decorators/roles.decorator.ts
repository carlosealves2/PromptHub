import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required roles
 * Used by RolesGuard to check user roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route or controller
 *
 * The user must have at least one of the specified roles to access the route.
 * Use this decorator in combination with @UseGuards(RolesGuard) or the global RolesGuard.
 *
 * @param roles - The roles allowed to access the route
 * @returns A metadata decorator
 *
 * @example
 * ```typescript
 * // Single role required
 * @Roles('admin')
 * @Get('admin/dashboard')
 * getDashboard() {
 *   return this.adminService.getDashboard();
 * }
 *
 * // Multiple roles (user needs at least one)
 * @Roles('admin', 'moderator')
 * @Delete(':id')
 * deleteUser(@Param('id') id: string) {
 *   return this.usersService.delete(id);
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
