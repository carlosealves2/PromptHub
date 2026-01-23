import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RolesService, PaginatedResult, PaginationOptions } from './roles.service';
import { Permissions } from '../auth/decorators';
import { PermissionResponseDto } from '../permissions/dto';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  RoleResponseDto,
} from './dto';

/**
 * Roles Controller
 *
 * Handles all role management REST endpoints with permission-based access control.
 * All endpoints require authentication and specific permissions.
 *
 * Roles are collections of permissions that can be assigned to users.
 *
 * Routes:
 * - GET /roles - List all roles (requires roles:read)
 * - GET /roles/:id - Get role by ID (requires roles:read)
 * - POST /roles - Create a new role (requires roles:create)
 * - PATCH /roles/:id - Update a role (requires roles:update)
 * - DELETE /roles/:id - Delete a role (requires roles:delete)
 * - GET /roles/:id/permissions - Get permissions for a role (requires roles:read)
 * - POST /roles/:id/permissions - Assign permissions to a role (requires roles:update)
 * - DELETE /roles/:id/permissions - Remove permissions from a role (requires roles:update)
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * List all roles with pagination
   *
   * Returns a paginated list of all roles in the system.
   * Requires the 'roles:read' permission.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated list of roles
   */
  @Permissions('roles:read')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<RoleResponseDto>> {
    const options: PaginationOptions = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const result = await this.rolesService.findAll(options);

    return {
      ...result,
      data: result.data.map((role) => RoleResponseDto.fromEntity(role)),
    };
  }

  /**
   * Get a role by ID
   *
   * Returns detailed information about a specific role including its permissions.
   * Requires the 'roles:read' permission.
   *
   * @param id - The role's UUID
   * @returns The role details with permissions
   */
  @Permissions('roles:read')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.findById(id);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return RoleResponseDto.fromEntity(role);
  }

  /**
   * Create a new role
   *
   * Creates a new role with the provided data.
   * Role names should be lowercase, alphanumeric with optional underscores.
   * Requires the 'roles:create' permission.
   *
   * @param createRoleDto - The role creation data
   * @returns The created role
   */
  @Permissions('roles:create')
  @Post()
  async create(@Body() createRoleDto: CreateRoleDto): Promise<RoleResponseDto> {
    const role = await this.rolesService.create({
      name: createRoleDto.name,
      description: createRoleDto.description,
    });

    return RoleResponseDto.fromEntity(role);
  }

  /**
   * Update an existing role
   *
   * Updates the specified fields of an existing role.
   * Only the description can be updated - name is immutable.
   * Requires the 'roles:update' permission.
   *
   * @param id - The role's UUID
   * @param updateRoleDto - The fields to update
   * @returns The updated role
   */
  @Permissions('roles:update')
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const updatedRole = await this.rolesService.update(id, {
      description: updateRoleDto.description,
    });

    return RoleResponseDto.fromEntity(updatedRole);
  }

  /**
   * Delete a role
   *
   * Permanently removes a role from the system.
   * Requires the 'roles:delete' permission.
   *
   * @param id - The role's UUID
   */
  @Permissions('roles:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.rolesService.delete(id);
  }

  /**
   * Get permissions for a role
   *
   * Returns all permissions assigned to a specific role.
   * Requires the 'roles:read' permission.
   *
   * @param id - The role's UUID
   * @returns Array of permissions assigned to the role
   */
  @Permissions('roles:read')
  @Get(':id/permissions')
  async getPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PermissionResponseDto[]> {
    const permissions = await this.rolesService.getPermissions(id);
    return permissions.map((permission) => PermissionResponseDto.fromEntity(permission));
  }

  /**
   * Assign permissions to a role
   *
   * Replaces all existing permissions with the provided list.
   * Requires the 'roles:update' permission.
   *
   * @param id - The role's UUID
   * @param assignPermissionsDto - The permission IDs to assign
   * @returns The updated role with new permissions
   */
  @Permissions('roles:update')
  @Post(':id/permissions')
  async assignPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.assignPermissions(
      id,
      assignPermissionsDto.permissionIds,
    );

    return RoleResponseDto.fromEntity(role);
  }

  /**
   * Remove permissions from a role
   *
   * Removes the specified permissions from the role.
   * Requires the 'roles:update' permission.
   *
   * @param id - The role's UUID
   * @param assignPermissionsDto - The permission IDs to remove
   * @returns The updated role with permissions removed
   */
  @Permissions('roles:update')
  @Delete(':id/permissions')
  async removePermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.removePermissions(
      id,
      assignPermissionsDto.permissionIds,
    );

    return RoleResponseDto.fromEntity(role);
  }
}
