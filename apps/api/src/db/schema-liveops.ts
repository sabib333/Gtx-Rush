/**
 * GTX Rush — LiveOps Database Schema v1.0
 *
 * Drizzle ORM schema definitions for the LiveOps system.
 * Covers seasons, battle passes, missions, events, community goals, and related tables.
 *
 * DO NOT generate migrations yet — this is the schema definition.
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================================
// Enums
// ============================================================

export const liveOpsSeasonStatusEnum = pgEnum('liveops_season_status', [
  'draft', 'scheduled', 'active', 'ending', 'ended', 'archived',
]);

export const battlePassStatusEnum = pgEnum('battle_pass_status', [
  'active', 'purchased', 'expired',
]);

export const missionCategoryEnum = pgEnum('mission_category', [
  'daily', 'weekly', 'seasonal', 'event', 'special', 'community',
]);

export const liveOpsMissionStatusEnum = pgEnum('liveops_mission_status', [
  'locked', 'active', 'completed', 'claimed', 'expired',
]);

export const missionRerollStatusEnum = pgEnum('mission_reroll_status', [
  'available', 'rerolled', 'locked',
]);

export const liveOpsEventStatusEnum = pgEnum('liveops_event_status', [
  'draft', 'scheduled', 'active', 'ending', 'completed', 'archived', 'cancelled',
]);

export const communityGoalStatusEnum = pgEnum('community_goal_status', [
  'active', 'completed', 'expired',
]);

// ============================================================
// LiveOps Seasons
// ============================================================

export const liveOpsSeasons = pgTable('liveops_seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: liveOpsSeasonStatusEnum('status').notNull().default('draft'),
  theme: varchar('theme', { length: 64 }).notNull().default('default'),
  bannerUrl: text('banner_url'),
  rewardTrack: jsonb('reward_track').$type<{
    levels: Array<{
      level: number;
      xpRequired: number;
      freeReward: { type: string; value: string | number; name: string; description: string; rarity: string; itemId: string | null } | null;
      premiumReward: { type: string; value: string | number; name: string; description: string; rarity: string; itemId: string | null } | null;
    }>;
    totalLevels: number;
  }>().default({ levels: [], totalLevels: 50 }),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_liveops_seasons_status').on(table.status),
  index('idx_liveops_seasons_start_end').on(table.startTime, table.endTime),
]);

// ============================================================
// Season Progression
// ============================================================

export const seasonProgressions = pgTable('season_progressions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  seasonId: uuid('season_id').notNull().references(() => liveOpsSeasons.id),
  seasonXp: bigint('season_xp', { mode: 'number' }).notNull().default(0),
  seasonLevel: integer('season_level').notNull().default(1),
  totalXpEarned: bigint('total_xp_earned', { mode: 'number' }).notNull().default(0),
  lastXpAwardedAt: timestamp('last_xp_awarded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_season_progressions_user_season').on(table.userId, table.seasonId),
  index('idx_season_progressions_season_level').on(table.seasonId, table.seasonLevel),
]);

// ============================================================
// Season XP Transactions
// ============================================================

export const seasonXpTransactions = pgTable('season_xp_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  seasonId: uuid('season_id').notNull().references(() => liveOpsSeasons.id),
  amount: integer('amount').notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  referenceId: varchar('reference_id', { length: 128 }),
  referenceType: varchar('reference_type', { length: 32 }),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_season_xp_transactions_user_season').on(table.userId, table.seasonId, table.createdAt),
]);

// ============================================================
// Battle Pass
// ============================================================

export const battlePasses = pgTable('battle_passes', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => liveOpsSeasons.id).unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  priceStars: integer('price_stars').notNull().default(500),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================
// Battle Pass Purchases
// ============================================================

export const battlePassPurchases = pgTable('battle_pass_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  battlePassId: uuid('battle_pass_id').notNull().references(() => battlePasses.id),
  seasonId: uuid('season_id').notNull().references(() => liveOpsSeasons.id),
  status: battlePassStatusEnum('status').notNull().default('active'),
  telegramPaymentId: varchar('telegram_payment_id', { length: 128 }),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  purchasedAt: timestamp('purchased_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  uniqueIndex('idx_battle_pass_purchases_user_season').on(table.userId, table.seasonId),
  index('idx_battle_pass_purchases_status').on(table.status),
]);

// ============================================================
// Battle Pass Reward Claims
// ============================================================

export const battlePassRewardClaims = pgTable('battle_pass_reward_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  seasonId: uuid('season_id').notNull().references(() => liveOpsSeasons.id),
  level: integer('level').notNull(),
  track: varchar('track', { length: 16 }).notNull(), // 'free' | 'premium'
  reward: jsonb('reward').$type<{
    type: string;
    value: string | number;
    name: string;
    description: string;
    rarity: string;
    itemId: string | null;
  }>().notNull(),
  transactionId: varchar('transaction_id', { length: 128 }).notNull(),
  claimedAt: timestamp('claimed_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_battle_pass_claims_user_track_level').on(table.userId, table.track, table.level),
]);

// ============================================================
// LiveOps Mission Templates
// ============================================================

export const liveOpsMissionTemplates = pgTable('liveops_mission_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: varchar('template_id', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  category: missionCategoryEnum('category').notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  target: integer('target').notNull(),
  gameId: varchar('game_id', { length: 64 }),
  configuration: jsonb('configuration').$type<Record<string, unknown>>().default({}),
  rewardConfig: jsonb('reward_config').$type<{
    seasonXp: number;
    accountXp: number;
    badgeId: string | null;
    titleId: string | null;
    cosmeticId: string | null;
    eventTicket: number;
  }>().notNull(),
  difficulty: varchar('difficulty', { length: 16 }).notNull().default('medium'),
  rarity: varchar('rarity', { length: 16 }).notNull().default('common'),
  weight: integer('weight').notNull().default(10),
  minLevel: integer('min_level').notNull().default(1),
  maxLevel: integer('max_level').notNull().default(0),
  seasonId: uuid('season_id'),
  eventId: uuid('event_id'),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_liveops_mission_templates_category').on(table.category, table.isActive),
  index('idx_liveops_mission_templates_level').on(table.minLevel, table.maxLevel),
]);

// ============================================================
// LiveOps User Missions
// ============================================================

export const liveOpsUserMissions = pgTable('liveops_user_missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  missionTemplateId: varchar('mission_template_id', { length: 64 }).notNull(),
  category: missionCategoryEnum('category').notNull(),
  seasonId: uuid('season_id'),
  eventId: uuid('event_id'),
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull(),
  status: liveOpsMissionStatusEnum('status').notNull().default('active'),
  rerollStatus: missionRerollStatusEnum('reroll_status').notNull().default('available'),
  rerollCount: integer('reroll_count').notNull().default(0),
  completedAt: timestamp('completed_at'),
  claimedAt: timestamp('claimed_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_liveops_user_missions_user_category').on(table.userId, table.category, table.status),
  index('idx_liveops_user_missions_user_season').on(table.userId, table.seasonId),
]);

// ============================================================
// LiveOps Events
// ============================================================

export const liveOpsEvents = pgTable('liveops_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  type: varchar('type', { length: 32 }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: liveOpsEventStatusEnum('status').notNull().default('draft'),
  rules: jsonb('rules').$type<Record<string, unknown>>().default({}),
  rewards: jsonb('rewards').$type<Record<string, unknown>>().default({}),
  bannerUrl: text('banner_url'),
  entryType: varchar('entry_type', { length: 16 }).notNull().default('free'),
  gameId: varchar('game_id', { length: 64 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_liveops_events_status').on(table.status),
  index('idx_liveops_events_start_end').on(table.startTime, table.endTime),
  index('idx_liveops_events_type').on(table.type),
]);

// ============================================================
// LiveOps Event Entries
// ============================================================

export const liveOpsEventEntries = pgTable('liveops_event_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => liveOpsEvents.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  score: integer('score').notNull().default(0),
  rank: integer('rank'),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
}, (table) => [
  uniqueIndex('idx_liveops_event_entries_event_user').on(table.eventId, table.userId),
  index('idx_liveops_event_entries_event_score').on(table.eventId, table.score),
]);

// ============================================================
// Community Goals
// ============================================================

export const communityGoals = pgTable('community_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  type: varchar('type', { length: 32 }).notNull(),
  targetValue: bigint('target_value', { mode: 'number' }).notNull(),
  currentValue: bigint('current_value', { mode: 'number' }).notNull().default(0),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: communityGoalStatusEnum('status').notNull().default('active'),
  reward: jsonb('reward').$type<{
    type: string;
    value: string | number;
    name: string;
    description: string;
    rarity: string;
    itemId: string | null;
  }>().notNull(),
  progressPercentage: integer('progress_percentage').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_community_goals_status').on(table.status),
  index('idx_community_goals_start_end').on(table.startTime, table.endTime),
]);

// ============================================================
// Daily Login Rewards
// ============================================================

export const dailyLogins = pgTable('daily_logins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  lastLoginDate: varchar('last_login_date', { length: 10 }).notNull().default(''),
  currentDay: integer('current_day').notNull().default(0),
  totalLogins: integer('total_logins').notNull().default(0),
  lastRewardClaimedAt: timestamp('last_reward_claimed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================
// Reward Budgets
// ============================================================

export const rewardBudgets = pgTable('reward_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  totalBudget: bigint('total_budget', { mode: 'number' }).notNull(),
  distributedCount: bigint('distributed_count', { mode: 'number' }).notNull().default(0),
  userCap: integer('user_cap').notNull().default(5000),
  dailyCap: bigint('daily_cap', { mode: 'number' }).notNull().default(100000),
  dailyDistributedToday: bigint('daily_distributed_today', { mode: 'number' }).notNull().default(0),
  isExhausted: boolean('is_exhausted').notNull().default(false),
  fallbackReward: jsonb('fallback_reward').$type<{
    type: string;
    value: string | number;
    name: string;
    description: string;
    rarity: string;
    itemId: string | null;
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
