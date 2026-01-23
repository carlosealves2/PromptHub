import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';

/**
 * Interface for creating a new role
 */
export interface CreateRoleData {
  name: string;
  description?: string;
}

/**
 * Interface for updating an existing role
 */
export interface UpdateRoleData {
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
 * RolesService handles all role-related database operations.
 * Roles are collections of permissions that can be assigned to users.
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  /**
   * Find all roles with optional pagination
   * @param options - Pagination options
   * @returns Paginated list of roles
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Role>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.rolesRepository.findAndCount({
      skip,
      take: limit,
      order: { name: 'ASC' },
      relations: ['permissions'],
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
   * Find a role by its ID
   * @param id - The role's UUID
   * @returns The role if found, null otherwise
   */
  async findById(id: string): Promise<Role | null> {
    return this.rolesRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  /**
   * Find a role by its name
   * @param name - The role name (e.g., 'admin')
   * @returns The role if found, null otherwise
   */
  async findByName(name: string): Promise<Role | null> {
    return this.rolesRepository.findOne({
      where: { name: name.toLowerCase() },
      relations: ['permissions'],
    });
  }

  /**
   * Find multiple roles by their IDs
   * @param ids - Array of role UUIDs
   * @returns Array of found roles
   */
  async findByIds(ids: string[]): Promise<Role[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.rolesRepository.find({
      where: { id: In(ids) },
      relations: ['permissions'],
    });
  }

  /**
   * Find multiple roles by their names
   * @param names - Array of role names
   * @returns Array of found roles
   */
  async findByNames(names: string[]): Promise<Role[]> {
    if (!names || names.length === 0) {
      return [];
    }
    const lowercaseNames = names.map((n) => n.toLowerCase());
    return this.rolesRepository.find({
      where: { name: In(lowercaseNames) },
      relations: ['permissions'],
    });
  }

  /**
   * Create a new role
   * @param data - The role data
   * @returns The created role
   * @throws ConflictException if role name already exists
   */
  async create(data: CreateRoleData): Promise<Role> {
    const normalizedName = data.name.toLowerCase();

    // Check if role with this name already exists
    const existingRole = await this.findByName(normalizedName);
    if (existingRole) {
      throw new ConflictException(`A role with name '${normalizedName}' already exists`);
    }

    const role = this.rolesRepository.create({
      name: normalizedName,
      description: data.description,
      permissions: [],
    });

    return this.rolesRepository.save(role);
  }

  /**
   * Update an existing role
   * Only description can be updated - name is immutable
   * @param id - The role's UUID
   * @param data - The fields to update
   * @returns The updated role
   * @throws NotFoundException if role doesn't exist
   */
  async update(id: string, data: UpdateRoleData): Promise<Role> {
    const role = await this.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Only update description - name is immutable
    if (data.description !== undefined) {
      role.description = data.description;
    }

    return this.rolesRepository.save(role);
  }

  /**
   * Delete a role by its ID
   * @param id - The role's UUID
   * @throws NotFoundException if role doesn't exist
   */
  async delete(id: string): Promise<void> {
    const role = await this.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.rolesRepository.remove(role);
  }

  /**
   * Check if a role exists by name
   * @param name - The role name to check
   * @returns true if role exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.rolesRepository.count({
      where: { name: name.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Assign permissions to a role (replaces existing permissions)
   * @param roleId - The role's UUID
   * @param permissionIds - Array of permission UUIDs to assign
   * @returns The updated role with assigned permissions
   * @throws NotFoundException if role doesn't exist
   * @throws BadRequestException if any permission IDs are invalid
   */
  async assignPermissions(roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // If no permissions, clear all permissions from the role
    if (!permissionIds || permissionIds.length === 0) {
      role.permissions = [];
      return this.rolesRepository.save(role);
    }

    // Find all requested permissions
    const permissions = await this.permissionsRepository.findBy({
      id: In(permissionIds),
    });

    // Validate that all permission IDs were found
    if (permissions.length !== permissionIds.length) {
      const foundIds = new Set(permissions.map((p) => p.id));
      const invalidIds = permissionIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid permission IDs: ${invalidIds.join(', ')}`,
      );
    }

    role.permissions = permissions;
    return this.rolesRepository.save(role);
  }

  /**
   * Add permissions to a role (without removing existing ones)
   * @param roleId - The role's UUID
   * @param permissionIds - Array of permission UUIDs to add
   * @returns The updated role with added permissions
   * @throws NotFoundException if role doesn't exist
   * @throws BadRequestException if any permission IDs are invalid
   */
  async addPermissions(roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!permissionIds || permissionIds.length === 0) {
      return role;
    }

    // Find all requested permissions
    const permissions = await this.permissionsRepository.findBy({
      id: In(permissionIds),
    });

    // Validate that all permission IDs were found
    if (permissions.length !== permissionIds.length) {
      const foundIds = new Set(permissions.map((p) => p.id));
      const invalidIds = permissionIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid permission IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Merge existing permissions with new ones (avoid duplicates)
    const existingIds = new Set(role.permissions.map((p) => p.id));
    const newPermissions = permissions.filter((p) => !existingIds.has(p.id));
    role.permissions = [...role.permissions, ...newPermissions];

    return this.rolesRepository.save(role);
  }

  /**
   * Remove permissions from a role
   * @param roleId - The role's UUID
   * @param permissionIds - Array of permission UUIDs to remove
   * @returns The updated role with permissions removed
   * @throws NotFoundException if role doesn't exist
   */
  async removePermissions(roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!permissionIds || permissionIds.length === 0) {
      return role;
    }

    const idsToRemove = new Set(permissionIds);
    role.permissions = role.permissions.filter((p) => !idsToRemove.has(p.id));

    return this.rolesRepository.save(role);
  }

  /**
   * Get all permissions for a role
   * @param roleId - The role's UUID
   * @returns Array of permissions assigned to the role
   * @throws NotFoundException if role doesn't exist
   */
  async getPermissions(roleId: string): Promise<Permission[]> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role.permissions;
  }

  /**
   * Check if a role has a specific permission
   * @param roleId - The role's UUID
   * @param permissionName - The permission name (e.g., 'users:read')
   * @returns true if the role has the permission, false otherwise
   */
  async hasPermission(roleId: string, permissionName: string): Promise<boolean> {
    const role = await this.findById(roleId);
    if (!role) {
      return false;
    }

    return role.permissions.some(
      (p) => p.name.toLowerCase() === permissionName.toLowerCase(),
    );
  }

  /**
   * Create multiple roles at once (for seeding)
   * @param roles - Array of role data to create
   * @returns Array of created roles
   */
  async createMany(roles: CreateRoleData[]): Promise<Role[]> {
    const createdRoles: Role[] = [];

    for (const data of roles) {
      try {
        const role = await this.create(data);
        createdRoles.push(role);
      } catch (error) {
        // Skip duplicates during bulk creation
        if (error instanceof ConflictException) {
          const existing = await this.findByName(data.name);
          if (existing) {
            createdRoles.push(existing);
          }
        } else {
          throw error;
        }
      }
    }

    return createdRoles;
  }
}
