/**
 * GTX Rush — Global Competition Types v1.0
 *
 * Type definitions for the competitive ranking platform.
 * Covers seasons, tiers, rankings, badges, titles, and rewards.
 */

// ============================================================
// Seasons
// ============================================================

export type SeasonStatus = 'upcoming' | 'active' | 'ended' | 'archived';

export interface Season {
  id: string;
  number: number;
  name: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  status: SeasonStatus;
  configuration: SeasonConfiguration;
  rewardConfiguration: SeasonRewardConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonConfiguration {
  /** Scoring formula: how season rank is calculated */
  scoringFormula: SeasonScoringFormula;
  /** Whether daily challenge performance contributes to season rank */
  dailyChallengeWeight: number;
  /** Whether friend challenge wins contribute */
  challengeWinWeight: number;
  /** Whether XP earned contributes */
  xpWeight: number;
  /** Maximum scores counted per game per day */
  maxDailyScoresPerGame: number;
  [key: string]: unknown;
}

export interface SeasonScoringFormula {
  /**
   * Season score = weighted sum of:
   * - bestScores: sum of best daily scores per game
   * - challengeWins: number of friend challenge wins × weight
   * - dailyParticipation: days participated × weight
   * - xpEarned: XP earned during season × weight
   */
  bestScoresWeight: number;
  challengeWinsWeight: number;
  dailyParticipationWeight: number;
  xpEarnedWeight: number;
}

export interface SeasonRewardConfiguration {
  tiers: SeasonTierReward[];
}

export interface SeasonTierReward {
  /** Rank range start (inclusive, 1-indexed) */
  minRank: number;
  /** Rank range end (inclusive, null = unbounded) */
  maxRank: number | null;
  xp: number;
  badgeId?: string;
  titleId?: string;
  cosmeticId?: string;
}

// ============================================================
// Season Rankings
// ============================================================

export interface SeasonRanking {
  id: string;
  seasonId: string;
  userId: string;
  score: number;
  rank: number;
  breakdown: SeasonScoreBreakdown;
  lastUpdatedAt: Date;
  createdAt: Date;
}

export interface SeasonScoreBreakdown {
  bestScores: number;
  challengeWins: number;
  dailyParticipation: number;
  xpEarned: number;
  total: number;
}

export interface SeasonRankingWithUser extends SeasonRanking {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
    country: string;
    tier: TierDefinition | null;
  };
}

// ============================================================
// Tiers
// ============================================================

export type TierName = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'legend';

export interface TierDefinition {
  id: string;
  name: TierName;
  displayName: string;
  minScore: number;
  maxScore: number | null;
  iconUrl: string;
  color: string;
  DivisionConfig: TierDivision[];
}

export interface TierDivision {
  division: number; // e.g., 1, 2, 3
  displayName: string; // e.g., "Bronze III"
  minScore: number;
  maxScore: number | null;
}

export interface UserTier {
  id: string;
  userId: string;
  seasonId: string;
  tierName: TierName;
  division: number;
  score: number;
  promotionThreshold: number;
  demotionThreshold: number;
  promotedAt: Date | null;
  demotedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTierWithDefinition extends UserTier {
  tier: TierDefinition;
  divisionConfig: TierDivision;
  nextTier: TierDefinition | null;
  previousTier: TierDefinition | null;
}

// ============================================================
// Rank Snapshots
// ============================================================

export type RankSnapshotType = 'daily' | 'weekly' | 'season_end';

export interface RankSnapshot {
  id: string;
  userId: string;
  snapshotType: RankSnapshotType;
  periodId: string; // challenge_id, week_id, season_id
  globalRank: number | null;
  countryRank: number | null;
  gameRank: Record<string, number>; // gameId → rank
  score: number;
  createdAt: Date;
}

// ============================================================
// Badges
// ============================================================

export type BadgeCategory = 'gameplay' | 'social' | 'progression' | 'competition' | 'special';
export type BadgeRarityV2 = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  category: BadgeCategory;
  rarity: BadgeRarityV2;
  criteria: BadgeCriteria;
  reward: BadgeReward;
  isActive: boolean;
  createdAt: Date;
}

export interface BadgeCriteria {
  type: BadgeCriteriaType;
  /** Threshold value for the criteria */
  threshold: number;
  /** Game-specific: which game this applies to */
  gameId?: string;
  /** Time window in days (0 = all-time) */
  timeWindowDays?: number;
  /** Additional conditions */
  conditions?: Record<string, unknown>;
}

export type BadgeCriteriaType =
  | 'games_played'
  | 'score_reached'
  | 'level_reached'
  | 'streak_days'
  | 'challenges_completed'
  | 'challenges_won'
  | 'daily_challenges_completed'
  | 'rank_reached'
  | 'tier_reached'
  | 'total_xp_earned'
  | 'perfect_game'
  | 'speed_demon'
  | 'first_game';

export interface BadgeReward {
  xp: number;
  titleId?: string;
  cosmeticId?: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
}

export interface UserBadgeWithBadge extends UserBadge {
  badge: Badge;
}

// ============================================================
// Titles
// ============================================================

export interface Title {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  rarity: BadgeRarityV2;
  iconUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export interface UserTitle {
  id: string;
  userId: string;
  titleId: string;
  unlockedAt: Date;
  isEquipped: boolean;
}

export interface UserTitleWithTitle extends UserTitle {
  title: Title;
}

// ============================================================
// Reward Transactions
// ============================================================

export type RewardSource = 'season_reward' | 'badge_reward' | 'tier_reward' | 'level_reward';

export interface RewardTransaction {
  id: string;
  userId: string;
  source: RewardSource;
  referenceId: string; // season_id, badge_id, etc.
  referenceType: string; // 'season', 'badge', 'tier', 'level'
  xp: number;
  titleId: string | null;
  cosmeticId: string | null;
  badgeId: string | null;
  idempotencyKey: string;
  claimedAt: Date;
  createdAt: Date;
}

// ============================================================
// Ranking Service Interfaces
// ============================================================

export type RankingScope = 'global' | 'country' | 'game' | 'weekly' | 'season' | 'friends';
export type RankingType = 'score' | 'xp' | 'season';

export interface RankingQuery {
  scope: RankingScope;
  type: RankingType;
  /** Game ID for game-specific rankings */
  gameId?: string;
  /** Country code for country rankings */
  countryCode?: string;
  /** Season ID for season rankings */
  seasonId?: string;
  /** Week identifier for weekly rankings */
  weekId?: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Results per page */
  limit?: number;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  country: string;
  score: number;
  tier: TierDefinition | null;
  isCurrentUser?: boolean;
}

export interface RankingResponse {
  scope: RankingScope;
  type: RankingType;
  entries: RankingEntry[];
  userRank: RankingEntry | null;
  totalParticipants: number;
  /** Time period info for weekly/season */
  period?: {
    startsAt: string;
    endsAt: string;
    timeRemaining: number; // ms
  };
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface AroundMeResponse {
  top: RankingEntry[];
  user: RankingEntry;
  bottom: RankingEntry[];
  totalParticipants: number;
}

// ============================================================
// Profile Types
// ============================================================

export interface FullUserProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xpTotal: number;
  country: string;
  /** Current global rank */
  globalRank: number | null;
  /** Current season rank */
  seasonRank: number | null;
  /** Current tier */
  tier: UserTierWithDefinition | null;
  /** Best season rank ever */
  bestSeasonRank: number | null;
  /** Best global rank ever */
  bestGlobalRank: number | null;
  /** Games played */
  gamesPlayed: number;
  /** Total wins (challenge wins) */
  wins: number;
  /** Best scores per game */
  topScores: Array<{ gameId: string; gameName: string; score: number }>;
  /** Earned badges */
  badges: UserBadgeWithBadge[];
  /** Current title */
  equippedTitle: Title | null;
  /** Available titles */
  titles: UserTitleWithTitle[];
  /** Current streak */
  currentStreak: number;
  longestStreak: number;
  /** Season history */
  seasonHistory: Array<{
    seasonId: string;
    seasonName: string;
    finalRank: number;
    finalTier: string;
    score: number;
  }>;
  createdAt: Date;
}

// ============================================================
// Analytics Events (Competition-specific)
// ============================================================

export type CompetitionAnalyticsEvent =
  | 'leaderboard_opened'
  | 'leaderboard_viewed'
  | 'rank_changed'
  | 'tier_promoted'
  | 'tier_dropped'
  | 'season_started'
  | 'season_completed'
  | 'badge_unlocked'
  | 'badge_viewed'
  | 'title_unlocked'
  | 'level_up'
  | 'season_reward_claimed';

// ============================================================
// Scheduled Job Types
// ============================================================

export interface CompetitionScheduledJobResult {
  jobName: string;
  startedAt: Date;
  completedAt: Date;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}
