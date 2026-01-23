import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prompt } from './entities/prompt.entity';
import { PromptVersion } from './entities/prompt-version.entity';
import { User } from '../users/entities/user.entity';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

/**
 * PromptsModule provides prompt management functionality with versioning.
 *
 * This module:
 * - Registers the Prompt and PromptVersion entities with TypeORM
 * - Provides PromptsController for REST API endpoints
 * - Provides PromptsService for prompt operations
 * - Exports PromptsService for use in other modules
 *
 * Prompts are text templates with variable placeholders ({{ variable_name }})
 * that support full version history tracking. Each content change creates
 * a new version, and users can rollback to any previous version.
 *
 * Endpoints:
 * - GET /prompts - List all prompts (requires prompts:read)
 * - GET /prompts/:id - Get prompt by ID with active version (requires prompts:read)
 * - POST /prompts - Create a new prompt (requires prompts:create)
 * - PATCH /prompts/:id - Update a prompt, creates new version (requires prompts:update)
 * - DELETE /prompts/:id - Delete a prompt and all versions (requires prompts:delete)
 * - GET /prompts/:id/versions - Get version history (requires prompts:read)
 * - POST /prompts/:id/rollback - Rollback to specific version (requires prompts:update)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Prompt, PromptVersion, User])],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
