import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for updating an existing group
 * Only the description can be updated - name is immutable
 * to prevent breaking existing user-group associations
 */
export class UpdateGroupDto {
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
