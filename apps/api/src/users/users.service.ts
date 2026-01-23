import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Group } from '../groups/entities/group.entity';

/**
 * Interface for creating a new user
 */
export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Interface for updating an existing user
 */
export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
  refreshTokenHash?: string | null;
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
 * UsersService handles all user-related database operations.
 * This service is used by AuthService for authentication operations
 * and provides full CRUD operations for user management endpoints.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
  ) {}

  /**
   * Find all users with optional pagination
   * @param options - Pagination options
   * @returns Paginated list of users
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.usersRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['roles', 'groups'],
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
   * Find a user by their email address
   * @param email - The email address to search for
   * @returns The user if found, null otherwise
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find a user by their ID
   * @param id - The user's UUID
   * @returns The user if found, null otherwise
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find a user by ID with their roles and permissions loaded
   * @param id - The user's UUID
   * @returns The user with roles (and their permissions) loaded
   */
  async findByIdWithRoles(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions', 'groups', 'groups.roles'],
    });
  }

  /**
   * Create a new user
   * @param data - The user data (password should already be hashed)
   * @returns The created user
   * @throws ConflictException if email already exists
   */
  async create(data: CreateUserData): Promise<User> {
    // Check if user with this email already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = this.usersRepository.create({
      email: data.email.toLowerCase(),
      password: data.password, // Should be pre-hashed by AuthService
      name: data.name,
      isActive: true,
    });

    return this.usersRepository.save(user);
  }

  /**
   * Update an existing user
   * @param id - The user's UUID
   * @param data - The fields to update
   * @returns The updated user
   * @throws NotFoundException if user doesn't exist
   */
  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If email is being updated, check for uniqueness
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }
      data.email = data.email.toLowerCase();
    }

    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  /**
   * Delete a user by their ID
   * @param id - The user's UUID
   * @throws NotFoundException if user doesn't exist
   */
  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.remove(user);
  }

  /**
   * Update the refresh token hash for a user
   * Used during login/refresh to store the hashed refresh token
   * @param id - The user's UUID
   * @param refreshTokenHash - The hashed refresh token (or null to clear)
   */
  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await this.usersRepository.update(id, { refreshTokenHash });
  }

  /**
   * Check if a user exists by email
   * @param email - The email address to check
   * @returns true if user exists, false otherwise
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.usersRepository.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Assign roles to a user (replaces existing roles)
   * @param userId - The user's UUID
   * @param roleIds - Array of role UUIDs to assign
   * @returns The updated user with roles
   * @throws NotFoundException if user or any role doesn't exist
   */
  async assignRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!roleIds || roleIds.length === 0) {
      // Clear all roles
      user.roles = [];
      return this.usersRepository.save(user);
    }

    // Fetch all roles by their IDs
    const roles = await this.rolesRepository.findBy({ id: In(roleIds) });

    // Verify all requested roles were found
    if (roles.length !== roleIds.length) {
      const foundIds = roles.map((r) => r.id);
      const missingIds = roleIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Roles not found: ${missingIds.join(', ')}`);
    }

    user.roles = roles;
    return this.usersRepository.save(user);
  }

  /**
   * Add roles to a user (preserves existing roles)
   * @param userId - The user's UUID
   * @param roleIds - Array of role UUIDs to add
   * @returns The updated user with roles
   * @throws NotFoundException if user or any role doesn't exist
   */
  async addRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!roleIds || roleIds.length === 0) {
      return user;
    }

    // Fetch roles to add
    const rolesToAdd = await this.rolesRepository.findBy({ id: In(roleIds) });

    // Verify all requested roles were found
    if (rolesToAdd.length !== roleIds.length) {
      const foundIds = rolesToAdd.map((r) => r.id);
      const missingIds = roleIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Roles not found: ${missingIds.join(', ')}`);
    }

    // Merge existing roles with new ones (avoid duplicates)
    const existingRoleIds = user.roles.map((r) => r.id);
    const newRoles = rolesToAdd.filter((r) => !existingRoleIds.includes(r.id));
    user.roles = [...user.roles, ...newRoles];

    return this.usersRepository.save(user);
  }

  /**
   * Remove roles from a user
   * @param userId - The user's UUID
   * @param roleIds - Array of role UUIDs to remove
   * @returns The updated user with remaining roles
   * @throws NotFoundException if user doesn't exist
   */
  async removeRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!roleIds || roleIds.length === 0) {
      return user;
    }

    // Filter out the roles to be removed
    user.roles = user.roles.filter((role) => !roleIds.includes(role.id));
    return this.usersRepository.save(user);
  }

  /**
   * Assign groups to a user (replaces existing groups)
   * @param userId - The user's UUID
   * @param groupIds - Array of group UUIDs to assign
   * @returns The updated user with groups
   * @throws NotFoundException if user or any group doesn't exist
   */
  async assignGroups(userId: string, groupIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['groups'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!groupIds || groupIds.length === 0) {
      // Clear all groups
      user.groups = [];
      return this.usersRepository.save(user);
    }

    // Fetch all groups by their IDs
    const groups = await this.groupsRepository.findBy({ id: In(groupIds) });

    // Verify all requested groups were found
    if (groups.length !== groupIds.length) {
      const foundIds = groups.map((g) => g.id);
      const missingIds = groupIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Groups not found: ${missingIds.join(', ')}`);
    }

    user.groups = groups;
    return this.usersRepository.save(user);
  }

  /**
   * Add groups to a user (preserves existing groups)
   * @param userId - The user's UUID
   * @param groupIds - Array of group UUIDs to add
   * @returns The updated user with groups
   * @throws NotFoundException if user or any group doesn't exist
   */
  async addGroups(userId: string, groupIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['groups'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!groupIds || groupIds.length === 0) {
      return user;
    }

    // Fetch groups to add
    const groupsToAdd = await this.groupsRepository.findBy({ id: In(groupIds) });

    // Verify all requested groups were found
    if (groupsToAdd.length !== groupIds.length) {
      const foundIds = groupsToAdd.map((g) => g.id);
      const missingIds = groupIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Groups not found: ${missingIds.join(', ')}`);
    }

    // Merge existing groups with new ones (avoid duplicates)
    const existingGroupIds = user.groups.map((g) => g.id);
    const newGroups = groupsToAdd.filter((g) => !existingGroupIds.includes(g.id));
    user.groups = [...user.groups, ...newGroups];

    return this.usersRepository.save(user);
  }

  /**
   * Remove groups from a user
   * @param userId - The user's UUID
   * @param groupIds - Array of group UUIDs to remove
   * @returns The updated user with remaining groups
   * @throws NotFoundException if user doesn't exist
   */
  async removeGroups(userId: string, groupIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['groups'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!groupIds || groupIds.length === 0) {
      return user;
    }

    // Filter out the groups to be removed
    user.groups = user.groups.filter((group) => !groupIds.includes(group.id));
    return this.usersRepository.save(user);
  }

  /**
   * Get all permissions for a user (from direct roles and group roles)
   * @param userId - The user's UUID
   * @returns Array of unique permission names
   * @throws NotFoundException if user doesn't exist
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.findByIdWithRoles(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissionSet = new Set<string>();

    // Get permissions from direct roles
    for (const role of user.roles || []) {
      for (const permission of role.permissions || []) {
        permissionSet.add(permission.name);
      }
    }

    // Get permissions from group roles
    for (const group of user.groups || []) {
      for (const role of group.roles || []) {
        for (const permission of role.permissions || []) {
          permissionSet.add(permission.name);
        }
      }
    }

    return Array.from(permissionSet);
  }

  /**
   * Check if a user has a specific role
   * @param userId - The user's UUID
   * @param roleName - The role name to check
   * @returns true if user has the role, false otherwise
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const user = await this.findByIdWithRoles(userId);

    if (!user) {
      return false;
    }

    // Check direct roles
    const hasDirectRole = user.roles?.some((role) => role.name === roleName);
    if (hasDirectRole) {
      return true;
    }

    // Check group roles
    for (const group of user.groups || []) {
      if (group.roles?.some((role) => role.name === roleName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a user has a specific permission
   * @param userId - The user's UUID
   * @param permissionName - The permission name to check
   * @returns true if user has the permission, false otherwise
   */
  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionName);
  }
}
