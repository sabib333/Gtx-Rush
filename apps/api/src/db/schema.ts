/**
 * GTX Rush Database Schema
 *
 * Drizzle ORM schema definitions for PostgreSQL.
 * This is the single source of truth for the database structure.
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
  date,
  inet,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================
// Enums
// ============================================================

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);

export const gameSessionStatusEnum = pgEnum('game_session_status', [
  'active',
  'completed',
  'expired',
  'disqualified',
]);

export const leaderboardTypeEnum = pgEnum('leaderboard_type', [
  'global',
  'country',
  'friends',
  'weekly',
  'game_specific',
]);

export const challengeStatusEnum = pgEnum('challenge_status', [
  'draft',
  'scheduled',
  'active',
  'ended',
  'cancelled',
]);

export const friendChallengeStatusEnum = pgEnum('friend_challenge_status', [
  'pending',
  'accepted',
  'completed',
  'expired',
  'cancelled',
]);

export const challengeTypeEnum = pgEnum('challenge_type', [
  'score_target',
  'head_to_head',
]);

export const challengeModeEnum = pgEnum('challenge_mode', [
  'normal',
  'daily_rush',
  'friend',
]);

export const xpSourceEnum = pgEnum('xp_source', [
  'game_play',
  'game_win',
  'daily_challenge',
  'streak',
  'friend_challenge',
  'achievement',
  'purchase',
  'admin_adjustment',
  'mission_reward',
  'streak_milestone',
  'level_up_bonus',
  'daily_rush_reward',
  'retention_bonus',
]);

export const badgeRarityEnum = pgEnum('badge_rarity', ['common', 'rare', 'epic', 'legendary']);

export const purchaseStatusEnum = pgEnum('purchase_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'cosmetic',
  'boost',
  'premium_feature',
  'extra_attempt',
]);

export const cosmeticCategoryEnum = pgEnum('cosmetic_category', [
  'avatar_frame',
  'profile_bg',
  'title',
  'effect',
  'emoji_pack',
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'super_admin',
  'admin',
  'moderator',
  'viewer',
]);

export const fraudStatusEnum = pgEnum('fraud_status', [
  'detected',
  'reviewing',
  'confirmed',
  'dismissed',
]);export const fraudSeverityEnum = pgEnum('fraud_severity', [
  'low', 'medium', 'high', 'critical',
]);

export const questionDifficultyEnum = pgEnum('question_difficulty', ['easy', 'medium', 'hard']);

export const questionStatusEnum = pgEnum('question_status', ['draft', 'review', 'published', 'archived']);

// ============================================================
// Users
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  country: varchar('country', { length: 2 }).default('XX'),
  avatarUrl: text('avatar_url'),
  level: integer('level').notNull().default(1),
  xpTotal: bigint('xp_total', { mode: 'number' }).notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveAt: timestamp('last_active_at'),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_users_level').on(table.level),
  index('idx_users_country').on(table.country),
  index('idx_users_status').on(table.status),
]);

// ============================================================
// User Profiles
// ============================================================

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  bio: varchar('bio', { length: 256 }),
  totalGamesPlayed: integer('total_games_played').notNull().default(0),
  totalScore: bigint('total_score', { mode: 'number' }).notNull().default(0),
  favoriteGameId: uuid('favorite_game_id'),
  settings: jsonb('settings').$type<{
    notifications: boolean;
    soundEnabled: boolean;
    hapticEnabled: boolean;
    analyticsOptOut: boolean;
  }>().default({
    notifications: true,
    soundEnabled: true,
    hapticEnabled: true,
    analyticsOptOut: false,
  }),
});

// ============================================================
// Games
// ============================================================

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  isActive: boolean('is_active').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  minLevel: integer('min_level').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================
// Game Versions
// ============================================================

export const gameVersions = pgTable('game_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  version: integer('version').notNull(),
  rules: jsonb('rules').$type<Record<string, unknown>>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_game_versions_game_version').on(table.gameId, table.version),
]);

// ============================================================
// Game Sessions
// ============================================================

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  gameId: uuid('game_id').notNull().references(() => games.id),
  gameVersionId: uuid('game_version_id').notNull().references(() => gameVersions.id),
  status: gameSessionStatusEnum('status').notNull().default('active'),
  clientSessionToken: varchar('client_session_token', { length: 128 }).notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  deviceInfo: jsonb('device_info').$type<Record<string, unknown>>(),
}, (table) => [
  index('idx_game_sessions_user_game').on(table.userId, table.gameId, table.startedAt),
  index('idx_game_sessions_status').on(table.status),
]);

// ============================================================
// Game Scores
// ============================================================

export const gameScores = pgTable('game_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().unique().references(() => gameSessions.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  gameId: uuid('game_id').notNull().references(() => games.id),
  score: integer('score').notNull(),
  breakdown: jsonb('breakdown').$type<Record<string, number>>().default({}),
  isPersonalBest: boolean('is_personal_best').notNull().default(false),
  antiCheatFlags: jsonb('anti_cheat_flags').$type<string[]>().default([]),
  validatedAt: timestamp('validated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_game_scores_user_game_score').on(table.userId, table.gameId, table.score),
  index('idx_game_scores_game_score').on(table.gameId, table.score),
  index('idx_game_scores_created').on(table.createdAt),
]);

// ============================================================
// Leaderboards
// ============================================================

export const leaderboards = pgTable('leaderboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').references(() => games.id),
  type: leaderboardTypeEnum('type').notNull(),
  countryCode: varchar('country_code', { length: 2 }),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_leaderboards_game_type').on(table.gameId, table.type, table.countryCode),
]);

// ============================================================
// Leaderboard Entries
// ============================================================

export const leaderboardEntries = pgTable('leaderboard_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaderboardId: uuid('leaderboard_id').notNull().references(() => leaderboards.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  score: integer('score').notNull(),
  rank: integer('rank').notNull().default(0),
  entryCount: integer('entry_count').notNull().default(0),
  lastScoreAt: timestamp('last_score_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_leaderboard_entries_board_score').on(table.leaderboardId, table.score),
  uniqueIndex('idx_leaderboard_entries_board_user').on(table.leaderboardId, table.userId),
]);

// ============================================================
// Daily Challenges
// ============================================================

export const dailyChallenges = pgTable('daily_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  gameVersion: varchar('game_version', { length: 32 }).notNull().default('1'),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').default(''),
  challengeDate: date('challenge_date').notNull(),
  mode: challengeModeEnum('mode').notNull().default('daily_rush'),
  configuration: jsonb('configuration').$type<{
    timeLimitMs?: number;
    difficulty?: string;
    questionCount?: number;
    [key: string]: unknown;
  }>().default({}),
  rules: jsonb('rules').$type<Record<string, unknown>>().default({}),
  maxAttempts: integer('max_attempts').notNull().default(3),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  status: challengeStatusEnum('status').notNull().default('draft'),
  rewardConfiguration: jsonb('reward_configuration').$type<{
    xp: number;
    streakBonus?: number;
    badgeId?: string;
    [key: string]: unknown;
  }>().default({ xp: 50 }),
  rewardXp: integer('reward_xp').notNull().default(50),
  rewardBadgeId: uuid('reward_badge_id'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_daily_challenges_date_status').on(table.challengeDate, table.status),
  index('idx_daily_challenges_status_starts').on(table.status, table.startsAt),
]);

// ============================================================
// Challenge Attempts
// ============================================================

export const challengeAttempts = pgTable('challenge_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id').notNull().references(() => dailyChallenges.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  score: integer('score').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  completionTimeMs: integer('completion_time_ms'),
  isValid: boolean('is_valid').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_challenge_attempts_challenge_user').on(table.challengeId, table.userId, table.attemptNumber),
  index('idx_challenge_attempts_challenge_score').on(table.challengeId, table.score),
  uniqueIndex('idx_challenge_attempts_session').on(table.sessionId),
]);

// ============================================================
// Friend Challenges
// ============================================================

export const friendChallenges = pgTable('friend_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  gameVersion: varchar('game_version', { length: 32 }).notNull().default('1'),
  type: challengeTypeEnum('type').notNull().default('score_target'),
  challengerId: uuid('challenger_id').notNull().references(() => users.id),
  opponentId: uuid('opponent_id').references(() => users.id),
  challengeToken: varchar('challenge_token', { length: 128 }).notNull().unique(),
  configuration: jsonb('configuration').$type<Record<string, unknown>>().default({}),
  targetScore: integer('target_score'),
  challengerSessionId: uuid('challenger_session_id').references(() => gameSessions.id),
  opponentSessionId: uuid('opponent_session_id').references(() => gameSessions.id),
  challengerScore: integer('challenger_score'),
  opponentScore: integer('opponent_score'),
  status: friendChallengeStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('idx_friend_challenges_challenger').on(table.challengerId, table.createdAt),
  index('idx_friend_challenges_opponent').on(table.opponentId, table.status),
  index('idx_friend_challenges_token').on(table.challengeToken),
]);

// ============================================================
// Referrals
// ============================================================

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: uuid('referrer_id').notNull().references(() => users.id),
  referredId: uuid('referred_id').notNull().references(() => users.id),
  referralCode: varchar('referral_code', { length: 32 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  activatedAt: timestamp('activated_at'),
  activationEvent: varchar('activation_event', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_referrals_referred').on(table.referredId),
]);

// ============================================================
// XP Transactions
// ============================================================

export const xpTransactions = pgTable('xp_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  source: xpSourceEnum('source').notNull(),
  referenceId: uuid('reference_id'),
  referenceType: varchar('reference_type', { length: 32 }),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_xp_transactions_user_created').on(table.userId, table.createdAt),
]);

// ============================================================
// Levels
// ============================================================

export const levels = pgTable('levels', {
  level: integer('level').primaryKey(),
  xpRequired: bigint('xp_required', { mode: 'number' }).notNull(),
  title: varchar('title', { length: 64 }).notNull(),
  rewards: jsonb('rewards').$type<Record<string, unknown>>().default({}),
});

// ============================================================
// Badges
// ============================================================

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  iconUrl: text('icon_url').default(''),
  category: varchar('category', { length: 32 }).notNull(),
  rarity: badgeRarityEnum('rarity').notNull().default('common'),
  criteria: jsonb('criteria').$type<Record<string, unknown>>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// User Badges
// ============================================================

export const userBadges = pgTable('user_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  badgeId: uuid('badge_id').notNull().references(() => badges.id),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_user_badges_user_badge').on(table.userId, table.badgeId),
]);

// ============================================================
// Cosmetics
// ============================================================

export const cosmetics = pgTable('cosmetics', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  category: cosmeticCategoryEnum('category').notNull(),
  rarity: badgeRarityEnum('rarity').notNull().default('common'),
  priceStars: integer('price_stars').notNull(),
  assetUrl: text('asset_url').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// User Cosmetics
// ============================================================

export const userCosmetics = pgTable('user_cosmetics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  cosmeticId: uuid('cosmetic_id').notNull().references(() => cosmetics.id),
  isEquipped: boolean('is_equipped').notNull().default(false),
  purchasedAt: timestamp('purchased_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_user_cosmetics_user_item').on(table.userId, table.cosmeticId),
]);

// ============================================================
// Purchases
// ============================================================

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  amountStars: integer('amount_stars').notNull(),
  telegramPaymentId: varchar('telegram_payment_id', { length: 128 }),
  status: purchaseStatusEnum('status').notNull().default('pending'),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('idx_purchases_user_created').on(table.userId, table.createdAt),
]);

// ============================================================
// Analytics Events
// ============================================================

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: varchar('event_name', { length: 64 }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  sessionId: uuid('session_id'),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_analytics_events_name_created').on(table.eventName, table.createdAt),
  index('idx_analytics_events_user_created').on(table.userId, table.createdAt),
]);

// ============================================================
// Fraud Flags
// ============================================================

export const fraudFlags = pgTable('fraud_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  flagType: varchar('flag_type', { length: 64 }).notNull(),
  severity: fraudSeverityEnum('severity').notNull().default('low'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}),
  status: fraudStatusEnum('status').notNull().default('detected'),
  reviewedBy: uuid('reviewed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('idx_fraud_flags_user_type').on(table.userId, table.flagType),
  index('idx_fraud_flags_status_severity').on(table.status, table.severity),
]);

// ============================================================
// Daily Challenge Participants (daily streak tracking)
// ============================================================

export const dailyChallengeParticipants = pgTable('daily_challenge_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id').notNull().references(() => dailyChallenges.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  bestScore: integer('best_score').notNull().default(0),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  rewardedAt: timestamp('rewarded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_daily_challenge_participants_challenge_user').on(table.challengeId, table.userId),
  index('idx_daily_challenge_participants_user_date').on(table.userId),
]);

// ============================================================
// Challenge History (immutable record)
// ============================================================

export const challengeHistory = pgTable('challenge_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  challengeType: varchar('challenge_type', { length: 32 }).notNull(),
  challengeId: uuid('challenge_id').notNull(),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  opponentId: uuid('opponent_id').references(() => users.id),
  score: integer('score'),
  opponentScore: integer('opponent_score'),
  result: varchar('result', { length: 16 }),
  xpAwarded: integer('xp_awarded').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_challenge_history_user').on(table.userId, table.createdAt),
  index('idx_challenge_history_type').on(table.challengeType, table.createdAt),
]);

// ============================================================
// Admin Users
// ============================================================

// ============================================================
// Quiz Categories
// ============================================================

export const quizCategories = pgTable('quiz_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// Quiz Questions
// ============================================================

export const quizQuestions = pgTable('quiz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: integer('version').notNull().default(1),
  categoryId: uuid('category_id').notNull().references(() => quizCategories.id),
  difficulty: questionDifficultyEnum('difficulty').notNull().default('medium'),
  question: text('question').notNull(),
  correctOptionIndex: integer('correct_option_index').notNull(),
  explanation: text('explanation').default(''),
  timeLimitMs: integer('time_limit_ms').notNull().default(15_000),
  status: questionStatusEnum('status').notNull().default('draft'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_quiz_questions_category_difficulty').on(table.categoryId, table.difficulty, table.status),
  index('idx_quiz_questions_status').on(table.status, table.isActive),
  uniqueIndex('idx_quiz_questions_id_version').on(table.id, table.version),
]);

// ============================================================
// Quiz Options
// ============================================================

export const quizOptions = pgTable('quiz_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => quizQuestions.id),
  optionIndex: integer('option_index').notNull(),
  text: varchar('text', { length: 512 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_quiz_options_question').on(table.questionId, table.optionIndex),
]);

// ============================================================
// Quiz Answers (per-session answer records)
// ============================================================

export const quizAnswers = pgTable('quiz_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  questionId: uuid('question_id').notNull().references(() => quizQuestions.id),
  questionVersion: integer('question_version').notNull().default(1),
  selectedOptionIndex: integer('selected_option_index'),
  correct: boolean('correct').notNull().default(false),
  timeToAnswerMs: integer('time_to_answer_ms'),
  scoreEarned: integer('score_earned').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  sequenceNumber: integer('sequence_number').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_quiz_answers_session').on(table.sessionId, table.sequenceNumber),
  index('idx_quiz_answers_question').on(table.questionId),
  uniqueIndex('idx_quiz_answers_session_question').on(table.sessionId, table.questionId),
]);

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: adminRoleEnum('role').notNull().default('viewer'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
