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
import { PermissionsService, PaginatedResult, PaginationOptions } from './permissions.service';
import { Permissions } from '../auth/decorators';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponseDto,
} from './dto';

/**
 * Permissions Controller
 *
 * Handles all permission management REST endpoints with permission-based access control.
 * All endpoints require authentication and specific permissions.
 *
 * Permissions follow the resource:action naming convention (e.g., users:read, posts:create).
 *
 * Routes:
 * - GET /permissions - List all permissions (requires permissions:read)
 * - GET /permissions/:id - Get permission by ID (requires permissions:read)
 * - POST /permissions - Create a new permission (requires permissions:create)
 * - PATCH /permissions/:id - Update a permission (requires permissions:update)
 * - DELETE /permissions/:id - Delete a permission (requires permissions:delete)
 */
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * List all permissions with pagination
   *
   * Returns a paginated list of all permissions in the system.
   * Requires the 'permissions:read' permission.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated list of permissions
   */
  @Permissions('permissions:read')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<PermissionResponseDto>> {
    const options: PaginationOptions = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const result = await this.permissionsService.findAll(options);

    return {
      ...result,
      data: result.data.map((permission) => PermissionResponseDto.fromEntity(permission)),
    };
  }

  /**
   * Get a permission by ID
   *
   * Returns detailed information about a specific permission.
   * Requires the 'permissions:read' permission.
   *
   * @param id - The permission's UUID
   * @returns The permission details
   */
  @Permissions('permissions:read')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PermissionResponseDto> {
    const permission = await this.permissionsService.findById(id);

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return PermissionResponseDto.fromEntity(permission);
  }

  /**
   * Create a new permission
   *
   * Creates a new permission with the provided data.
   * Permission names must follow the resource:action format (e.g., users:read).
   * Requires the 'permissions:create' permission.
   *
   * @param createPermissionDto - The permission creation data
   * @returns The created permission
   */
  @Permissions('permissions:create')
  @Post()
  async create(@Body() createPermissionDto: CreatePermissionDto): Promise<PermissionResponseDto> {
    const permission = await this.permissionsService.create({
      name: createPermissionDto.name,
      resource: createPermissionDto.resource,
      action: createPermissionDto.action,
      description: createPermissionDto.description,
    });

    return PermissionResponseDto.fromEntity(permission);
  }

  /**
   * Update an existing permission
   *
   * Updates the specified fields of an existing permission.
   * Only the description can be updated - name, resource, and action are immutable.
   * Requires the 'permissions:update' permission.
   *
   * @param id - The permission's UUID
   * @param updatePermissionDto - The fields to update
   * @returns The updated permission
   */
  @Permissions('permissions:update')
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ): Promise<PermissionResponseDto> {
    const updatedPermission = await this.permissionsService.update(id, {
      description: updatePermissionDto.description,
    });

    return PermissionResponseDto.fromEntity(updatedPermission);
  }

  /**
   * Delete a permission
   *
   * Permanently removes a permission from the system.
   * Requires the 'permissions:delete' permission.
   *
   * @param id - The permission's UUID
   */
  @Permissions('permissions:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.permissionsService.delete(id);
  }
}
