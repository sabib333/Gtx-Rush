/**
 * GTX Rush — Challenge Engine Types v1.0
 *
 * Type definitions for Daily Rush and Friend Challenge systems.
 * These types are the single source of truth for the Challenge Engine.
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type ChallengeStatus = 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';
export type FriendChallengeStatus = 'pending' | 'accepted' | 'completed' | 'expired' | 'cancelled';
export type ChallengeType = 'score_target' | 'head_to_head';
export type ChallengeMode = 'normal' | 'daily_rush' | 'friend';
export type ChallengeWinner = 'challenger' | 'opponent' | 'tie';

// ============================================================
// Daily Challenge
// ============================================================

export interface DailyChallenge {
  id: string;
  gameId: string;
  gameVersion: string;
  title: string;
  description: string;
  challengeDate: string; // YYYY-MM-DD
  mode: ChallengeMode;
  configuration: DailyChallengeConfiguration;
  rules: Record<string, unknown>;
  maxAttempts: number;
  startsAt: Date;
  endsAt: Date;
  status: ChallengeStatus;
  rewardConfiguration: RewardConfiguration;
  rewardXp: number;
  rewardBadgeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyChallengeConfiguration {
  timeLimitMs?: number;
  difficulty?: string;
  questionCount?: number;
  [key: string]: unknown;
}

export interface RewardConfiguration {
  xp: number;
  streakBonus?: number;
  badgeId?: string;
  cosmeticUnlock?: string;
  titleUnlock?: string;
  [key: string]: unknown;
}

// ============================================================
// Challenge Attempts
// ============================================================

export interface ChallengeAttempt {
  id: string;
  challengeId: string;
  userId: string;
  sessionId: string;
  score: number;
  attemptNumber: number;
  completionTimeMs: number | null;
  isValid: boolean;
  createdAt: Date;
}

// ============================================================
// Daily Challenge Participants
// ============================================================

export interface DailyChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  bestScore: number;
  attemptCount: number;
  lastAttemptAt: Date | null;
  rewardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Friend Challenge
// ============================================================

export interface FriendChallenge {
  id: string;
  gameId: string;
  gameVersion: string;
  type: ChallengeType;
  challengerId: string;
  opponentId: string | null;
  challengeToken: string;
  configuration: Record<string, unknown>;
  targetScore: number | null;
  challengerSessionId: string | null;
  opponentSessionId: string | null;
  challengerScore: number | null;
  opponentScore: number | null;
  status: FriendChallengeStatus;
  expiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
}

export interface FriendChallengeWithUsers extends FriendChallenge {
  challenger: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  };
  opponent: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  } | null;
}

// ============================================================
// Challenge History (immutable record)
// ============================================================

export interface ChallengeHistoryEntry {
  id: string;
  userId: string;
  challengeType: string; // 'daily_rush' | 'friend'
  challengeId: string;
  gameId: string;
  opponentId: string | null;
  score: number | null;
  opponentScore: number | null;
  result: string | null; // 'won' | 'lost' | 'tie' | 'completed'
  xpAwarded: number;
  completedAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Daily Leaderboard
// ============================================================

export interface DailyLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  country: string;
  score: number;
  completionTimeMs: number | null;
  attemptCount: number;
  isCurrentUser?: boolean;
}

export interface DailyLeaderboardResponse {
  challengeId: string;
  challengeDate: string;
  gameId: string;
  entries: DailyLeaderboardEntry[];
  userRank: DailyLeaderboardEntry | null;
  totalParticipants: number;
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================================
// Challenge Result
// ============================================================

export interface DailyChallengeResult {
  challengeId: string;
  challengeDate: string;
  gameId: string;
  gameName: string;
  score: number;
  bestScore: number;
  globalRank: number;
  totalParticipants: number;
  attemptNumber: number;
  maxAttempts: number;
  xpAwarded: number;
  isPersonalBest: boolean;
  streakContribution: boolean;
}

export interface FriendChallengeResult {
  challengeId: string;
  gameId: string;
  gameName: string;
  challengerScore: number;
  opponentScore: number | null;
  winner: ChallengeWinner | null;
  xpAwarded: {
    challenger: number;
    opponent: number;
  };
  completedAt: Date;
}

// ============================================================
// API Request / Response Types
// ============================================================

export interface CreateFriendChallengeRequest {
  gameId: string;
  mode?: ChallengeMode;
}

export interface CreateFriendChallengeResponse {
  challengeId: string;
  challengeToken: string;
  gameId: string;
  gameName: string;
  deepLink: string;
  expiresAt: string;
}

export interface StartDailyChallengeRequest {
  challengeId: string;
  clientSessionToken: string;
}

export interface StartDailyChallengeResponse {
  sessionId: string;
  challengeId: string;
  gameVersion: string;
  gameConfig: Record<string, unknown>;
  attemptNumber: number;
  maxAttempts: number;
  expiresAt: number;
}

export interface StartFriendChallengeRequest {
  challengeToken: string;
  clientSessionToken: string;
}

export interface StartFriendChallengeResponse {
  sessionId: string;
  challengeId: string;
  challengeToken: string;
  gameId: string;
  gameVersion: string;
  gameConfig: Record<string, unknown>;
  targetScore: number | null;
  expiresAt: number;
}

export interface GetDailyChallengeResponse {
  challenge: DailyChallenge;
  gameName: string;
  userBestScore: number | null;
  userRank: number | null;
  userAttemptCount: number;
  userRemainingAttempts: number;
  timeRemaining: number; // ms
  isActive: boolean;
}

export interface GetFriendChallengeResponse {
  challenge: FriendChallengeWithUsers;
  gameName: string;
}

export interface GetChallengeHistoryQuery {
  cursor?: string;
  limit?: number;
  challengeType?: 'daily_rush' | 'friend';
}

export interface GetChallengeHistoryResponse {
  entries: ChallengeHistoryEntry[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface DailyLeaderboardQuery {
  filter?: 'global' | 'country' | 'friends';
  cursor?: string;
  limit?: number;
}

// ============================================================
// Analytics Event Names (Challenge-specific)
// ============================================================

export type ChallengeAnalyticsEvent =
  | 'daily_challenge_viewed'
  | 'daily_challenge_started'
  | 'daily_challenge_completed'
  | 'daily_challenge_attempted'
  | 'daily_challenge_personal_best'
  | 'daily_challenge_shared'
  | 'friend_challenge_created'
  | 'friend_challenge_opened'
  | 'friend_challenge_started'
  | 'friend_challenge_completed'
  | 'friend_challenge_won'
  | 'friend_challenge_lost'
  | 'friend_challenge_shared'
  | 'challenge_expired'
  | 'challenge_abuse_detected';

// ============================================================
// Scheduled Job Types
// ============================================================

export interface ScheduledJobResult {
  jobName: string;
  startedAt: Date;
  completedAt: Date;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}
