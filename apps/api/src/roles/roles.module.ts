import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * RolesModule provides role management functionality.
 *
 * This module:
 * - Registers the Role entity with TypeORM
 * - Provides RolesController for REST API endpoints
 * - Provides RolesService for role operations
 * - Exports RolesService for use in other modules (e.g., UsersModule)
 *
 * Roles are collections of permissions that can be assigned to users.
 * Each role can have multiple permissions attached.
 *
 * Endpoints:
 * - GET /roles - List all roles (requires roles:read)
 * - GET /roles/:id - Get role by ID (requires roles:read)
 * - POST /roles - Create a new role (requires roles:create)
 * - PATCH /roles/:id - Update a role (requires roles:update)
 * - DELETE /roles/:id - Delete a role (requires roles:delete)
 * - GET /roles/:id/permissions - Get permissions for a role (requires roles:read)
 * - POST /roles/:id/permissions - Assign permissions to a role (requires roles:update)
 * - DELETE /roles/:id/permissions - Remove permissions from a role (requires roles:update)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
