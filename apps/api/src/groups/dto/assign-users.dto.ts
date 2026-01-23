import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO for assigning users to a group
 * Accepts an array of user IDs to assign
 */
export class AssignUsersDto {
  @IsArray({ message: 'userIds must be an array' })
  @IsNotEmpty({ message: 'userIds is required' })
  @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
  userIds: string[];
}
