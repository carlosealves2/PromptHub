import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Group } from '../groups/entities/group.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule provides user management functionality.
 *
 * This module:
 * - Registers the User, Role, and Group entities with TypeORM
 * - Provides UsersController for REST API endpoints
 * - Provides UsersService for user operations including role/group assignment
 * - Exports UsersService for use in other modules (e.g., AuthModule)
 *
 * Endpoints:
 * - GET /users - List all users (requires users:read)
 * - GET /users/:id - Get user by ID (requires users:read)
 * - POST /users - Create a new user (requires users:create)
 * - PATCH /users/:id - Update a user (requires users:update)
 * - DELETE /users/:id - Delete a user (requires users:delete)
 * - PUT /users/:id/roles - Assign roles to a user (requires users:update)
 * - PUT /users/:id/groups - Assign groups to a user (requires users:update)
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Group])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
