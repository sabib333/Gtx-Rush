/**
 * GTX Rush — Season Engine v1.0
 *
 * Manages competitive seasons:
 * - Lifecycle: UPCOMING → ACTIVE → ENDED → ARCHIVED
 * - Transitions: start, finalize, archive
 * - Season rankings: composite score calculation
 * - Reward distribution: idempotent, auditable
 * - Historical preservation: never destroy data
 *
 * SECURITY:
 * - Season configuration is server-authoritative
 * - Rewards are distributed idempotently
 * - Historical rankings remain immutable
 */

import { nanoid } from 'nanoid';
import type {
  Season,
  SeasonStatus,
  SeasonRanking,
  SeasonScoreBreakdown,
  SeasonConfiguration,
  SeasonRewardConfiguration,
  RewardTransaction,
} from '@gtx-rush/types';
import { submitScore, getUserRank } from './ranking-service';

// ============================================================
// In-memory stores (production: PostgreSQL)
// ============================================================

const seasons = new Map<string, Season>();
const seasonRankings = new Map<string, SeasonRanking>();
const rewardTransactions = new Map<string, RewardTransaction>();

// Active season cache
let activeSeasonId: string | null = null;

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_SEASON_CONFIG: SeasonConfiguration = {
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
};

const DEFAULT_REWARD_CONFIG: SeasonRewardConfiguration = {
  tiers: [
    { minRank: 1, maxRank: 10, xp: 1000, badgeId: 'season_champion', titleId: 'season_champion' },
    { minRank: 11, maxRank: 100, xp: 500, badgeId: 'top_100' },
    { minRank: 101, maxRank: 1000, xp: 200, badgeId: 'top_1k' },
    { minRank: 1001, maxRank: 10000, xp: 100, badgeId: 'top_10k' },
  ],
};

// ============================================================
// Season Lifecycle
// ============================================================

/**
 * Create a new season.
 * Usually created as UPCOMING before the current season ends.
 */
export function createSeason(
  number: number,
  name: string,
  startsAt: Date,
  endsAt: Date,
  options: {
    description?: string;
    configuration?: Partial<SeasonConfiguration>;
    rewardConfiguration?: Partial<SeasonRewardConfiguration>;
  } = {},
): Season {
  const id = nanoid();

  const season: Season = {
    id,
    number,
    name,
    description: options.description ?? `Season ${number}: ${name}`,
    startsAt,
    endsAt,
    status: 'upcoming',
    configuration: {
      ...DEFAULT_SEASON_CONFIG,
      ...options.configuration,
    },
    rewardConfiguration: {
      ...DEFAULT_REWARD_CONFIG,
      ...options.rewardConfiguration,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  seasons.set(id, season);
  return season;
}

/**
 * Get the current active season.
 */
export function getActiveSeason(): Season | null {
  if (activeSeasonId) {
    const season = seasons.get(activeSeasonId);
    if (season && season.status === 'active') return season;
  }

  // Find active season
  for (const season of seasons.values()) {
    if (season.status === 'active') {
      activeSeasonId = season.id;
      return season;
    }
  }

  return null;
}

/**
 * Get a season by ID.
 */
export function getSeasonById(id: string): Season | null {
  return seasons.get(id) ?? null;
}

/**
 * Get all seasons.
 */
export function getAllSeasons(): Season[] {
  return Array.from(seasons.values()).sort((a, b) => b.number - a.number);
}

/**
 * Start a season (UPCOMING → ACTIVE).
 * Only one season can be active at a time.
 */
export function startSeason(seasonId: string): boolean {
  const season = seasons.get(seasonId);
  if (!season || season.status !== 'upcoming') return false;

  // End any currently active season first
  const currentActive = getActiveSeason();
  if (currentActive) {
    endSeason(currentActive.id);
  }

  season.status = 'active';
  season.updatedAt = new Date();
  activeSeasonId = seasonId;

  return true;
}

/**
 * End a season (ACTIVE → ENDED).
 * Finalizes rankings and determines rewards.
 */
export function endSeason(seasonId: string): boolean {
  const season = seasons.get(seasonId);
  if (!season || season.status !== 'active') return false;

  season.status = 'ended';
  season.updatedAt = new Date();

  if (activeSeasonId === seasonId) {
    activeSeasonId = null;
  }

  // Finalize season rankings
  finalizeSeasonRankings(seasonId);

  return true;
}

/**
 * Archive a season (ENDED → ARCHIVED).
 * Historical data is preserved.
 */
export function archiveSeason(seasonId: string): boolean {
  const season = seasons.get(seasonId);
  if (!season || season.status !== 'ended') return false;

  season.status = 'archived';
  season.updatedAt = new Date();
  return true;
}

// ============================================================
// Season Rankings
// ============================================================

/**
 * Calculate season score for a user.
 *
 * Formula:
 * seasonScore = (bestScores × bestScoresWeight) +
 *               (challengeWins × challengeWinsWeight) +
 *               (dailyParticipation × dailyParticipationWeight) +
 *               (xpEarned × xpEarnedWeight)
 *
 * All values are normalized to 0-1000 scale before weighting.
 */
export function calculateSeasonScore(
  userId: string,
  seasonId: string,
  breakdown: SeasonScoreBreakdown,
): number {
  const season = seasons.get(seasonId);
  if (!season) return 0;

  const formula = season.configuration.scoringFormula;

  // Normalize each component to 0-1000 scale
  const maxScores = 30000; // Rough max for best scores
  const maxWins = 500;     // Rough max for challenge wins
  const maxDays = 90;      // Max days in a season
  const maxXp = 100000;    // Rough max XP in a season

  const normalizedScores = Math.min(1000, (breakdown.bestScores / maxScores) * 1000);
  const normalizedWins = Math.min(1000, (breakdown.challengeWins / maxWins) * 1000);
  const normalizedDays = Math.min(1000, (breakdown.dailyParticipation / maxDays) * 1000);
  const normalizedXp = Math.min(1000, (breakdown.xpEarned / maxXp) * 1000);

  const score = Math.round(
    normalizedScores * formula.bestScoresWeight +
    normalizedWins * formula.challengeWinsWeight +
    normalizedDays * formula.dailyParticipationWeight +
    normalizedXp * formula.xpEarnedWeight,
  );

  return score;
}

/**
 * Update a user's season ranking.
 */
export function updateSeasonRanking(
  userId: string,
  seasonId: string,
  breakdown: SeasonScoreBreakdown,
): SeasonRanking {
  const key = `${seasonId}:${userId}`;
  const existing = seasonRankings.get(key);

  const score = calculateSeasonScore(userId, seasonId, breakdown);

  if (existing) {
    existing.score = score;
    existing.breakdown = breakdown;
    existing.lastUpdatedAt = new Date();

    // Update rank in the ranking service
    submitScore(userId, score, 'season', 'season', { seasonId });

    return existing;
  }

  const ranking: SeasonRanking = {
    id: nanoid(),
    seasonId,
    userId,
    score,
    rank: 0,
    breakdown,
    lastUpdatedAt: new Date(),
    createdAt: new Date(),
  };

  seasonRankings.set(key, ranking);

  // Submit to ranking service
  submitScore(userId, score, 'season', 'season', { seasonId });

  return ranking;
}

/**
 * Get a user's season ranking.
 */
export function getSeasonRanking(userId: string, seasonId: string): SeasonRanking | null {
  return seasonRankings.get(`${seasonId}:${userId}`) ?? null;
}

/**
 * Finalize season rankings: calculate final ranks for all participants.
 */
function finalizeSeasonRankings(seasonId: string): void {
  const allRankings = Array.from(seasonRankings.values())
    .filter((r) => r.seasonId === seasonId)
    .sort((a, b) => b.score - a.score);

  allRankings.forEach((r, i) => {
    r.rank = i + 1;
  });
}

/**
 * Get finalized season rankings.
 */
export function getSeasonRankings(
  seasonId: string,
  options: { cursor?: string; limit?: number } = {},
): { entries: SeasonRanking[]; hasMore: boolean; nextCursor: string | null } {
  const { cursor, limit = 50 } = options;

  const allRankings = Array.from(seasonRankings.values())
    .filter((r) => r.seasonId === seasonId)
    .sort((a, b) => b.score - a.score);

  // Assign ranks
  allRankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = allRankings.findIndex((r) => r.userId === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = allRankings.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < allRankings.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.userId ?? null : null;

  return { entries: paginated, hasMore, nextCursor };
}

// ============================================================
// Reward Distribution
// ============================================================

/**
 * Distribute season rewards idempotently.
 * Returns the reward transaction if newly created, or existing if already claimed.
 */
export function distributeSeasonReward(
  userId: string,
  seasonId: string,
  rank: number,
): RewardTransaction | null {
  const season = seasons.get(seasonId);
  if (!season) return null;

  // Find applicable reward tier
  const rewardTier = season.rewardConfiguration.tiers.find(
    (t) => rank >= t.minRank && (t.maxRank === null || rank <= t.maxRank),
  );

  if (!rewardTier) return null;

  // Check idempotency
  const idempotencyKey = `season_reward:${seasonId}:${userId}`;
  const existing = Array.from(rewardTransactions.values()).find(
    (t) => t.idempotencyKey === idempotencyKey,
  );

  if (existing) return existing; // Already claimed

  const transaction: RewardTransaction = {
    id: nanoid(),
    userId,
    source: 'season_reward',
    referenceId: seasonId,
    referenceType: 'season',
    xp: rewardTier.xp,
    titleId: rewardTier.titleId ?? null,
    cosmeticId: rewardTier.cosmeticId ?? null,
    badgeId: rewardTier.badgeId ?? null,
    idempotencyKey,
    claimedAt: new Date(),
    createdAt: new Date(),
  };

  rewardTransactions.set(transaction.id, transaction);
  return transaction;
}

/**
 * Distribute all season rewards.
 * Called by the scheduler when a season ends.
 */
export function distributeAllSeasonRewards(seasonId: string): RewardTransaction[] {
  const rankings = getSeasonRankings(seasonId).entries;
  const transactions: RewardTransaction[] = [];

  for (const ranking of rankings) {
    const transaction = distributeSeasonReward(ranking.userId, seasonId, ranking.rank);
    if (transaction) transactions.push(transaction);
  }

  return transactions;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllSeasons(): void {
  seasons.clear();
  seasonRankings.clear();
  rewardTransactions.clear();
  activeSeasonId = null;
}
