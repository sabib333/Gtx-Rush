import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

/**
 * Run database migrations.
 * Usage: pnpm --filter @gtx-rush/api db:migrate
 */
async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
