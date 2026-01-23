import { Permission } from '../entities/permission.entity';

/**
 * DTO for permission responses
 * Provides a consistent API response format for permission data
 */
export class PermissionResponseDto {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Create a PermissionResponseDto from a Permission entity
   * @param permission - The permission entity to transform
   * @returns A PermissionResponseDto instance
   */
  static fromEntity(permission: Permission): PermissionResponseDto {
    const dto = new PermissionResponseDto();
    dto.id = permission.id;
    dto.name = permission.name;
    dto.resource = permission.resource;
    dto.action = permission.action;
    dto.description = permission.description;
    dto.createdAt = permission.createdAt;
    dto.updatedAt = permission.updatedAt;
    return dto;
  }
}
