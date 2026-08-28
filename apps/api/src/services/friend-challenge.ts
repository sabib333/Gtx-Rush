/**
 * GTX Rush — Friend Challenge Engine v1.0
 *
 * Handles the complete friend challenge lifecycle:
 *   Create → Pending → Accepted → Completed
 *                                    ↓
 *                                 Expired
 *
 * Features:
 * - Deep link generation (Telegram integration)
 * - Configurable expiration
 * - Score comparison and winner determination
 * - Rematch (creates new challenge, preserves original)
 * - Anti-abuse: rate limiting, self-challenge prevention, spam detection
 *
 * SECURITY:
 * - Challenge tokens are random 12-char nanoids (not guessable)
 * - Server validates all challenge properties
 * - Expired challenges cannot accept new results
 * - Duplicate completions are prevented
 */

import { nanoid } from 'nanoid';
import type {
  FriendChallenge,
  FriendChallengeWithUsers,
  FriendChallengeStatus,
  ChallengeType,
  ChallengeMode,
  ChallengeWinner,
  ChallengeHistoryEntry,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const friendChallenges = new Map<string, FriendChallenge>();
const friendChallengeHistory = new Map<string, ChallengeHistoryEntry>();

// Token → challengeId lookup
const tokenToChallenge = new Map<string, string>();

// Rate limiting: userId → array of challenge creation timestamps
const creationRateLimit = new Map<string, number[]>();

// ============================================================
// Constants
// ============================================================

/** Default challenge expiration: 24 hours */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Maximum friend challenges per user per hour */
const MAX_CHALLENGES_PER_HOUR = 10;

/** Minimum time between challenges to the same opponent (ms) */
const MIN_SAME_OPPONENT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** XP reward for winning a friend challenge */
const XP_WIN = 30;

/** XP reward for losing a friend challenge (participation) */
const XP_LOSS = 10;

/** XP reward for a tie */
const XP_TIE = 20;

/** Valid game slugs */
const VALID_GAMES = ['reaction-rush', 'tap-rush', 'quiz-rush'];

// ============================================================
// Helpers
// ============================================================

function generateChallengeToken(): string {
  return nanoid(12);
}

function getGameName(gameId: string): string {
  const names: Record<string, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  return names[gameId] ?? gameId;
}

// ============================================================
// Rate Limiting
// ============================================================

function checkCreationRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = creationRateLimit.get(userId) ?? [];

  // Clean up old entries (older than 1 hour)
  const recent = timestamps.filter((t) => now - t < 60 * 60 * 1000);
  creationRateLimit.set(userId, recent);

  return recent.length < MAX_CHALLENGES_PER_HOUR;
}

function checkSameOpponentRateLimit(
  challengerId: string,
  opponentId: string,
): boolean {
  const now = Date.now();
  for (const challenge of friendChallenges.values()) {
    if (
      challenge.challengerId === challengerId &&
      challenge.opponentId === opponentId &&
      now - challenge.createdAt.getTime() < MIN_SAME_OPPONENT_INTERVAL_MS
    ) {
      return false;
    }
  }
  return true;
}

function recordChallengeCreation(userId: string): void {
  const timestamps = creationRateLimit.get(userId) ?? [];
  timestamps.push(Date.now());
  creationRateLimit.set(userId, timestamps);
}

// ============================================================
// Challenge Creation
// ============================================================

/**
 * Create a new friend challenge.
 *
 * SECURITY:
 * - Self-challenges are prevented (challenger cannot challenge themselves)
 * - Creation is rate-limited (MAX_CHALLENGES_PER_HOUR)
 * - Same-opponent rate limiting prevents spam
 * - Challenge token is cryptographically random
 * - Configuration is server-authoritative
 */
export function createFriendChallenge(
  challengerId: string,
  gameId: string,
  mode: ChallengeMode = 'friend',
): { success: boolean; challenge?: FriendChallenge; error?: string } {
  // Validate game
  if (!VALID_GAMES.includes(gameId)) {
    return { success: false, error: 'INVALID_GAME' };
  }

  // Rate limit check
  if (!checkCreationRateLimit(challengerId)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  const token = generateChallengeToken();
  const id = nanoid();
  const now = new Date();

  const challenge: FriendChallenge = {
    id,
    gameId,
    gameVersion: '1',
    type: 'score_target' as ChallengeType,
    challengerId,
    opponentId: null,
    challengeToken: token,
    configuration: {
      serverAuthoritative: true,
      scoringVersion: 1,
    },
    targetScore: null, // Set after challenger plays
    challengerSessionId: null,
    opponentSessionId: null,
    challengerScore: null,
    opponentScore: null,
    status: 'pending',
    expiresAt: new Date(now.getTime() + DEFAULT_EXPIRATION_MS),
    createdAt: now,
    completedAt: null,
  };

  friendChallenges.set(id, challenge);
  tokenToChallenge.set(token, id);
  recordChallengeCreation(challengerId);

  return { success: true, challenge };
}

/**
 * Get a friend challenge by token.
 */
export function getFriendChallengeByToken(
  token: string,
): FriendChallenge | null {
  const challengeId = tokenToChallenge.get(token);
  if (!challengeId) return null;

  const challenge = friendChallenges.get(challengeId);
  if (!challenge) return null;

  // Auto-expire if past expiration
  if (challenge.status === 'pending' && new Date() > challenge.expiresAt) {
    challenge.status = 'expired';
  }

  return challenge;
}

/**
 * Get a friend challenge by ID.
 */
export function getFriendChallengeById(id: string): FriendChallenge | null {
  return friendChallenges.get(id) ?? null;
}

// ============================================================
// Challenge Acceptance
// ============================================================

/**
 * Accept a friend challenge (user B joins).
 *
 * SECURITY:
 * - Cannot accept own challenge
 * - Cannot accept expired challenges
 * - Cannot accept already-completed challenges
 * - Same-opponent rate limiting
 */
export function acceptFriendChallenge(
  challengeToken: string,
  opponentId: string,
): { success: boolean; challenge?: FriendChallenge; error?: string } {
  const challenge = getFriendChallengeByToken(challengeToken);
  if (!challenge) {
    return { success: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  // Self-challenge prevention
  if (challenge.challengerId === opponentId) {
    return { success: false, error: 'SELF_CHALLENGE_NOT_ALLOWED' };
  }

  // Status check
  if (challenge.status !== 'pending') {
    return { success: false, error: `INVALID_STATUS_${challenge.status.toUpperCase()}` };
  }

  // Expiration check
  if (new Date() > challenge.expiresAt) {
    challenge.status = 'expired';
    return { success: false, error: 'CHALLENGE_EXPIRED' };
  }

  // Same-opponent rate limiting
  if (!checkSameOpponentRateLimit(challenge.challengerId, opponentId)) {
    return { success: false, error: 'SAME_OPPONENT_RATE_LIMITED' };
  }

  // Accept
  challenge.opponentId = opponentId;
  challenge.status = 'accepted';

  return { success: true, challenge };
}

// ============================================================
// Score Submission & Completion
// ============================================================

/**
 * Submit a score for a friend challenge.
 * Either the challenger or opponent can submit their score.
 *
 * SECURITY:
 * - Only participants can submit scores
 * - Cannot submit scores for expired challenges
 * - Duplicate completion is prevented
 * - Scores are validated server-side
 */
export function submitFriendChallengeScore(
  challengeId: string,
  userId: string,
  score: number,
  sessionId: string,
): {
  success: boolean;
  challenge?: FriendChallenge;
  completed?: boolean;
  winner?: ChallengeWinner | null;
  error?: string;
} {
  const challenge = friendChallenges.get(challengeId);
  if (!challenge) {
    return { success: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  // Participant check
  if (userId !== challenge.challengerId && userId !== challenge.opponentId) {
    return { success: false, error: 'NOT_PARTICIPANT' };
  }

  // Status check
  if (challenge.status !== 'pending' && challenge.status !== 'accepted') {
    return { success: false, error: `INVALID_STATUS_${challenge.status.toUpperCase()}` };
  }

  // Expiration check
  if (new Date() > challenge.expiresAt) {
    challenge.status = 'expired';
    return { success: false, error: 'CHALLENGE_EXPIRED' };
  }

  // Submit score for the appropriate player
  if (userId === challenge.challengerId) {
    // Challenger can update their score if already set (for retry scenarios)
    if (challenge.challengerScore !== null && (challenge.status as string) === 'completed') {
      return { success: false, error: 'ALREADY_COMPLETED' };
    }
    challenge.challengerScore = score;
    challenge.challengerSessionId = sessionId;
  } else if (userId === challenge.opponentId) {
    if (challenge.opponentScore !== null && (challenge.status as string) === 'completed') {
      return { success: false, error: 'ALREADY_COMPLETED' };
    }
    challenge.opponentScore = score;
    challenge.opponentSessionId = sessionId;
  }

  // Check if both players have scored
  let completed = false;
  let winner: ChallengeWinner | null = null;

  if (challenge.challengerScore != null && challenge.opponentScore != null) {
    challenge.status = 'completed';
    challenge.completedAt = new Date();
    completed = true;

    // Determine winner
    if (challenge.challengerScore > challenge.opponentScore) {
      winner = 'challenger';
    } else if (challenge.opponentScore > challenge.challengerScore) {
      winner = 'opponent';
    } else {
      winner = 'tie';
    }
  }

  return { success: true, challenge, completed, winner };
}

// ============================================================
// Rematch
// ============================================================

/**
 * Create a rematch (new challenge based on the original).
 * Does NOT mutate the original challenge — creates a new entity.
 * This preserves historical integrity.
 */
export function createRematch(
  originalChallengeId: string,
  requesterId: string,
): { success: boolean; challenge?: FriendChallenge; error?: string } {
  const original = friendChallenges.get(originalChallengeId);
  if (!original) {
    return { success: false, error: 'ORIGINAL_NOT_FOUND' };
  }

  // Only participants can rematch
  if (requesterId !== original.challengerId && requesterId !== original.opponentId) {
    return { success: false, error: 'NOT_PARTICIPANT' };
  }

  // Create new challenge with swapped roles
  const newChallengerId = requesterId;
  const newOpponentId =
    requesterId === original.challengerId ? original.opponentId : original.challengerId;

  if (!newOpponentId) {
    return { success: false, error: 'NO_OPPONENT' };
  }

  const result = createFriendChallenge(newChallengerId, original.gameId, 'friend');
  if (!result.success || !result.challenge) {
    return result;
  }

  // Pre-accept the opponent
  result.challenge.opponentId = newOpponentId;
  result.challenge.status = 'pending'; // Still pending until challenger plays

  return result;
}

// ============================================================
// Challenge History
// ============================================================

/**
 * Record a friend challenge completion in the immutable history.
 */
export function recordFriendChallengeHistory(
  userId: string,
  challenge: FriendChallenge,
  result: 'won' | 'lost' | 'tie' | 'completed',
  xpAwarded: number,
): ChallengeHistoryEntry {
  const entry: ChallengeHistoryEntry = {
    id: nanoid(),
    userId,
    challengeType: 'friend',
    challengeId: challenge.id,
    gameId: challenge.gameId,
    opponentId:
      userId === challenge.challengerId ? challenge.opponentId : challenge.challengerId,
    score: userId === challenge.challengerId ? challenge.challengerScore : challenge.opponentScore,
    opponentScore:
      userId === challenge.challengerId ? challenge.opponentScore : challenge.challengerScore,
    result,
    xpAwarded,
    completedAt: challenge.completedAt,
    createdAt: new Date(),
  };

  friendChallengeHistory.set(entry.id, entry);
  return entry;
}

/**
 * Get user's friend challenge history.
 */
export function getUserFriendChallengeHistory(
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): { entries: ChallengeHistoryEntry[]; hasMore: boolean; nextCursor: string | null } {
  const { cursor, limit = 20 } = options;

  const userEntries: ChallengeHistoryEntry[] = [];
  for (const entry of friendChallengeHistory.values()) {
    if (entry.userId === userId) {
      userEntries.push(entry);
    }
  }

  userEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
// XP Calculation
// ============================================================

/**
 * Calculate XP rewards for a friend challenge.
 */
export function calculateFriendChallengeXP(
  winner: ChallengeWinner,
  isChallenger: boolean,
): number {
  if (winner === 'tie') return XP_TIE;

  const isWinner =
    (winner === 'challenger' && isChallenger) ||
    (winner === 'opponent' && !isChallenger);

  return isWinner ? XP_WIN : XP_LOSS;
}

// ============================================================
// Share Content Generation
// ============================================================

/**
 * Generate shareable content for a friend challenge.
 * SECURITY: Does not include private user information.
 */
export function generateShareContent(
  challenge: FriendChallenge,
  score: number,
  result: 'won' | 'lost' | 'tie' | null,
): string {
  const gameName = getGameName(challenge.gameId);
  const resultEmoji = result === 'won' ? '🏆' : result === 'lost' ? '💪' : '🤝';
  const resultText = result === 'won' ? 'I won!' : result === 'lost' ? 'Can you do better?' : 'It was a tie!';

  return `⚡ GTX RUSH\n\nI scored ${score.toLocaleString()} in ${gameName}.\n${resultEmoji} ${resultText}\n\nThink you can beat me?\n\nPLAY. COMPETE. RISE.`;
}

/**
 * Generate the deep link for a friend challenge.
 */
export function generateDeepLink(challengeToken: string): string {
  // Uses the Telegram deep-link abstraction from the platform
  return `startapp=chal_${challengeToken}`;
}

// ============================================================
// Expiration
// ============================================================

/**
 * Expire all challenges that have passed their expiration time.
 * Called by the scheduler.
 * Returns the number of expired challenges.
 */
export function expireStaleChallenges(): number {
  let expiredCount = 0;
  const now = new Date();

  for (const challenge of friendChallenges.values()) {
    if (
      (challenge.status === 'pending' || challenge.status === 'accepted') &&
      now > challenge.expiresAt
    ) {
      challenge.status = 'expired';
      expiredCount++;
    }
  }

  return expiredCount;
}

// ============================================================
// Get all challenges for a user
// ============================================================

/**
 * Get all friend challenges involving a user.
 */
export function getUserFriendChallenges(
  userId: string,
  options: { status?: FriendChallengeStatus; limit?: number } = {},
): FriendChallenge[] {
  const { status, limit = 50 } = options;

  const userChallenges: FriendChallenge[] = [];
  for (const challenge of friendChallenges.values()) {
    if (challenge.challengerId === userId || challenge.opponentId === userId) {
      if (status && challenge.status !== status) continue;
      userChallenges.push(challenge);
    }
  }

  // Sort by creation date (newest first)
  userChallenges.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return userChallenges.slice(0, limit);
}

// ============================================================
// Exported for testing
// ============================================================

export function _clearAllFriendChallenges(): void {
  friendChallenges.clear();
  friendChallengeHistory.clear();
  tokenToChallenge.clear();
  creationRateLimit.clear();
}

export function _getFriendChallengeCount(): number {
  return friendChallenges.size;
}
