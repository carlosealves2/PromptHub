import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Prompt } from './prompt.entity';

@Entity('prompt_versions')
export class PromptVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prompt, (prompt) => prompt.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prompt_id' })
  prompt: Prompt;

  @Column({ name: 'prompt_id' })
  promptId: string;

  @Column()
  version: number;

  @Column('text')
  content: string;

  @Column()
  hash: string; // SHA-256 hash of content

  @Column('simple-array')
  variables: string[]; // Extracted from content using {{ variable_name }} pattern

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
