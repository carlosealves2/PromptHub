import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  PromptsService,
  PaginatedResult,
  PaginationOptions,
  PromptWithActiveVersion,
} from './prompts.service';
import { Permissions, CurrentUser } from '../auth/decorators';
import {
  CreatePromptDto,
  UpdatePromptDto,
  RollbackPromptDto,
  PromptResponseDto,
  PromptVersionResponseDto,
} from './dto';

/**
 * Combined response interface for prompt with active version data
 * Merges prompt metadata with version content details
 */
interface PromptWithVersionResponse {
  id: string;
  name: string;
  description: string | null;
  content: string;
  version: number;
  hash: string;
  variables: string[];
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  versionCreatedAt: Date;
  versionCreatedById: string;
}

/**
 * Prompts Controller
 *
 * Handles all prompt management REST endpoints with permission-based access control.
 * All endpoints require authentication and specific permissions.
 *
 * Prompts are versioned templates that support variable placeholders.
 * Each update creates a new version record rather than modifying existing data.
 *
 * Routes:
 * - POST /prompts - Create a new prompt (requires prompts:create)
 * - GET /prompts - List all prompts (requires prompts:read)
 * - GET /prompts/:id - Get prompt by ID with active version (requires prompts:read)
 * - PATCH /prompts/:id - Update a prompt, creates new version (requires prompts:update)
 * - DELETE /prompts/:id - Delete a prompt and all versions (requires prompts:delete)
 * - GET /prompts/:id/versions - Get version history (requires prompts:read)
 * - POST /prompts/:id/rollback - Rollback to specific version (requires prompts:update)
 */
@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  /**
   * Transform a PromptWithActiveVersion into a combined response
   * @param data - The prompt with its active version
   * @returns Combined response with both prompt and version data
   */
  private toPromptWithVersionResponse(data: PromptWithActiveVersion): PromptWithVersionResponse {
    const { prompt, activeVersion } = data;

    return {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      content: activeVersion?.content ?? '',
      version: activeVersion?.version ?? 0,
      hash: activeVersion?.hash ?? '',
      variables: activeVersion?.variables ?? [],
      isActive: activeVersion?.isActive ?? false,
      createdById: prompt.createdById,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
      versionCreatedAt: activeVersion?.createdAt ?? prompt.createdAt,
      versionCreatedById: activeVersion?.createdById ?? prompt.createdById,
    };
  }

  /**
   * List all prompts with pagination
   *
   * Returns a paginated list of all prompts with their active versions.
   * Requires the 'prompts:read' permission.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated list of prompts with active version data
   */
  @Permissions('prompts:read')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<PromptWithVersionResponse>> {
    const options: PaginationOptions = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const result = await this.promptsService.findAll(options);

    return {
      ...result,
      data: result.data.map((item) => this.toPromptWithVersionResponse(item)),
    };
  }

  /**
   * Get a prompt by ID
   *
   * Returns detailed information about a specific prompt including its active version.
   * Requires the 'prompts:read' permission.
   *
   * @param id - The prompt's UUID
   * @returns The prompt details with active version data
   */
  @Permissions('prompts:read')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PromptWithVersionResponse> {
    const result = await this.promptsService.findById(id);

    if (!result) {
      throw new NotFoundException('Prompt not found');
    }

    return this.toPromptWithVersionResponse(result);
  }

  /**
   * Create a new prompt
   *
   * Creates a new prompt with the provided data and initial version.
   * Variables are automatically extracted from content using {{ variable_name }} pattern.
   * Content hash is generated using SHA-256 for integrity verification.
   * Requires the 'prompts:create' permission.
   *
   * @param userId - The authenticated user's ID (from JWT)
   * @param createPromptDto - The prompt creation data
   * @returns The created prompt with version information
   */
  @Permissions('prompts:create')
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() createPromptDto: CreatePromptDto,
  ): Promise<PromptWithVersionResponse> {
    const result = await this.promptsService.create({
      name: createPromptDto.name,
      description: createPromptDto.description,
      content: createPromptDto.content,
      createdById: userId,
    });

    return this.toPromptWithVersionResponse(result);
  }

  /**
   * Update an existing prompt
   *
   * Updates the specified fields of an existing prompt.
   * If content is changed, a new version is created and the previous version is deactivated.
   * Name is immutable - only description and content can be updated.
   * Requires the 'prompts:update' permission.
   *
   * @param id - The prompt's UUID
   * @param userId - The authenticated user's ID (from JWT)
   * @param updatePromptDto - The fields to update
   * @returns The updated prompt with new version information
   */
  @Permissions('prompts:update')
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId: string,
    @Body() updatePromptDto: UpdatePromptDto,
  ): Promise<PromptWithVersionResponse> {
    const result = await this.promptsService.update(id, {
      description: updatePromptDto.description,
      content: updatePromptDto.content,
      updatedById: userId,
    });

    return this.toPromptWithVersionResponse(result);
  }

  /**
   * Delete a prompt
   *
   * Permanently removes a prompt and all its versions from the system.
   * This action cascades to delete all version records.
   * Requires the 'prompts:delete' permission.
   *
   * @param id - The prompt's UUID
   */
  @Permissions('prompts:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.promptsService.delete(id);
  }

  /**
   * Get version history for a prompt
   *
   * Returns all versions for a specific prompt, ordered by version number (newest first).
   * Includes version number, content, hash, variables, active status, and timestamps.
   * Requires the 'prompts:read' permission.
   *
   * @param id - The prompt's UUID
   * @returns Array of versions for the prompt
   */
  @Permissions('prompts:read')
  @Get(':id/versions')
  async getVersions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PromptVersionResponseDto[]> {
    const versions = await this.promptsService.getVersionHistory(id);
    return versions.map((version) => PromptVersionResponseDto.fromEntity(version));
  }

  /**
   * Rollback to a specific version
   *
   * Reverts the prompt to a specific previous version by changing active flags.
   * Sets the target version to active and the current active version to inactive.
   * Does not delete any version records - maintains full history.
   * If the target version is already active, this is a no-op.
   * Requires the 'prompts:update' permission.
   *
   * @param id - The prompt's UUID
   * @param rollbackDto - The target version number to rollback to
   * @returns The prompt with the now-active version
   */
  @Permissions('prompts:update')
  @Post(':id/rollback')
  async rollback(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() rollbackDto: RollbackPromptDto,
  ): Promise<PromptWithVersionResponse> {
    const result = await this.promptsService.rollback(id, rollbackDto.version);
    return this.toPromptWithVersionResponse(result);
  }
}
