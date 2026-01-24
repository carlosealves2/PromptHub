import { PromptVersion } from '../entities/prompt-version.entity';

/**
 * DTO for prompt version responses
 * Provides a consistent API response format for prompt version history data
 */
export class PromptVersionResponseDto {
  id!: string;
  promptId!: string;
  version!: number;
  content!: string;
  hash!: string;
  variables!: string[];
  isActive!: boolean;
  createdById!: string;
  createdAt!: Date;

  /**
   * Create a PromptVersionResponseDto from a PromptVersion entity
   * @param promptVersion - The prompt version entity to transform
   * @returns A PromptVersionResponseDto instance
   */
  static fromEntity(promptVersion: PromptVersion): PromptVersionResponseDto {
    const dto = new PromptVersionResponseDto();
    dto.id = promptVersion.id;
    dto.promptId = promptVersion.promptId;
    dto.version = promptVersion.version;
    dto.content = promptVersion.content;
    dto.hash = promptVersion.hash;
    dto.variables = promptVersion.variables || [];
    dto.isActive = promptVersion.isActive;
    dto.createdById = promptVersion.createdById;
    dto.createdAt = promptVersion.createdAt;
    return dto;
  }
}
