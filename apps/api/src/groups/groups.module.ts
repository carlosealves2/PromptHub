import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

/**
 * GroupsModule provides group management functionality.
 *
 * This module:
 * - Registers the Group entity with TypeORM
 * - Provides GroupsController for REST API endpoints
 * - Provides GroupsService for group operations
 * - Exports GroupsService for use in other modules
 *
 * Groups are collections of users that can be assigned roles,
 * allowing for easier management of permissions across multiple users.
 *
 * Endpoints:
 * - GET /groups - List all groups (requires groups:read)
 * - GET /groups/:id - Get group by ID (requires groups:read)
 * - POST /groups - Create a new group (requires groups:create)
 * - PATCH /groups/:id - Update a group (requires groups:update)
 * - DELETE /groups/:id - Delete a group (requires groups:delete)
 * - GET /groups/:id/roles - Get roles for a group (requires groups:read)
 * - POST /groups/:id/roles - Assign roles to a group (requires groups:update)
 * - DELETE /groups/:id/roles - Remove roles from a group (requires groups:update)
 * - GET /groups/:id/users - Get users in a group (requires groups:read)
 * - POST /groups/:id/users - Assign users to a group (requires groups:update)
 * - DELETE /groups/:id/users - Remove users from a group (requires groups:update)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Group, Role, User])],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
