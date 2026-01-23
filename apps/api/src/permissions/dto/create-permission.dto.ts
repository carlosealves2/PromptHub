import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for creating a new permission
 * Permissions follow the resource:action naming convention
 */
export class CreatePermissionDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Matches(/^[a-z]+:[a-z]+$/, {
    message:
      'Name must follow the resource:action format (e.g., users:read, posts:create)',
  })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsString({ message: 'Resource must be a string' })
  @IsNotEmpty({ message: 'Resource is required' })
  @MinLength(2, { message: 'Resource must be at least 2 characters long' })
  @MaxLength(50, { message: 'Resource must not exceed 50 characters' })
  @Matches(/^[a-z]+$/, {
    message: 'Resource must contain only lowercase letters (e.g., users, posts)',
  })
  resource: string;

  @IsString({ message: 'Action must be a string' })
  @IsNotEmpty({ message: 'Action is required' })
  @MinLength(2, { message: 'Action must be at least 2 characters long' })
  @MaxLength(50, { message: 'Action must not exceed 50 characters' })
  @Matches(/^[a-z]+$/, {
    message: 'Action must contain only lowercase letters (e.g., read, write, delete)',
  })
  action: string;
}
