import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: configService.get<number>('DATABASE_PORT', 5432),
  username: configService.get<string>('DATABASE_USER', 'prompthub'),
  password: configService.get<string>('DATABASE_PASSWORD', ''),
  database: configService.get<string>('DATABASE_NAME', 'prompthub'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // IMPORTANT: Never use synchronize: true in production
  // Use migrations instead for production database changes
  synchronize: configService.get<string>('NODE_ENV', 'development') === 'development',
  logging: configService.get<string>('NODE_ENV', 'development') === 'development',
});

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions =>
    getDatabaseConfig(configService),
};
