import {
  IsArray,
  IsNotEmpty,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

/**
 * DTO for assigning permissions to a role
 * Accepts an array of permission IDs to assign
 */
export class AssignPermissionsDto {
  @IsArray({ message: 'Permission IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least one permission ID is required' })
  @IsUUID('4', { each: true, message: 'Each permission ID must be a valid UUID' })
  @IsNotEmpty({ each: true, message: 'Permission IDs cannot be empty' })
  permissionIds: string[];
}
