import { IsInt, IsNotEmpty, Min } from 'class-validator';

/**
 * DTO for rolling back a prompt to a specific previous version
 * The specified version number must exist for the prompt
 */
export class RollbackPromptDto {
  @IsInt({ message: 'Version must be an integer' })
  @IsNotEmpty({ message: 'Version is required' })
  @Min(1, { message: 'Version must be at least 1' })
  version: number;
}
