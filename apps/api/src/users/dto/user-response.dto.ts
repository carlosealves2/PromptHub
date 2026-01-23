import { User } from '../entities/user.entity';

export class RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
}

export class GroupResponseDto {
  id: string;
  name: string;
  description: string | null;
}

export class UserResponseDto {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  roles: RoleResponseDto[];
  groups: GroupResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.isActive = user.isActive;
    dto.roles = (user.roles || []).map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
    }));
    dto.groups = (user.groups || []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
    }));
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
