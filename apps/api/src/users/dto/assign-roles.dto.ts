import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsArray({ message: 'roleIds must be an array' })
  @IsNotEmpty({ message: 'roleIds is required' })
  @IsUUID('4', { each: true, message: 'Each role ID must be a valid UUID' })
  roleIds: string[];
}
