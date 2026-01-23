import { Prompt } from '../entities/prompt.entity';

/**
 * DTO for prompt responses
 * Provides a consistent API response format for prompt data
 */
export class PromptResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  createdById!: string;
  createdAt!: Date;
  updatedAt!: Date;

  /**
   * Create a PromptResponseDto from a Prompt entity
   * @param prompt - The prompt entity to transform
   * @returns A PromptResponseDto instance
   */
  static fromEntity(prompt: Prompt): PromptResponseDto {
    const dto = new PromptResponseDto();
    dto.id = prompt.id;
    dto.name = prompt.name;
    dto.description = prompt.description;
    dto.createdById = prompt.createdById;
    dto.createdAt = prompt.createdAt;
    dto.updatedAt = prompt.updatedAt;
    return dto;
  }
}
