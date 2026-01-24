import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { Prompt } from './entities/prompt.entity';
import { PromptVersion } from './entities/prompt-version.entity';

/**
 * Interface for creating a new prompt
 */
export interface CreatePromptData {
  name: string;
  description?: string;
  content: string;
  createdById: string;
}

/**
 * Interface for updating an existing prompt
 */
export interface UpdatePromptData {
  description?: string;
  content?: string;
  updatedById: string;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Interface for paginated results
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for prompt with its active version
 */
export interface PromptWithActiveVersion {
  prompt: Prompt;
  activeVersion: PromptVersion | null;
}

/**
 * PromptsService handles all prompt-related database operations.
 * Prompts are templates with version control capabilities.
 * Each update creates a new version record rather than modifying existing data.
 */
@Injectable()
export class PromptsService {
  constructor(
    @InjectRepository(Prompt)
    private readonly promptsRepository: Repository<Prompt>,
    @InjectRepository(PromptVersion)
    private readonly versionsRepository: Repository<PromptVersion>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Extract variables from content using {{ variable_name }} pattern
   * @param content - The template content
   * @returns Array of unique variable names
   */
  extractVariables(content: string): string[] {
    if (!content) {
      return [];
    }

    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const variables: Set<string> = new Set();
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Generate SHA-256 hash of content
   * @param content - The content to hash
   * @returns Hexadecimal hash string
   */
  generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Find all prompts with optional pagination
   * Returns prompts with their active versions
   * @param options - Pagination options
   * @returns Paginated list of prompts with active versions
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<PromptWithActiveVersion>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const [prompts, total] = await this.promptsRepository.findAndCount({
      skip,
      take: limit,
      order: { name: 'ASC' },
      relations: ['createdBy'],
    });

    // Fetch active versions for all prompts
    const data: PromptWithActiveVersion[] = await Promise.all(
      prompts.map(async (prompt) => {
        const activeVersion = await this.getActiveVersion(prompt.id);
        return { prompt, activeVersion };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a prompt by its ID with active version
   * @param id - The prompt's UUID
   * @returns The prompt with active version if found, null otherwise
   */
  async findById(id: string): Promise<PromptWithActiveVersion | null> {
    const prompt = await this.promptsRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!prompt) {
      return null;
    }

    const activeVersion = await this.getActiveVersion(id);
    return { prompt, activeVersion };
  }

  /**
   * Find a prompt by its name
   * @param name - The prompt name
   * @returns The prompt with active version if found, null otherwise
   */
  async findByName(name: string): Promise<PromptWithActiveVersion | null> {
    const prompt = await this.promptsRepository.findOne({
      where: { name: name.toLowerCase() },
      relations: ['createdBy'],
    });

    if (!prompt) {
      return null;
    }

    const activeVersion = await this.getActiveVersion(prompt.id);
    return { prompt, activeVersion };
  }

  /**
   * Get the active version for a prompt
   * @param promptId - The prompt's UUID
   * @returns The active version or null
   */
  async getActiveVersion(promptId: string): Promise<PromptVersion | null> {
    return this.versionsRepository.findOne({
      where: { promptId, isActive: true },
      relations: ['createdBy'],
    });
  }

  /**
   * Create a new prompt with initial version
   * @param data - The prompt data
   * @returns The created prompt with its version
   * @throws ConflictException if prompt name already exists
   */
  async create(data: CreatePromptData): Promise<PromptWithActiveVersion> {
    const normalizedName = data.name.toLowerCase();

    // Check if prompt with this name already exists
    const existingPrompt = await this.promptsRepository.findOne({
      where: { name: normalizedName },
    });
    if (existingPrompt) {
      throw new ConflictException(`A prompt with name '${normalizedName}' already exists`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create the prompt
      const prompt = queryRunner.manager.create(Prompt, {
        name: normalizedName,
        description: data.description,
        createdById: data.createdById,
      });
      const savedPrompt = await queryRunner.manager.save(prompt);

      // Create the initial version
      const version = queryRunner.manager.create(PromptVersion, {
        promptId: savedPrompt.id,
        version: 1,
        content: data.content,
        hash: this.generateHash(data.content),
        variables: this.extractVariables(data.content),
        isActive: true,
        createdById: data.createdById,
      });
      const savedVersion = await queryRunner.manager.save(version);

      await queryRunner.commitTransaction();

      // Fetch complete entities with relations
      const fullPrompt = await this.promptsRepository.findOne({
        where: { id: savedPrompt.id },
        relations: ['createdBy'],
      });

      const fullVersion = await this.versionsRepository.findOne({
        where: { id: savedVersion.id },
        relations: ['createdBy'],
      });

      return { prompt: fullPrompt!, activeVersion: fullVersion };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update an existing prompt
   * Creates a new version if content is changed
   * @param id - The prompt's UUID
   * @param data - The fields to update
   * @returns The updated prompt with new active version
   * @throws NotFoundException if prompt doesn't exist
   */
  async update(id: string, data: UpdatePromptData): Promise<PromptWithActiveVersion> {
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundException('Prompt not found');
    }

    const { prompt, activeVersion } = result;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update description if provided
      if (data.description !== undefined) {
        prompt.description = data.description;
        await queryRunner.manager.save(prompt);
      }

      // Create new version if content is provided
      if (data.content !== undefined) {
        const newVersionNumber = activeVersion ? activeVersion.version + 1 : 1;

        // Deactivate current active version
        if (activeVersion) {
          activeVersion.isActive = false;
          await queryRunner.manager.save(activeVersion);
        }

        // Create new version
        const newVersion = queryRunner.manager.create(PromptVersion, {
          promptId: id,
          version: newVersionNumber,
          content: data.content,
          hash: this.generateHash(data.content),
          variables: this.extractVariables(data.content),
          isActive: true,
          createdById: data.updatedById,
        });
        await queryRunner.manager.save(newVersion);
      }

      await queryRunner.commitTransaction();

      // Fetch updated entities
      return (await this.findById(id))!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a prompt by its ID
   * Cascades to delete all versions
   * @param id - The prompt's UUID
   * @throws NotFoundException if prompt doesn't exist
   */
  async delete(id: string): Promise<void> {
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundException('Prompt not found');
    }

    await this.promptsRepository.remove(result.prompt);
  }

  /**
   * Get all versions for a prompt
   * @param id - The prompt's UUID
   * @returns Array of versions ordered by version number (newest first)
   * @throws NotFoundException if prompt doesn't exist
   */
  async getVersionHistory(id: string): Promise<PromptVersion[]> {
    const prompt = await this.promptsRepository.findOne({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    return this.versionsRepository.find({
      where: { promptId: id },
      relations: ['createdBy'],
      order: { version: 'DESC' },
    });
  }

  /**
   * Rollback to a specific version
   * @param id - The prompt's UUID
   * @param targetVersion - The version number to rollback to
   * @returns The prompt with the now-active version
   * @throws NotFoundException if prompt doesn't exist
   * @throws BadRequestException if target version doesn't exist
   */
  async rollback(id: string, targetVersion: number): Promise<PromptWithActiveVersion> {
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundException('Prompt not found');
    }

    const { activeVersion } = result;

    // Find the target version
    const targetVersionEntity = await this.versionsRepository.findOne({
      where: { promptId: id, version: targetVersion },
      relations: ['createdBy'],
    });

    if (!targetVersionEntity) {
      throw new BadRequestException(`Version ${targetVersion} does not exist for this prompt`);
    }

    // If target is already active, return current state (no-op)
    if (targetVersionEntity.isActive) {
      return result;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Deactivate current active version
      if (activeVersion) {
        activeVersion.isActive = false;
        await queryRunner.manager.save(activeVersion);
      }

      // Activate target version
      targetVersionEntity.isActive = true;
      await queryRunner.manager.save(targetVersionEntity);

      await queryRunner.commitTransaction();

      // Fetch updated entities
      return (await this.findById(id))!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get a specific version of a prompt
   * @param promptId - The prompt's UUID
   * @param versionNumber - The version number
   * @returns The version if found, null otherwise
   */
  async getVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null> {
    return this.versionsRepository.findOne({
      where: { promptId, version: versionNumber },
      relations: ['createdBy'],
    });
  }

  /**
   * Check if a prompt exists by name
   * @param name - The prompt name to check
   * @returns true if prompt exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.promptsRepository.count({
      where: { name: name.toLowerCase() },
    });
    return count > 0;
  }
}
