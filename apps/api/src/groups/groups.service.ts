import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Group } from './entities/group.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

/**
 * Interface for creating a new group
 */
export interface CreateGroupData {
  name: string;
  description?: string;
}

/**
 * Interface for updating an existing group
 */
export interface UpdateGroupData {
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
 * GroupsService handles all group-related database operations.
 * Groups are collections of users that can be assigned roles,
 * allowing for easier management of permissions across multiple users.
 */
@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Find all groups with optional pagination
   * @param options - Pagination options
   * @returns Paginated list of groups
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<Group>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.groupsRepository.findAndCount({
      skip,
      take: limit,
      order: { name: 'ASC' },
      relations: ['roles'],
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
   * Find a group by its ID
   * @param id - The group's UUID
   * @returns The group if found, null otherwise
   */
  async findById(id: string): Promise<Group | null> {
    return this.groupsRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  /**
   * Find a group by its name
   * @param name - The group name (e.g., 'developers')
   * @returns The group if found, null otherwise
   */
  async findByName(name: string): Promise<Group | null> {
    return this.groupsRepository.findOne({
      where: { name: name.toLowerCase() },
      relations: ['roles'],
    });
  }

  /**
   * Find multiple groups by their IDs
   * @param ids - Array of group UUIDs
   * @returns Array of found groups
   */
  async findByIds(ids: string[]): Promise<Group[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.groupsRepository.find({
      where: { id: In(ids) },
      relations: ['roles'],
    });
  }

  /**
   * Find multiple groups by their names
   * @param names - Array of group names
   * @returns Array of found groups
   */
  async findByNames(names: string[]): Promise<Group[]> {
    if (!names || names.length === 0) {
      return [];
    }
    const lowercaseNames = names.map((n) => n.toLowerCase());
    return this.groupsRepository.find({
      where: { name: In(lowercaseNames) },
      relations: ['roles'],
    });
  }

  /**
   * Create a new group
   * @param data - The group data
   * @returns The created group
   * @throws ConflictException if group name already exists
   */
  async create(data: CreateGroupData): Promise<Group> {
    const normalizedName = data.name.toLowerCase();

    // Check if group with this name already exists
    const existingGroup = await this.findByName(normalizedName);
    if (existingGroup) {
      throw new ConflictException(`A group with name '${normalizedName}' already exists`);
    }

    const group = this.groupsRepository.create({
      name: normalizedName,
      description: data.description,
      roles: [],
    });

    return this.groupsRepository.save(group);
  }

  /**
   * Update an existing group
   * Only description can be updated - name is immutable
   * @param id - The group's UUID
   * @param data - The fields to update
   * @returns The updated group
   * @throws NotFoundException if group doesn't exist
   */
  async update(id: string, data: UpdateGroupData): Promise<Group> {
    const group = await this.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only update description - name is immutable
    if (data.description !== undefined) {
      group.description = data.description;
    }

    return this.groupsRepository.save(group);
  }

  /**
   * Delete a group by its ID
   * @param id - The group's UUID
   * @throws NotFoundException if group doesn't exist
   */
  async delete(id: string): Promise<void> {
    const group = await this.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.groupsRepository.remove(group);
  }

  /**
   * Check if a group exists by name
   * @param name - The group name to check
   * @returns true if group exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.groupsRepository.count({
      where: { name: name.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Assign roles to a group (replaces existing roles)
   * @param groupId - The group's UUID
   * @param roleIds - Array of role UUIDs to assign
   * @returns The updated group with assigned roles
   * @throws NotFoundException if group doesn't exist
   * @throws BadRequestException if any role IDs are invalid
   */
  async assignRoles(groupId: string, roleIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // If no roles, clear all roles from the group
    if (!roleIds || roleIds.length === 0) {
      group.roles = [];
      return this.groupsRepository.save(group);
    }

    // Find all requested roles
    const roles = await this.rolesRepository.findBy({
      id: In(roleIds),
    });

    // Validate that all role IDs were found
    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.id));
      const invalidIds = roleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid role IDs: ${invalidIds.join(', ')}`,
      );
    }

    group.roles = roles;
    return this.groupsRepository.save(group);
  }

  /**
   * Add roles to a group (without removing existing ones)
   * @param groupId - The group's UUID
   * @param roleIds - Array of role UUIDs to add
   * @returns The updated group with added roles
   * @throws NotFoundException if group doesn't exist
   * @throws BadRequestException if any role IDs are invalid
   */
  async addRoles(groupId: string, roleIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!roleIds || roleIds.length === 0) {
      return group;
    }

    // Find all requested roles
    const roles = await this.rolesRepository.findBy({
      id: In(roleIds),
    });

    // Validate that all role IDs were found
    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.id));
      const invalidIds = roleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid role IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Merge existing roles with new ones (avoid duplicates)
    const existingIds = new Set(group.roles.map((r) => r.id));
    const newRoles = roles.filter((r) => !existingIds.has(r.id));
    group.roles = [...group.roles, ...newRoles];

    return this.groupsRepository.save(group);
  }

  /**
   * Remove roles from a group
   * @param groupId - The group's UUID
   * @param roleIds - Array of role UUIDs to remove
   * @returns The updated group with roles removed
   * @throws NotFoundException if group doesn't exist
   */
  async removeRoles(groupId: string, roleIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!roleIds || roleIds.length === 0) {
      return group;
    }

    const idsToRemove = new Set(roleIds);
    group.roles = group.roles.filter((r) => !idsToRemove.has(r.id));

    return this.groupsRepository.save(group);
  }

  /**
   * Get all roles for a group
   * @param groupId - The group's UUID
   * @returns Array of roles assigned to the group
   * @throws NotFoundException if group doesn't exist
   */
  async getRoles(groupId: string): Promise<Role[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group.roles;
  }

  /**
   * Assign users to a group (replaces existing users in this group)
   * Note: The user-group relationship is owned by the User entity,
   * so we update users to add them to this group.
   * @param groupId - The group's UUID
   * @param userIds - Array of user UUIDs to assign
   * @returns The group (users are not loaded in group entity)
   * @throws NotFoundException if group doesn't exist
   * @throws BadRequestException if any user IDs are invalid
   */
  async assignUsers(groupId: string, userIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // First, remove this group from all users who currently have it
    const usersWithGroup = await this.usersRepository.find({
      where: { groups: { id: groupId } },
      relations: ['groups'],
    });

    for (const user of usersWithGroup) {
      user.groups = user.groups.filter((g) => g.id !== groupId);
      await this.usersRepository.save(user);
    }

    // If no users, we're done (group has been removed from all users)
    if (!userIds || userIds.length === 0) {
      return group;
    }

    // Find all requested users
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      relations: ['groups'],
    });

    // Validate that all user IDs were found
    if (users.length !== userIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const invalidIds = userIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid user IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Add this group to each user
    for (const user of users) {
      const existingGroupIds = user.groups.map((g) => g.id);
      if (!existingGroupIds.includes(groupId)) {
        user.groups.push(group);
        await this.usersRepository.save(user);
      }
    }

    return group;
  }

  /**
   * Add users to a group (without removing existing users)
   * @param groupId - The group's UUID
   * @param userIds - Array of user UUIDs to add
   * @returns The group
   * @throws NotFoundException if group doesn't exist
   * @throws BadRequestException if any user IDs are invalid
   */
  async addUsers(groupId: string, userIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!userIds || userIds.length === 0) {
      return group;
    }

    // Find all requested users
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      relations: ['groups'],
    });

    // Validate that all user IDs were found
    if (users.length !== userIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const invalidIds = userIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid user IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Add this group to each user who doesn't already have it
    for (const user of users) {
      const existingGroupIds = user.groups.map((g) => g.id);
      if (!existingGroupIds.includes(groupId)) {
        user.groups.push(group);
        await this.usersRepository.save(user);
      }
    }

    return group;
  }

  /**
   * Remove users from a group
   * @param groupId - The group's UUID
   * @param userIds - Array of user UUIDs to remove
   * @returns The group
   * @throws NotFoundException if group doesn't exist
   */
  async removeUsers(groupId: string, userIds: string[]): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!userIds || userIds.length === 0) {
      return group;
    }

    // Find users to remove from this group
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      relations: ['groups'],
    });

    // Remove this group from each user
    for (const user of users) {
      user.groups = user.groups.filter((g) => g.id !== groupId);
      await this.usersRepository.save(user);
    }

    return group;
  }

  /**
   * Get all users in a group
   * @param groupId - The group's UUID
   * @returns Array of users in the group
   * @throws NotFoundException if group doesn't exist
   */
  async getUsers(groupId: string): Promise<User[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.usersRepository.find({
      where: { groups: { id: groupId } },
      relations: ['groups', 'roles'],
    });
  }

  /**
   * Check if a group has a specific role
   * @param groupId - The group's UUID
   * @param roleName - The role name (e.g., 'admin')
   * @returns true if the group has the role, false otherwise
   */
  async hasRole(groupId: string, roleName: string): Promise<boolean> {
    const group = await this.findById(groupId);
    if (!group) {
      return false;
    }

    return group.roles.some(
      (r) => r.name.toLowerCase() === roleName.toLowerCase(),
    );
  }

  /**
   * Create multiple groups at once (for seeding)
   * @param groups - Array of group data to create
   * @returns Array of created groups
   */
  async createMany(groups: CreateGroupData[]): Promise<Group[]> {
    const createdGroups: Group[] = [];

    for (const data of groups) {
      try {
        const group = await this.create(data);
        createdGroups.push(group);
      } catch (error) {
        // Skip duplicates during bulk creation
        if (error instanceof ConflictException) {
          const existing = await this.findByName(data.name);
          if (existing) {
            createdGroups.push(existing);
          }
        } else {
          throw error;
        }
      }
    }

    return createdGroups;
  }
}
