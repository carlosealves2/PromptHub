import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

/**
 * PermissionsModule provides permission management functionality.
 *
 * This module:
 * - Registers the Permission entity with TypeORM
 * - Provides PermissionsController for REST API endpoints
 * - Provides PermissionsService for permission operations
 * - Exports PermissionsService for use in other modules (e.g., RolesModule)
 *
 * Permissions follow the resource:action naming convention (e.g., users:read, posts:create).
 *
 * Endpoints:
 * - GET /permissions - List all permissions (requires permissions:read)
 * - GET /permissions/:id - Get permission by ID (requires permissions:read)
 * - POST /permissions - Create a new permission (requires permissions:create)
 * - PATCH /permissions/:id - Update a permission (requires permissions:update)
 * - DELETE /permissions/:id - Delete a permission (requires permissions:delete)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Permission])],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
