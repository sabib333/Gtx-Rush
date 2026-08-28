/**
 * Database seed script for development.
 * Seeds games, levels, and basic configuration.
 * Usage: pnpm --filter @gtx-rush/api db:seed
 */

import { db } from './index';
import { games, levels } from './schema';
import { GAME_LIST } from '@gtx-rush/config';
import { LEVELS } from '@gtx-rush/config';

async function main() {
  console.log('Seeding database...');

  // Seed games
  for (const game of GAME_LIST) {
    await db
      .insert(games)
      .values({
        slug: game.id,
        name: game.name,
        description: game.description,
        config: game.sessionConfig,
      })
      .onConflictDoNothing({ target: games.slug });
  }
  console.log(`Seeded ${GAME_LIST.length} games`);

  // Seed levels
  for (const level of LEVELS) {
    await db
      .insert(levels)
      .values({
        level: level.level,
        xpRequired: level.xpRequired,
        title: level.title,
        rewards: level.rewards as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: levels.level });
  }
  console.log(`Seeded ${LEVELS.length} levels`);

  console.log('Seeding complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
