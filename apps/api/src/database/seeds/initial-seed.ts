import { DataSource, DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { Group } from '../../groups/entities/group.entity';

// Load environment variables
config();

/**
 * Database seed script for initial admin user and permissions.
 *
 * This script creates:
 * - All necessary permissions for the RBAC system
 * - Admin role with all permissions
 * - Default user role with limited permissions
 * - Initial admin user with the admin role
 *
 * Usage:
 *   npx ts-node apps/api/src/database/seeds/initial-seed.ts
 *
 * Or via npm script (if configured):
 *   npm run seed
 */

// Permission definitions organized by resource
const PERMISSION_DEFINITIONS = [
  // Users permissions
  { resource: 'users', action: 'read', description: 'View user information' },
  { resource: 'users', action: 'create', description: 'Create new users' },
  { resource: 'users', action: 'update', description: 'Update user information' },
  { resource: 'users', action: 'delete', description: 'Delete users' },

  // Roles permissions
  { resource: 'roles', action: 'read', description: 'View role information' },
  { resource: 'roles', action: 'create', description: 'Create new roles' },
  { resource: 'roles', action: 'update', description: 'Update role information' },
  { resource: 'roles', action: 'delete', description: 'Delete roles' },

  // Permissions permissions
  {
    resource: 'permissions',
    action: 'read',
    description: 'View permission information',
  },
  {
    resource: 'permissions',
    action: 'create',
    description: 'Create new permissions',
  },
  {
    resource: 'permissions',
    action: 'update',
    description: 'Update permission information',
  },
  {
    resource: 'permissions',
    action: 'delete',
    description: 'Delete permissions',
  },

  // Groups permissions
  { resource: 'groups', action: 'read', description: 'View group information' },
  { resource: 'groups', action: 'create', description: 'Create new groups' },
  { resource: 'groups', action: 'update', description: 'Update group information' },
  { resource: 'groups', action: 'delete', description: 'Delete groups' },
];

// Role definitions
const ROLE_DEFINITIONS = [
  {
    name: 'admin',
    description: 'Administrator with full system access',
    permissionPatterns: ['*'], // All permissions
  },
  {
    name: 'user',
    description: 'Default user role with basic access',
    permissionPatterns: [], // No permissions by default - users can only access their own profile
  },
  {
    name: 'moderator',
    description: 'Moderator with user and group management access',
    permissionPatterns: [
      'users:read',
      'users:update',
      'groups:read',
      'groups:update',
    ],
  },
];

// Initial admin user configuration
const INITIAL_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@prompthub.local',
  password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  name: process.env.ADMIN_NAME || 'System Administrator',
};

/**
 * Creates the TypeORM DataSource for seeding
 */
function createDataSource(): DataSource {
  const options: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'prompthub',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'prompthub',
    entities: [User, Role, Permission, Group],
    synchronize: false, // Never auto-sync in seed scripts
    logging: process.env.NODE_ENV === 'development',
  };

  return new DataSource(options);
}

/**
 * Seeds all permissions into the database
 */
async function seedPermissions(dataSource: DataSource): Promise<Permission[]> {
  const permissionRepository = dataSource.getRepository(Permission);
  const permissions: Permission[] = [];

  for (const def of PERMISSION_DEFINITIONS) {
    const name = `${def.resource}:${def.action}`;

    // Check if permission already exists
    let permission = await permissionRepository.findOne({ where: { name } });

    if (!permission) {
      permission = permissionRepository.create({
        name,
        resource: def.resource,
        action: def.action,
        description: def.description,
      });
      permission = await permissionRepository.save(permission);
      console.log(`  ✓ Created permission: ${name}`);
    } else {
      console.log(`  - Permission exists: ${name}`);
    }

    permissions.push(permission);
  }

  return permissions;
}

/**
 * Seeds all roles into the database
 */
async function seedRoles(
  dataSource: DataSource,
  allPermissions: Permission[]
): Promise<Map<string, Role>> {
  const roleRepository = dataSource.getRepository(Role);
  const roleMap = new Map<string, Role>();

  for (const def of ROLE_DEFINITIONS) {
    // Check if role already exists
    let role = await roleRepository.findOne({
      where: { name: def.name },
      relations: ['permissions'],
    });

    // Determine which permissions this role should have
    let rolePermissions: Permission[];
    if (def.permissionPatterns.includes('*')) {
      // Admin gets all permissions
      rolePermissions = allPermissions;
    } else {
      // Other roles get specific permissions
      rolePermissions = allPermissions.filter((p) =>
        def.permissionPatterns.includes(p.name)
      );
    }

    if (!role) {
      role = roleRepository.create({
        name: def.name,
        description: def.description,
        permissions: rolePermissions,
      });
      role = await roleRepository.save(role);
      console.log(`  ✓ Created role: ${def.name} with ${rolePermissions.length} permissions`);
    } else {
      // Update existing role with permissions if needed
      const existingPermissionNames = new Set(role.permissions.map((p) => p.name));
      const newPermissionNames = new Set(rolePermissions.map((p) => p.name));

      const needsUpdate =
        existingPermissionNames.size !== newPermissionNames.size ||
        [...newPermissionNames].some((name) => !existingPermissionNames.has(name));

      if (needsUpdate) {
        role.permissions = rolePermissions;
        role = await roleRepository.save(role);
        console.log(`  ↻ Updated role: ${def.name} with ${rolePermissions.length} permissions`);
      } else {
        console.log(`  - Role exists: ${def.name}`);
      }
    }

    roleMap.set(def.name, role);
  }

  return roleMap;
}

/**
 * Seeds the initial admin user
 */
async function seedAdminUser(
  dataSource: DataSource,
  adminRole: Role
): Promise<User | null> {
  const userRepository = dataSource.getRepository(User);

  // Check if admin user already exists
  let adminUser = await userRepository.findOne({
    where: { email: INITIAL_ADMIN.email },
    relations: ['roles'],
  });

  if (adminUser) {
    // Ensure admin user has the admin role
    const hasAdminRole = adminUser.roles.some((r) => r.name === 'admin');
    if (!hasAdminRole) {
      adminUser.roles.push(adminRole);
      adminUser = await userRepository.save(adminUser);
      console.log(`  ↻ Added admin role to existing user: ${INITIAL_ADMIN.email}`);
    } else {
      console.log(`  - Admin user exists: ${INITIAL_ADMIN.email}`);
    }
    return adminUser;
  }

  // Hash the password (12 rounds as recommended for 2026+)
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(INITIAL_ADMIN.password, saltRounds);

  // Create the admin user
  adminUser = userRepository.create({
    email: INITIAL_ADMIN.email,
    password: hashedPassword,
    name: INITIAL_ADMIN.name,
    isActive: true,
    roles: [adminRole],
  });

  adminUser = await userRepository.save(adminUser);
  console.log(`  ✓ Created admin user: ${INITIAL_ADMIN.email}`);
  console.log(`    Password: ${INITIAL_ADMIN.password} (CHANGE THIS IMMEDIATELY!)`);

  return adminUser;
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Database Seed Script - PromptHub RBAC System');
  console.log('='.repeat(60));

  const dataSource = createDataSource();

  try {
    console.log('\n[1/4] Connecting to database...');
    await dataSource.initialize();
    console.log('  ✓ Connected successfully');

    console.log('\n[2/4] Seeding permissions...');
    const permissions = await seedPermissions(dataSource);
    console.log(`  Total: ${permissions.length} permissions`);

    console.log('\n[3/4] Seeding roles...');
    const roleMap = await seedRoles(dataSource, permissions);
    console.log(`  Total: ${roleMap.size} roles`);

    console.log('\n[4/4] Seeding admin user...');
    const adminRole = roleMap.get('admin');
    if (adminRole) {
      await seedAdminUser(dataSource, adminRole);
    } else {
      throw new Error('Admin role not found after seeding');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Seed completed successfully!');
    console.log('='.repeat(60));

    // Print summary
    console.log('\nSummary:');
    console.log(`  - Permissions: ${permissions.length}`);
    console.log(`  - Roles: ${roleMap.size}`);
    console.log(`  - Admin user: ${INITIAL_ADMIN.email}`);

    console.log('\nNext steps:');
    console.log('  1. Change the admin password immediately');
    console.log('  2. Configure ADMIN_EMAIL, ADMIN_PASSWORD env vars for custom setup');
    console.log('  3. Start the API: npx nx serve api\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed.');
    }
  }
}

// Run the seed if this script is executed directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed, PERMISSION_DEFINITIONS, ROLE_DEFINITIONS };
