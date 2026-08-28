/**
 * GTX Rush — Competition System Database Schema
 *
 * Drizzle ORM schema definitions for the competitive ranking platform.
 * Extends the base schema with seasons, tiers, badges, titles, and rewards.
 *
 * DO NOT generate migrations yet — this is the schema definition.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users, badges } from './schema';

// ============================================================
// Enums
// ============================================================

export const seasonStatusEnum = pgEnum('season_status', [
  'upcoming', 'active', 'ended', 'archived',
]);

export const tierNameEnum = pgEnum('tier_name', [
  'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'legend',
]);

export const rankSnapshotTypeEnum = pgEnum('rank_snapshot_type', [
  'daily', 'weekly', 'season_end',
]);

export const badgeCategoryEnum = pgEnum('badge_category', [
  'gameplay', 'social', 'progression', 'competition', 'special',
]);

export const badgeRarityEnumV2 = pgEnum('badge_rarity_v2', [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
]);

export const rewardSourceEnum = pgEnum('reward_source', [
  'season_reward', 'badge_reward', 'tier_reward', 'level_reward',
]);

export const profileVisibilityEnum = pgEnum('profile_visibility', [
  'public', 'friends', 'private',
]);

// ============================================================
// Seasons
// ============================================================

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: integer('number').notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description').default(''),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  status: seasonStatusEnum('status').notNull().default('upcoming'),
  configuration: jsonb('configuration').$type<{
    scoringFormula: {
      bestScoresWeight: number;
      challengeWinsWeight: number;
      dailyParticipationWeight: number;
      xpEarnedWeight: number;
    };
    dailyChallengeWeight: number;
    challengeWinWeight: number;
    xpWeight: number;
    maxDailyScoresPerGame: number;
    [key: string]: unknown;
  }>().default({
    scoringFormula: {
      bestScoresWeight: 0.6,
      challengeWinsWeight: 0.2,
      dailyParticipationWeight: 0.1,
      xpEarnedWeight: 0.1,
    },
    dailyChallengeWeight: 0.2,
    challengeWinWeight: 0.2,
    xpWeight: 0.1,
    maxDailyScoresPerGame: 3,
  }),
  rewardConfiguration: jsonb('reward_configuration').$type<{
    tiers: Array<{
      minRank: number;
      maxRank: number | null;
      xp: number;
      badgeId?: string;
      titleId?: string;
      cosmeticId?: string;
    }>;
  }>().default({ tiers: [] }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_seasons_status').on(table.status),
  index('idx_seasons_dates').on(table.startsAt, table.endsAt),
]);

// ============================================================
// Season Rankings
// ============================================================

export const seasonRankings = pgTable('season_rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  score: bigint('score', { mode: 'number' }).notNull().default(0),
  rank: integer('rank').notNull().default(0),
  breakdown: jsonb('breakdown').$type<{
    bestScores: number;
    challengeWins: number;
    dailyParticipation: number;
    xpEarned: number;
    total: number;
  }>().default({
    bestScores: 0,
    challengeWins: 0,
    dailyParticipation: 0,
    xpEarned: 0,
    total: 0,
  }),
  lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_season_rankings_season_user').on(table.seasonId, table.userId),
  index('idx_season_rankings_season_score').on(table.seasonId, table.score),
  index('idx_season_rankings_season_rank').on(table.seasonId, table.rank),
]);

// ============================================================
// Rank Snapshots
// ============================================================

export const rankSnapshots = pgTable('rank_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  snapshotType: rankSnapshotTypeEnum('snapshot_type').notNull(),
  periodId: varchar('period_id', { length: 128 }).notNull(),
  globalRank: integer('global_rank'),
  countryRank: integer('country_rank'),
  gameRank: jsonb('game_rank').$type<Record<string, number>>().default({}),
  score: bigint('score', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_rank_snapshots_user_type').on(table.userId, table.snapshotType),
  index('idx_rank_snapshots_period').on(table.snapshotType, table.periodId),
  uniqueIndex('idx_rank_snapshots_user_period').on(table.userId, table.snapshotType, table.periodId),
]);

// ============================================================
// Tier Definitions (stored for admin configurability)
// ============================================================

export const tierDefinitions = pgTable('tier_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  displayName: varchar('display_name', { length: 64 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  minScore: bigint('min_score', { mode: 'number' }).notNull().default(0),
  maxScore: bigint('max_score', { mode: 'number' }),
  iconUrl: text('icon_url').default(''),
  color: varchar('color', { length: 16 }).default('#666666'),
  divisions: jsonb('divisions').$type<Array<{
    division: number;
    displayName: string;
    minScore: number;
    maxScore: number | null;
  }>>().default([
    { division: 1, displayName: 'I', minScore: 0, maxScore: 100 },
    { division: 2, displayName: 'II', minScore: 100, maxScore: 200 },
    { division: 3, displayName: 'III', minScore: 200, maxScore: null },
  ]),
  promotionThreshold: bigint('promotion_threshold', { mode: 'number' }).notNull().default(0),
  demotionThreshold: bigint('demotion_threshold', { mode: 'number' }).notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// User Tiers (per season)
// ============================================================

export const userTiers = pgTable('user_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  tierName: varchar('tier_name', { length: 32 }).notNull().default('bronze'),
  division: integer('division').notNull().default(1),
  score: bigint('score', { mode: 'number' }).notNull().default(0),
  promotionThreshold: bigint('promotion_threshold', { mode: 'number' }).notNull().default(0),
  demotionThreshold: bigint('demotion_threshold', { mode: 'number' }).notNull().default(0),
  promotedAt: timestamp('promoted_at'),
  demotedAt: timestamp('demoted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_user_tiers_season_user').on(table.seasonId, table.userId),
  index('idx_user_tiers_user').on(table.userId),
]);

// ============================================================
// User Badges (extended from existing)
// ============================================================

export const userBadgesV2 = pgTable('user_badges_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  badgeId: uuid('badge_id').notNull().references(() => badges.id),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
  isViewed: boolean('is_viewed').notNull().default(false),
}, (table) => [
  uniqueIndex('idx_user_badges_v2_user_badge').on(table.userId, table.badgeId),
]);

// ============================================================
// Titles
// ============================================================

export const titles = pgTable('titles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  category: varchar('category', { length: 32 }).notNull(),
  rarity: varchar('rarity', { length: 16 }).notNull().default('common'),
  iconUrl: text('icon_url').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// User Titles
// ============================================================

export const userTitles = pgTable('user_titles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  titleId: uuid('title_id').notNull().references(() => titles.id),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  isEquipped: boolean('is_equipped').notNull().default(false),
}, (table) => [
  uniqueIndex('idx_user_titles_user_title').on(table.userId, table.titleId),
  index('idx_user_titles_user_equipped').on(table.userId, table.isEquipped),
]);

// ============================================================
// Reward Transactions
// ============================================================

export const rewardTransactions = pgTable('reward_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  source: rewardSourceEnum('source').notNull(),
  referenceId: varchar('reference_id', { length: 128 }).notNull(),
  referenceType: varchar('reference_type', { length: 32 }).notNull(),
  xp: integer('xp').notNull().default(0),
  titleId: uuid('title_id'),
  cosmeticId: uuid('cosmetic_id'),
  badgeId: uuid('badge_id'),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  claimedAt: timestamp('claimed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_reward_transactions_user_created').on(table.userId, table.createdAt),
  index('idx_reward_transactions_source').on(table.source, table.referenceId),
]);

// ============================================================
// User Profile Extensions
// ============================================================

export const userProfileExtensions = pgTable('user_profile_extensions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  visibility: profileVisibilityEnum('visibility').notNull().default('public'),
  equippedTitleId: uuid('equipped_title_id').references(() => titles.id),
  bestGlobalRank: integer('best_global_rank'),
  bestSeasonRank: integer('best_season_rank'),
  bestSeasonId: uuid('best_season_id').references(() => seasons.id),
  totalWins: integer('total_wins').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
