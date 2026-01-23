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
import { GroupsService, PaginatedResult, PaginationOptions } from './groups.service';
import { Permissions } from '../auth/decorators';
import { RoleResponseDto } from '../roles/dto';
import { UserResponseDto } from '../users/dto';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AssignUsersDto,
  AssignRolesToGroupDto,
  GroupResponseDto,
} from './dto';

/**
 * Groups Controller
 *
 * Handles all group management REST endpoints with permission-based access control.
 * All endpoints require authentication and specific permissions.
 *
 * Groups are collections of users that can be assigned roles,
 * allowing for easier management of permissions across multiple users.
 *
 * Routes:
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
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * List all groups with pagination
   *
   * Returns a paginated list of all groups in the system.
   * Requires the 'groups:read' permission.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated list of groups
   */
  @Permissions('groups:read')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<GroupResponseDto>> {
    const options: PaginationOptions = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const result = await this.groupsService.findAll(options);

    return {
      ...result,
      data: result.data.map((group) => GroupResponseDto.fromEntity(group)),
    };
  }

  /**
   * Get a group by ID
   *
   * Returns detailed information about a specific group including its roles.
   * Requires the 'groups:read' permission.
   *
   * @param id - The group's UUID
   * @returns The group details with roles
   */
  @Permissions('groups:read')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<GroupResponseDto> {
    const group = await this.groupsService.findById(id);

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return GroupResponseDto.fromEntity(group);
  }

  /**
   * Create a new group
   *
   * Creates a new group with the provided data.
   * Group names should be lowercase, alphanumeric with optional underscores.
   * Requires the 'groups:create' permission.
   *
   * @param createGroupDto - The group creation data
   * @returns The created group
   */
  @Permissions('groups:create')
  @Post()
  async create(@Body() createGroupDto: CreateGroupDto): Promise<GroupResponseDto> {
    const group = await this.groupsService.create({
      name: createGroupDto.name,
      description: createGroupDto.description,
    });

    return GroupResponseDto.fromEntity(group);
  }

  /**
   * Update an existing group
   *
   * Updates the specified fields of an existing group.
   * Only the description can be updated - name is immutable.
   * Requires the 'groups:update' permission.
   *
   * @param id - The group's UUID
   * @param updateGroupDto - The fields to update
   * @returns The updated group
   */
  @Permissions('groups:update')
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    const updatedGroup = await this.groupsService.update(id, {
      description: updateGroupDto.description,
    });

    return GroupResponseDto.fromEntity(updatedGroup);
  }

  /**
   * Delete a group
   *
   * Permanently removes a group from the system.
   * Requires the 'groups:delete' permission.
   *
   * @param id - The group's UUID
   */
  @Permissions('groups:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.groupsService.delete(id);
  }

  /**
   * Get roles for a group
   *
   * Returns all roles assigned to a specific group.
   * Requires the 'groups:read' permission.
   *
   * @param id - The group's UUID
   * @returns Array of roles assigned to the group
   */
  @Permissions('groups:read')
  @Get(':id/roles')
  async getRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RoleResponseDto[]> {
    const roles = await this.groupsService.getRoles(id);
    return roles.map((role) => RoleResponseDto.fromEntity(role));
  }

  /**
   * Assign roles to a group
   *
   * Replaces all existing roles with the provided list.
   * Requires the 'groups:update' permission.
   *
   * @param id - The group's UUID
   * @param assignRolesDto - The role IDs to assign
   * @returns The updated group with new roles
   */
  @Permissions('groups:update')
  @Post(':id/roles')
  async assignRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignRolesDto: AssignRolesToGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.groupsService.assignRoles(
      id,
      assignRolesDto.roleIds,
    );

    return GroupResponseDto.fromEntity(group);
  }

  /**
   * Remove roles from a group
   *
   * Removes the specified roles from a group without affecting other roles.
   * Requires the 'groups:update' permission.
   *
   * @param id - The group's UUID
   * @param assignRolesDto - The role IDs to remove
   * @returns The updated group
   */
  @Permissions('groups:update')
  @Delete(':id/roles')
  async removeRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignRolesDto: AssignRolesToGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.groupsService.removeRoles(
      id,
      assignRolesDto.roleIds,
    );

    return GroupResponseDto.fromEntity(group);
  }

  /**
   * Get users in a group
   *
   * Returns all users that belong to a specific group.
   * Requires the 'groups:read' permission.
   *
   * @param id - The group's UUID
   * @returns Array of users in the group
   */
  @Permissions('groups:read')
  @Get(':id/users')
  async getUsers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponseDto[]> {
    const users = await this.groupsService.getUsers(id);
    return users.map((user) => UserResponseDto.fromEntity(user));
  }

  /**
   * Assign users to a group
   *
   * Replaces all existing users with the provided list.
   * Requires the 'groups:update' permission.
   *
   * @param id - The group's UUID
   * @param assignUsersDto - The user IDs to assign
   * @returns The updated group
   */
  @Permissions('groups:update')
  @Post(':id/users')
  async assignUsers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignUsersDto: AssignUsersDto,
  ): Promise<GroupResponseDto> {
    const group = await this.groupsService.assignUsers(
      id,
      assignUsersDto.userIds,
    );

    return GroupResponseDto.fromEntity(group);
  }

  /**
   * Remove users from a group
   *
   * Removes the specified users from a group without affecting other users.
   * Requires the 'groups:update' permission.
   *
   * @param id - The group's UUID
   * @param assignUsersDto - The user IDs to remove
   * @returns The updated group
   */
  @Permissions('groups:update')
  @Delete(':id/users')
  async removeUsers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignUsersDto: AssignUsersDto,
  ): Promise<GroupResponseDto> {
    const group = await this.groupsService.removeUsers(
      id,
      assignUsersDto.userIds,
    );

    return GroupResponseDto.fromEntity(group);
  }
}
