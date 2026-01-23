import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for creating a new prompt
 * Prompts contain template content with optional {{ variable }} placeholders
 */
export class CreatePromptDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content is required' })
  content: string;
}
