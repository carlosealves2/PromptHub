import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO for assigning roles to a group
 * Accepts an array of role IDs to assign
 */
export class AssignRolesToGroupDto {
  @IsArray({ message: 'roleIds must be an array' })
  @IsNotEmpty({ message: 'roleIds is required' })
  @IsUUID('4', { each: true, message: 'Each role ID must be a valid UUID' })
  roleIds: string[];
}
