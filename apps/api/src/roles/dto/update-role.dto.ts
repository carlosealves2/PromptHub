import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for updating an existing role
 * Only the description can be updated - name is immutable
 * to prevent breaking existing user-role associations
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
