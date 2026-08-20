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
  // SAFE DEFAULT: only synchronize if explicitly set to 'true' in env
  // Never default to true — it destroys existing data on Supabase
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  // Force search_path=public on every connection to fix Supabase pgbouncer issue
  // where the pooler does not set search_path automatically, causing
  // 'relation "user" does not exist' errors on unqualified table names.
  extra: {
    options: '-c search_path=public',
  },

  ssl:
    process.env.DB_SSL === 'true' || process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : false, // Required for Supabase/Neon
}));