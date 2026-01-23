import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Permission } from './entities/permission.entity';

/**
 * Interface for creating a new permission
 */
export interface CreatePermissionData {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 * Interface for updating an existing permission
 */
export interface UpdatePermissionData {
  description?: string;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Interface for paginated results
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * PermissionsService handles all permission-related database operations.
 * Permissions follow the resource:action naming convention (e.g., users:read, posts:create).
 */
@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  /**
   * Find all permissions with optional pagination
   * @param options - Pagination options
   * @returns Paginated list of permissions
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Permission>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.permissionsRepository.findAndCount({
      skip,
      take: limit,
      order: { resource: 'ASC', action: 'ASC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a permission by its ID
   * @param id - The permission's UUID
   * @returns The permission if found, null otherwise
   */
  async findById(id: string): Promise<Permission | null> {
    return this.permissionsRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find a permission by its name
   * @param name - The permission name (e.g., 'users:read')
   * @returns The permission if found, null otherwise
   */
  async findByName(name: string): Promise<Permission | null> {
    return this.permissionsRepository.findOne({
      where: { name: name.toLowerCase() },
    });
  }

  /**
   * Find permissions by resource
   * @param resource - The resource name (e.g., 'users')
   * @returns Array of permissions for the resource
   */
  async findByResource(resource: string): Promise<Permission[]> {
    return this.permissionsRepository.find({
      where: { resource: resource.toLowerCase() },
      order: { action: 'ASC' },
    });
  }

  /**
   * Find multiple permissions by their IDs
   * @param ids - Array of permission UUIDs
   * @returns Array of found permissions
   */
  async findByIds(ids: string[]): Promise<Permission[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.permissionsRepository.findBy({ id: In(ids) });
  }

  /**
   * Find multiple permissions by their names
   * @param names - Array of permission names
   * @returns Array of found permissions
   */
  async findByNames(names: string[]): Promise<Permission[]> {
    if (!names || names.length === 0) {
      return [];
    }
    const lowercaseNames = names.map((n) => n.toLowerCase());
    return this.permissionsRepository.findBy({ name: In(lowercaseNames) });
  }

  /**
   * Create a new permission
   * @param data - The permission data
   * @returns The created permission
   * @throws ConflictException if permission name already exists
   * @throws BadRequestException if name doesn't match resource:action format
   */
  async create(data: CreatePermissionData): Promise<Permission> {
    const normalizedName = data.name.toLowerCase();
    const normalizedResource = data.resource.toLowerCase();
    const normalizedAction = data.action.toLowerCase();

    // Validate that name matches resource:action format
    const expectedName = `${normalizedResource}:${normalizedAction}`;
    if (normalizedName !== expectedName) {
      throw new BadRequestException(
        `Permission name must match resource:action format. Expected '${expectedName}', got '${normalizedName}'`,
      );
    }

    // Check if permission with this name already exists
    const existingPermission = await this.findByName(normalizedName);
    if (existingPermission) {
      throw new ConflictException(`A permission with name '${normalizedName}' already exists`);
    }

    const permission = this.permissionsRepository.create({
      name: normalizedName,
      resource: normalizedResource,
      action: normalizedAction,
      description: data.description,
    });

    return this.permissionsRepository.save(permission);
  }

  /**
   * Update an existing permission
   * Only description can be updated - name, resource, and action are immutable
   * @param id - The permission's UUID
   * @param data - The fields to update
   * @returns The updated permission
   * @throws NotFoundException if permission doesn't exist
   */
  async update(id: string, data: UpdatePermissionData): Promise<Permission> {
    const permission = await this.findById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Only update description - name/resource/action are immutable
    if (data.description !== undefined) {
      permission.description = data.description;
    }

    return this.permissionsRepository.save(permission);
  }

  /**
   * Delete a permission by its ID
   * @param id - The permission's UUID
   * @throws NotFoundException if permission doesn't exist
   */
  async delete(id: string): Promise<void> {
    const permission = await this.findById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.permissionsRepository.remove(permission);
  }

  /**
   * Check if a permission exists by name
   * @param name - The permission name to check
   * @returns true if permission exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.permissionsRepository.count({
      where: { name: name.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Create multiple permissions at once (for seeding)
   * @param permissions - Array of permission data to create
   * @returns Array of created permissions
   */
  async createMany(permissions: CreatePermissionData[]): Promise<Permission[]> {
    const createdPermissions: Permission[] = [];

    for (const data of permissions) {
      try {
        const permission = await this.create(data);
        createdPermissions.push(permission);
      } catch (error) {
        // Skip duplicates during bulk creation
        if (error instanceof ConflictException) {
          const existing = await this.findByName(data.name);
          if (existing) {
            createdPermissions.push(existing);
          }
        } else {
          throw error;
        }
      }
    }

    return createdPermissions;
  }

  /**
   * Get all unique resources
   * @returns Array of unique resource names
   */
  async getResources(): Promise<string[]> {
    const result = await this.permissionsRepository
      .createQueryBuilder('permission')
      .select('DISTINCT permission.resource', 'resource')
      .orderBy('permission.resource', 'ASC')
      .getRawMany();

    return result.map((r) => r.resource);
  }

  /**
   * Get all actions for a specific resource
   * @param resource - The resource name
   * @returns Array of action names for the resource
   */
  async getActionsForResource(resource: string): Promise<string[]> {
    const permissions = await this.findByResource(resource);
    return permissions.map((p) => p.action);
  }
}
