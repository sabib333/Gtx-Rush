import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@gtx-rush/config';
import * as schema from './schema';

/**
 * Database connection singleton.
 * Uses postgres.js for connection pooling.
 */

const env = getEnv();

const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
