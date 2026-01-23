import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g., 'users:read', 'users:write', 'posts:delete'

  @Column({ nullable: true })
  description: string;

  @Column()
  resource: string; // e.g., 'users', 'posts'

  @Column()
  action: string; // e.g., 'read', 'write', 'delete'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
