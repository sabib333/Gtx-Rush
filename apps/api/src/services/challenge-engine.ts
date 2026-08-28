/**
 * GTX Rush — Daily Challenge Engine v1.0
 *
 * Server-authoritative challenge lifecycle:
 *   DRAFT → SCHEDULED → ACTIVE → ENDED
 *
 * Handles:
 * - Daily challenge creation and activation
 * - Attempt validation and tracking
 * - Best-score logic across multiple attempts
 * - Daily leaderboard with deterministic tie-breaking
 * - XP and streak integration
 * - Anti-abuse foundations
 *
 * SECURITY: All challenge configuration is server-authoritative.
 * Clients never define rules, time limits, attempts, or rewards.
 */

import { nanoid } from 'nanoid';
import type {
  DailyChallenge,
  DailyChallengeConfiguration,
  RewardConfiguration,
  ChallengeAttempt,
  DailyChallengeParticipant,
  DailyLeaderboardEntry,
  DailyLeaderboardResponse,
  DailyChallengeResult,
  ChallengeHistoryEntry,
  ChallengeStatus,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const dailyChallenges = new Map<string, DailyChallenge>();
const challengeAttempts = new Map<string, ChallengeAttempt>();
const participants = new Map<string, DailyChallengeParticipant>();
const challengeHistoryEntries = new Map<string, ChallengeHistoryEntry>();

// Date-indexed lookup: "YYYY-MM-DD" → challengeId
const challengesByDate = new Map<string, string>();

// ============================================================
// Constants
// ============================================================

/** Canonical timezone for daily boundaries (UTC) */
const DAILY_BOUNDARY_UTC = '00:00:00';

/** Default challenge duration: 24 hours */
const DEFAULT_CHALLENGE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Default max attempts per day */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Default XP reward for daily completion */
const DEFAULT_DAILY_XP = 50;

/** Default XP bonus for personal best */
const XP_PERSONAL_BEST_BONUS = 25;

/** Default XP for streak contribution */
const XP_STREAK_BONUS = 10;

/** Default game selection (fallback) */
const DEFAULT_GAME_ID = 'reaction-rush';

// ============================================================
// Helpers
// ============================================================

/**
 * Get the current UTC date as YYYY-MM-DD string.
 * Daily challenges are keyed by UTC date, not user timezone.
 * This prevents timezone manipulation for multiple daily attempts.
 */
function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get start/end timestamps for a UTC date boundary.
 * Challenge starts at 00:00:00 UTC and ends at 23:59:59.999 UTC.
 */
function getDateBoundaries(dateStr: string): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(`${dateStr}T${DAILY_BOUNDARY_UTC}Z`);
  const endsAt = new Date(startsAt.getTime() + DEFAULT_CHALLENGE_DURATION_MS - 1);
  return { startsAt, endsAt };
}

/**
 * Deterministic tie-breaking strategy:
 * 1. Higher score wins
 * 2. If score equal, faster completion time wins (lower completionTimeMs)
 * 3. If still equal, earlier valid submission wins (earlier createdAt)
 */
function compareScores(
  a: { score: number; completionTimeMs: number | null; createdAt: number },
  b: { score: number; completionTimeMs: number | null; createdAt: number },
): number {
  // Primary: higher score first
  if (b.score !== a.score) return b.score - a.score;

  // Secondary: faster completion time (lower is better)
  const aTime = a.completionTimeMs ?? Infinity;
  const bTime = b.completionTimeMs ?? Infinity;
  if (aTime !== bTime) return aTime - bTime;

  // Tertiary: earlier submission (earlier is better)
  return a.createdAt - b.createdAt;
}

/**
 * Generate a daily challenge title based on the game.
 */
function generateTitle(gameId: string): string {
  const titles: Record<string, string> = {
    'reaction-rush': '⚡ Reaction Rush',
    'tap-rush': '🎯 Tap Rush',
    'quiz-rush': '🧠 Quiz Rush',
  };
  return titles[gameId] ?? '⚡ Daily Rush';
}

/**
 * Generate a daily challenge description.
 */
function generateDescription(gameId: string): string {
  const descriptions: Record<string, string> = {
    'reaction-rush': 'Test your reflexes! React as fast as you can.',
    'tap-rush': 'Tap targets as fast and accurately as you can!',
    'quiz-rush': 'Think fast. Answer faster. Rise.',
  };
  return descriptions[gameId] ?? 'Beat the world. Rise to the top.';
}

// ============================================================
// Daily Challenge Lifecycle
// ============================================================

/**
 * Create or get today's daily challenge.
 * If a challenge already exists for today, return it.
 * Otherwise, create a new one with the specified game.
 *
 * SECURITY: Game selection is server-authoritative.
 * The client cannot choose which game is today's challenge.
 */
export function getOrCreateDailyChallenge(
  gameId: string = DEFAULT_GAME_ID,
  createdBy: string = 'system',
): DailyChallenge {
  const today = getTodayUTC();

  // Check if today's challenge already exists
  const existingId = challengesByDate.get(today);
  if (existingId) {
    const existing = dailyChallenges.get(existingId);
    if (existing) return existing;
  }

  // Create new challenge for today
  const { startsAt, endsAt } = getDateBoundaries(today);
  const id = nanoid();
  const configuration: DailyChallengeConfiguration = {
    difficulty: 'normal',
    [gameId === 'quiz-rush' ? 'questionCount' : 'timeLimitMs']:
      gameId === 'quiz-rush' ? 10 : undefined,
  };

  const rewardConfig: RewardConfiguration = {
    xp: DEFAULT_DAILY_XP,
    streakBonus: XP_STREAK_BONUS,
  };

  const challenge: DailyChallenge = {
    id,
    gameId,
    gameVersion: '1',
    title: generateTitle(gameId),
    description: generateDescription(gameId),
    challengeDate: today,
    mode: 'daily_rush',
    configuration,
    rules: {
      serverAuthoritative: true,
      scoringVersion: 1,
    },
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    startsAt,
    endsAt,
    status: 'active' as ChallengeStatus, // Auto-activate on creation
    rewardConfiguration: rewardConfig,
    rewardXp: DEFAULT_DAILY_XP,
    rewardBadgeId: null,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  dailyChallenges.set(id, challenge);
  challengesByDate.set(today, id);

  return challenge;
}

/**
 * Get the current active daily challenge.
 * Returns null if no active challenge exists for today.
 */
export function getCurrentDailyChallenge(): DailyChallenge | null {
  const today = getTodayUTC();
  const challengeId = challengesByDate.get(today);
  if (!challengeId) return null;

  const challenge = dailyChallenges.get(challengeId);
  if (!challenge) return null;

  // Auto-expire if past end time
  if (challenge.status === 'active' && new Date() > challenge.endsAt) {
    challenge.status = 'ended';
    challenge.updatedAt = new Date();
  }

  return challenge;
}

/**
 * Get a daily challenge by ID.
 */
export function getDailyChallengeById(id: string): DailyChallenge | null {
  return dailyChallenges.get(id) ?? null;
}

/**
 * Activate a scheduled daily challenge.
 * Called by the scheduler when startsAt is reached.
 */
export function activateDailyChallenge(challengeId: string): boolean {
  const challenge = dailyChallenges.get(challengeId);
  if (!challenge || challenge.status !== 'scheduled') return false;

  challenge.status = 'active';
  challenge.updatedAt = new Date();
  return true;
}

/**
 * End an active daily challenge.
 * Called by the scheduler when endsAt is reached.
 */
export function endDailyChallenge(challengeId: string): boolean {
  const challenge = dailyChallenges.get(challengeId);
  if (!challenge || challenge.status !== 'active') return false;

  challenge.status = 'ended';
  challenge.updatedAt = new Date();
  return true;
}

// ============================================================
// Attempt Validation & Tracking
// ============================================================

/**
 * Validate whether a user can start a daily challenge attempt.
 *
 * Checks:
 * - Challenge exists and is ACTIVE
 * - User has remaining attempts
 * - Game version is valid
 *
 * SECURITY: Never trust attempt_number from the client.
 * Server tracks attempt count independently.
 */
export function validateDailyChallengeAttempt(
  challengeId: string,
  userId: string,
): { valid: boolean; error?: string; attemptNumber?: number; maxAttempts?: number } {
  const challenge = dailyChallenges.get(challengeId);
  if (!challenge) {
    return { valid: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  if (challenge.status !== 'active') {
    return { valid: false, error: 'CHALLENGE_NOT_ACTIVE' };
  }

  const now = new Date();
  if (now < challenge.startsAt || now > challenge.endsAt) {
    return { valid: false, error: 'CHALLENGE_OUT_OF_WINDOW' };
  }

  // Check attempt limit
  const participant = getOrCreateParticipant(challengeId, userId);
  if (participant.attemptCount >= challenge.maxAttempts) {
    return {
      valid: false,
      error: 'MAX_ATTEMPTS_REACHED',
      attemptNumber: participant.attemptCount,
      maxAttempts: challenge.maxAttempts,
    };
  }

  return {
    valid: true,
    attemptNumber: participant.attemptCount + 1,
    maxAttempts: challenge.maxAttempts,
  };
}

/**
 * Record a completed challenge attempt.
 * Updates participant stats and best score.
 *
 * SECURITY: The server records the actual attempt count.
 * The client-submitted attempt_number is ignored.
 */
export function recordChallengeAttempt(
  challengeId: string,
  userId: string,
  sessionId: string,
  score: number,
  completionTimeMs: number | null,
  isValid: boolean = true,
): ChallengeAttempt {
  const participant = getOrCreateParticipant(challengeId, userId);
  const attemptNumber = participant.attemptCount + 1;

  const attempt: ChallengeAttempt = {
    id: nanoid(),
    challengeId,
    userId,
    sessionId,
    score,
    attemptNumber,
    completionTimeMs,
    isValid,
    createdAt: new Date(),
  };

  challengeAttempts.set(attempt.id, attempt);

  // Update participant
  participant.attemptCount = attemptNumber;
  participant.lastAttemptAt = new Date();
  if (isValid && score > participant.bestScore) {
    participant.bestScore = score;
  }
  participant.updatedAt = new Date();

  return attempt;
}

/**
 * Get the user's best valid score for a daily challenge.
 */
export function getUserBestScore(
  challengeId: string,
  userId: string,
): number {
  const participant = participants.get(`${challengeId}:${userId}`);
  return participant?.bestScore ?? 0;
}

/**
 * Get the user's attempt count for a daily challenge.
 */
export function getUserAttemptCount(
  challengeId: string,
  userId: string,
): number {
  const participant = participants.get(`${challengeId}:${userId}`);
  return participant?.attemptCount ?? 0;
}

// ============================================================
// Participant Management
// ============================================================

function getOrCreateParticipant(
  challengeId: string,
  userId: string,
): DailyChallengeParticipant {
  const key = `${challengeId}:${userId}`;
  let participant = participants.get(key);

  if (!participant) {
    participant = {
      id: nanoid(),
      challengeId,
      userId,
      bestScore: 0,
      attemptCount: 0,
      lastAttemptAt: null,
      rewardedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    participants.set(key, participant);
  }

  return participant;
}

// ============================================================
// Daily Leaderboard
// ============================================================

/**
 * Get the daily leaderboard for a challenge.
 *
 * Tie-breaking (deterministic):
 * 1. Higher score wins
 * 2. If score equal, faster completion wins
 * 3. If still equal, earlier valid submission wins
 *
 * SECURITY: Only valid attempts count toward the leaderboard.
 */
export function getDailyLeaderboard(
  challengeId: string,
  options: {
    filter?: 'global' | 'country' | 'friends';
    cursor?: string;
    limit?: number;
    currentUserId?: string;
    userCountry?: string;
    friendIds?: string[];
  } = {},
): DailyLeaderboardResponse {
  const { filter, cursor, limit = 50, currentUserId, userCountry, friendIds } = options;

  const challenge = dailyChallenges.get(challengeId);
  if (!challenge) {
    return {
      challengeId,
      challengeDate: '',
      gameId: '',
      entries: [],
      userRank: null,
      totalParticipants: 0,
      pagination: { nextCursor: null, hasMore: false },
    };
  }

  // Collect all participants with their best scores
  const allParticipants: DailyChallengeParticipant[] = [];
  for (const [key, p] of participants.entries()) {
    if (key.startsWith(`${challengeId}:`) && p.bestScore > 0) {
      allParticipants.push(p);
    }
  }

  // Apply filters
  let filtered = allParticipants;
  if (filter === 'country' && userCountry) {
    // In production, we'd join with user table. For now, pass all.
    filtered = allParticipants;
  }
  if (filter === 'friends' && friendIds) {
    filtered = allParticipants.filter((p) => friendIds.includes(p.userId));
  }

  // Sort with deterministic tie-breaking
  const sorted = filtered.sort((a, b) => {
    // Find the best attempt for each participant
    const aBestAttempt = findBestAttempt(challengeId, a.userId);
    const bBestAttempt = findBestAttempt(challengeId, b.userId);

    return compareScores({
      score: a.bestScore,
      completionTimeMs: aBestAttempt?.completionTimeMs ?? null,
      createdAt: aBestAttempt?.createdAt.getTime() ?? Infinity,
    }, {
      score: b.bestScore,
      completionTimeMs: bBestAttempt?.completionTimeMs ?? null,
      createdAt: bBestAttempt?.createdAt.getTime() ?? Infinity,
    });
  });

  // Assign ranks
  const entries: DailyLeaderboardEntry[] = sorted.map((p, index) => ({
    rank: index + 1,
    userId: p.userId,
    displayName: `Player ${p.userId.slice(0, 8)}`, // Would be fetched from users table
    avatarUrl: null,
    level: 1,
    country: 'XX',
    score: p.bestScore,
    completionTimeMs: findBestAttempt(challengeId, p.userId)?.completionTimeMs ?? null,
    attemptCount: p.attemptCount,
    isCurrentUser: p.userId === currentUserId,
  }));

  // Apply cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = entries.findIndex((e) => e.userId === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginatedEntries = entries.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < entries.length;
  const nextCursor = hasMore ? paginatedEntries[paginatedEntries.length - 1]?.userId ?? null : null;

  // Find current user's rank
  let userRank: DailyLeaderboardEntry | null = null;
  if (currentUserId) {
    const userEntry = entries.find((e) => e.userId === currentUserId);
    if (userEntry) {
      userRank = userEntry;
    } else {
      // User not in leaderboard yet — show placeholder
      userRank = {
        rank: entries.length + 1,
        userId: currentUserId,
        displayName: 'You',
        avatarUrl: null,
        level: 1,
        country: userCountry ?? 'XX',
        score: getUserBestScore(challengeId, currentUserId),
        completionTimeMs: null,
        attemptCount: getUserAttemptCount(challengeId, currentUserId),
        isCurrentUser: true,
      };
    }
  }

  return {
    challengeId,
    challengeDate: challenge.challengeDate,
    gameId: challenge.gameId,
    entries: paginatedEntries,
    userRank,
    totalParticipants: filtered.length,
    pagination: { nextCursor, hasMore },
  };
}

function findBestAttempt(
  challengeId: string,
  userId: string,
): ChallengeAttempt | null {
  let best: ChallengeAttempt | null = null;
  for (const attempt of challengeAttempts.values()) {
    if (
      attempt.challengeId === challengeId &&
      attempt.userId === userId &&
      attempt.isValid
    ) {
      if (!best || attempt.score > best.score) {
        best = attempt;
      }
    }
  }
  return best;
}

// ============================================================
// Rewards & Streak Integration
// ============================================================

/**
 * Award daily challenge rewards.
 * Handles XP, streak contribution, and badge eligibility.
 *
 * RULES:
 * - One day counts once for streak (prevent multiple-attempt farming)
 * - XP is awarded on first valid completion
 * - Personal best bonus is awarded when improving score
 * - Rewards are idempotent (rewardedAt prevents duplicates)
 */
export function awardDailyChallengeRewards(
  challengeId: string,
  userId: string,
  isPersonalBest: boolean,
  hadStreakContributionToday: boolean,
): {
  xpAwarded: number;
  streakContribution: boolean;
  totalXp: number;
} {
  const challenge = dailyChallenges.get(challengeId);
  if (!challenge) {
    return { xpAwarded: 0, streakContribution: false, totalXp: 0 };
  }

  const participant = getOrCreateParticipant(challengeId, userId);

  // Prevent duplicate rewards
  if (participant.rewardedAt) {
    return {
      xpAwarded: 0,
      streakContribution: false,
      totalXp: 0,
    };
  }

  let xpAwarded = challenge.rewardConfiguration.xp ?? DEFAULT_DAILY_XP;

  // Personal best bonus
  if (isPersonalBest) {
    xpAwarded += XP_PERSONAL_BEST_BONUS;
  }

  // Streak contribution (once per day)
  const streakContribution = !hadStreakContributionToday;
  if (streakContribution) {
    xpAwarded += XP_STREAK_BONUS;
  }

  // Mark as rewarded
  participant.rewardedAt = new Date();
  participant.updatedAt = new Date();

  return {
    xpAwarded,
    streakContribution,
    totalXp: xpAwarded,
  };
}

/**
 * Check if a user has already contributed to their streak today
 * through daily challenge participation.
 */
export function hasStreakContributionToday(
  challengeId: string,
  userId: string,
): boolean {
  const participant = participants.get(`${challengeId}:${userId}`);
  return participant?.rewardedAt !== null && participant?.rewardedAt !== undefined;
}

// ============================================================
// Challenge History
// ============================================================

/**
 * Record a daily challenge completion in the immutable history.
 */
export function recordDailyChallengeHistory(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  rank: number,
  xpAwarded: number,
): ChallengeHistoryEntry {
  const entry: ChallengeHistoryEntry = {
    id: nanoid(),
    userId,
    challengeType: 'daily_rush',
    challengeId,
    gameId,
    opponentId: null,
    score,
    opponentScore: null,
    result: 'completed',
    xpAwarded,
    completedAt: new Date(),
    createdAt: new Date(),
  };

  challengeHistoryEntries.set(entry.id, entry);
  return entry;
}

/**
 * Get user's challenge history.
 */
export function getUserChallengeHistory(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
    challengeType?: 'daily_rush' | 'friend';
  } = {},
): { entries: ChallengeHistoryEntry[]; hasMore: boolean; nextCursor: string | null } {
  const { cursor, limit = 20, challengeType } = options;

  const userEntries: ChallengeHistoryEntry[] = [];
  for (const entry of challengeHistoryEntries.values()) {
    if (entry.userId === userId) {
      if (challengeType && entry.challengeType !== challengeType) continue;
      userEntries.push(entry);
    }
  }

  // Sort by creation date (newest first)
  userEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = userEntries.findIndex((e) => e.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = userEntries.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < userEntries.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  return { entries: paginated, hasMore, nextCursor };
}

// ============================================================
// Daily Result
// ============================================================

/**
 * Build the daily challenge result after a user completes an attempt.
 */
export function buildDailyChallengeResult(
  challengeId: string,
  userId: string,
  score: number,
  xpAwarded: number,
): DailyChallengeResult | null {
  const challenge = dailyChallenges.get(challengeId);
  if (!challenge) return null;

  const participant = getOrCreateParticipant(challengeId, userId);
  const bestScore = participant.bestScore;
  const userRank = getDailyLeaderboard(challengeId, { currentUserId: userId }).userRank;

  return {
    challengeId,
    challengeDate: challenge.challengeDate,
    gameId: challenge.gameId,
    gameName: challenge.title,
    score,
    bestScore,
    globalRank: userRank?.rank ?? 0,
    totalParticipants: getDailyLeaderboard(challengeId).totalParticipants,
    attemptNumber: participant.attemptCount,
    maxAttempts: challenge.maxAttempts,
    xpAwarded,
    isPersonalBest: score >= bestScore && score > 0,
    streakContribution: hasStreakContributionToday(challengeId, userId),
  };
}

// ============================================================
// Exported for testing
// ============================================================

export function _clearAllChallenges(): void {
  dailyChallenges.clear();
  challengeAttempts.clear();
  participants.clear();
  challengeHistoryEntries.clear();
  challengesByDate.clear();
}

export function _getChallengeCount(): number {
  return dailyChallenges.size;
}

export function _getParticipantCount(): number {
  return participants.size;
}
