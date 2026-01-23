import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required permissions
 * Used by PermissionsGuard to check user permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route or controller
 *
 * The user must have all specified permissions to access the route.
 * Permissions are checked through the user's roles (cascading).
 * Use this decorator in combination with @UseGuards(PermissionsGuard) or the global PermissionsGuard.
 *
 * @param permissions - The permissions required to access the route (format: 'resource:action')
 * @returns A metadata decorator
 *
 * @example
 * ```typescript
 * // Single permission required
 * @Permissions('users:read')
 * @Get()
 * findAll() {
 *   return this.usersService.findAll();
 * }
 *
 * // Multiple permissions required (user needs ALL of them)
 * @Permissions('users:read', 'users:write')
 * @Patch(':id')
 * update(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
 *   return this.usersService.update(id, updateDto);
 * }
 *
 * // Delete permission
 * @Permissions('users:delete')
 * @Delete(':id')
 * remove(@Param('id') id: string) {
 *   return this.usersService.remove(id);
 * }
 * ```
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
