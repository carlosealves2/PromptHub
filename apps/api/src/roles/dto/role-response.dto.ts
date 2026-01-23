import { Role } from '../entities/role.entity';
import { PermissionResponseDto } from '../../permissions/dto';

/**
 * DTO for role responses
 * Provides a consistent API response format for role data
 */
export class RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  /**
   * Create a RoleResponseDto from a Role entity
   * @param role - The role entity to transform
   * @returns A RoleResponseDto instance
   */
  static fromEntity(role: Role): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role.id;
    dto.name = role.name;
    dto.description = role.description;
    dto.permissions = role.permissions?.map((p) => PermissionResponseDto.fromEntity(p)) || [];
    dto.createdAt = role.createdAt;
    dto.updatedAt = role.updatedAt;
    return dto;
  }
}
