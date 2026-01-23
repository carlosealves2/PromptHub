import { Group } from '../entities/group.entity';
import { RoleResponseDto } from '../../roles/dto';

/**
 * DTO for group responses
 * Provides a consistent API response format for group data
 */
export class GroupResponseDto {
  id: string;
  name: string;
  description: string | null;
  roles: RoleResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  /**
   * Create a GroupResponseDto from a Group entity
   * @param group - The group entity to transform
   * @returns A GroupResponseDto instance
   */
  static fromEntity(group: Group): GroupResponseDto {
    const dto = new GroupResponseDto();
    dto.id = group.id;
    dto.name = group.name;
    dto.description = group.description;
    dto.roles = group.roles?.map((r) => RoleResponseDto.fromEntity(r)) || [];
    dto.createdAt = group.createdAt;
    dto.updatedAt = group.updatedAt;
    return dto;
  }
}
