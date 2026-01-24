import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for updating an existing prompt
 * Name is immutable - only description and content can be updated
 * Content changes create a new version record
 */
export class UpdatePromptDto {
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Content must be a string' })
  content?: string;
}
