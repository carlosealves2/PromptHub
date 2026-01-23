import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignGroupsDto {
  @IsArray({ message: 'groupIds must be an array' })
  @IsNotEmpty({ message: 'groupIds is required' })
  @IsUUID('4', { each: true, message: 'Each group ID must be a valid UUID' })
  groupIds: string[];
}
