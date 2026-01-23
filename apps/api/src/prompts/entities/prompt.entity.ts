import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Forward reference - PromptVersion will be created in subtask-1-2
// Using string literal for circular dependency resolution
@Entity('prompts')
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @OneToMany('PromptVersion', 'prompt', { cascade: true })
  versions: any[]; // Will be typed as PromptVersion[] once the entity is created

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
