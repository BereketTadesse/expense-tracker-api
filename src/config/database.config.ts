// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || process.env.host || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.port || '5432', 10),
  username: process.env.DB_USERNAME || process.env.user || 'postgres',
  password: process.env.DB_PASSWORD || process.env.password || '',
  database: process.env.DB_NAME || process.env.database || 'expense_tracker',
  autoLoadEntities: true,
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
  ssl:
    process.env.DB_SSL === 'true' || process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : false, // Required for Supabase/Neon
}));