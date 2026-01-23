import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for updating an existing permission
 * Only the description can be updated - name, resource, and action are immutable
 * to prevent breaking existing role-permission associations
 */
export class UpdatePermissionDto {
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
