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
  Put,
  Query,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService, PaginatedResult, PaginationOptions } from './users.service';
import { Permissions } from '../auth/decorators';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  AssignRolesDto,
  AssignGroupsDto,
} from './dto';

/**
 * Number of bcrypt salt rounds for password hashing
 * 12 rounds is recommended for 2026+ as per spec
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Users Controller
 *
 * Handles all user management REST endpoints with permission-based access control.
 * All endpoints require authentication and specific permissions.
 *
 * Routes:
 * - GET /users - List all users (requires users:read)
 * - GET /users/:id - Get user by ID (requires users:read)
 * - POST /users - Create a new user (requires users:create)
 * - PATCH /users/:id - Update a user (requires users:update)
 * - DELETE /users/:id - Delete a user (requires users:delete)
 * - PUT /users/:id/roles - Assign roles to a user (requires users:update)
 * - PUT /users/:id/groups - Assign groups to a user (requires users:update)
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List all users with pagination
   *
   * Returns a paginated list of all users in the system.
   * Requires the 'users:read' permission.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated list of users
   */
  @Permissions('users:read')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const options: PaginationOptions = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const result = await this.usersService.findAll(options);

    return {
      ...result,
      data: result.data.map((user) => UserResponseDto.fromEntity(user)),
    };
  }

  /**
   * Get a user by ID
   *
   * Returns detailed information about a specific user including their roles and groups.
   * Requires the 'users:read' permission.
   *
   * @param id - The user's UUID
   * @returns The user details
   */
  @Permissions('users:read')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdWithRoles(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }

  /**
   * Create a new user
   *
   * Creates a new user with the provided data. Password will be securely hashed.
   * Optionally assigns roles and groups if provided.
   * Requires the 'users:create' permission.
   *
   * @param createUserDto - The user creation data
   * @returns The created user
   */
  @Permissions('users:create')
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_SALT_ROUNDS);

    // Create the user
    const user = await this.usersService.create({
      email: createUserDto.email,
      password: hashedPassword,
      name: createUserDto.name,
    });

    // Update isActive status if provided
    let updatedUser = user;
    if (createUserDto.isActive !== undefined) {
      updatedUser = await this.usersService.update(user.id, {
        isActive: createUserDto.isActive,
      });
    }

    // Assign roles if provided
    if (createUserDto.roleIds && createUserDto.roleIds.length > 0) {
      updatedUser = await this.usersService.assignRoles(updatedUser.id, createUserDto.roleIds);
    }

    // Assign groups if provided
    if (createUserDto.groupIds && createUserDto.groupIds.length > 0) {
      updatedUser = await this.usersService.assignGroups(updatedUser.id, createUserDto.groupIds);
    }

    // Reload user with all relations
    const finalUser = await this.usersService.findByIdWithRoles(updatedUser.id);
    return UserResponseDto.fromEntity(finalUser!);
  }

  /**
   * Update an existing user
   *
   * Updates the specified fields of an existing user.
   * If password is provided, it will be securely hashed.
   * Requires the 'users:update' permission.
   *
   * @param id - The user's UUID
   * @param updateUserDto - The fields to update
   * @returns The updated user
   */
  @Permissions('users:update')
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Build update data
    const updateData: {
      email?: string;
      password?: string;
      name?: string;
      isActive?: boolean;
    } = {};

    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.name !== undefined) {
      updateData.name = updateUserDto.name;
    }

    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    // Hash password if provided
    if (updateUserDto.password !== undefined) {
      updateData.password = await bcrypt.hash(updateUserDto.password, BCRYPT_SALT_ROUNDS);
    }

    const updatedUser = await this.usersService.update(id, updateData);

    // Reload user with all relations
    const finalUser = await this.usersService.findByIdWithRoles(updatedUser.id);
    return UserResponseDto.fromEntity(finalUser!);
  }

  /**
   * Delete a user
   *
   * Permanently removes a user from the system.
   * Requires the 'users:delete' permission.
   *
   * @param id - The user's UUID
   */
  @Permissions('users:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.usersService.delete(id);
  }

  /**
   * Assign roles to a user
   *
   * Replaces all existing roles with the provided roles.
   * To add roles without removing existing ones, use the service's addRoles method.
   * Requires the 'users:update' permission.
   *
   * @param id - The user's UUID
   * @param assignRolesDto - The role IDs to assign
   * @returns The updated user with new roles
   */
  @Permissions('users:update')
  @Put(':id/roles')
  async assignRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignRolesDto: AssignRolesDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.assignRoles(id, assignRolesDto.roleIds);

    // Reload user with all relations
    const finalUser = await this.usersService.findByIdWithRoles(user.id);
    return UserResponseDto.fromEntity(finalUser!);
  }

  /**
   * Assign groups to a user
   *
   * Replaces all existing groups with the provided groups.
   * To add groups without removing existing ones, use the service's addGroups method.
   * Requires the 'users:update' permission.
   *
   * @param id - The user's UUID
   * @param assignGroupsDto - The group IDs to assign
   * @returns The updated user with new groups
   */
  @Permissions('users:update')
  @Put(':id/groups')
  async assignGroups(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() assignGroupsDto: AssignGroupsDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.assignGroups(id, assignGroupsDto.groupIds);

    // Reload user with all relations
    const finalUser = await this.usersService.findByIdWithRoles(user.id);
    return UserResponseDto.fromEntity(finalUser!);
  }
}
