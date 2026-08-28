/**
 * GTX Rush — Creator & User-Generated Content Engine Types
 *
 * Handles:
 * - Creator profiles
 * - Custom challenges
 * - Content validation
 * - Community discovery
 * - Creator following
 * - Moderation
 *
 * Contract: Creator Engine Contract v1.0
 */

import type { GameId } from './personalization';

// ============================================================
// Creator Types
// ============================================================

export type CreatorStatus = 'normal' | 'creator' | 'verified_creator';

export type ChallengeVisibility = 'public' | 'private' | 'unlisted';

export type CustomChallengeStatus = 'draft' | 'published' | 'paused' | 'archived' | 'removed';

export type ContentQuality = 'high' | 'normal' | 'low' | 'review_required';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'under_review';

export type ModerationAction = 'warning' | 'limited_creation' | 'content_removed' | 'creator_suspended';

export type CreatorReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual_content'
  | 'violence'
  | 'scam'
  | 'impersonation'
  | 'copyright_concern'
  | 'malicious_content'
  | 'other';

// ============================================================
// Creator Profile
// ============================================================

export interface CreatorProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  status: CreatorStatus;
  creatorLevel: number;
  creatorXp: number;
  totalChallengesCreated: number;
  totalPlaysReceived: number;
  totalUniquePlayers: number;
  averageCompletionRate: number;
  totalShares: number;
  totalReactions: number;
  totalReports: number;
  qualityScore: ContentQuality;
  moderationRecord: ModerationAction[];
  badges: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorProfileWithStats extends CreatorProfile {
  followerCount: number;
  isFollowing: boolean;
  recentChallenges: CustomChallenge[];
  popularChallenges: CustomChallenge[];
}

// ============================================================
// Custom Challenge
// ============================================================

export interface CustomChallenge {
  id: string;
  creatorId: string;
  gameId: GameId;
  title: string;
  description: string;
  rules: CustomChallengeRules;
  difficulty: ChallengeDifficulty;
  config: CustomChallengeConfig;
  visibility: ChallengeVisibility;
  status: CustomChallengeStatus;
  version: number;
  qualityScore: ContentQuality;
  moderationStatus: ModerationStatus;
  stats: ChallengeStats;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
  archivedAt: Date | null;
}

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface CustomChallengeRules {
  goalType: 'beat_score' | 'survive_time' | 'complete_rounds' | 'answer_correctly';
  goalValue: number;
  timeLimit: number | null;
  roundLimit: number | null;
  allowedRetries: number;
  scoringMethod: 'best' | 'total' | 'average';
}

export interface CustomChallengeConfig {
  reaction?: ReactionRushConfig;
  tap?: TapRushConfig;
  quiz?: QuizRushConfig;
}

export interface ReactionRushConfig {
  rounds: number;
  timeWindow: number;
  targetPattern: 'random' | 'sequential' | 'custom';
  difficulty: number; // 1-10
}

export interface TapRushConfig {
  duration: number;
  targetCount: number;
  comboRequired: boolean;
  difficulty: number; // 1-10
}

export interface QuizRushConfig {
  questionCount: number;
  categories: string[];
  difficulty: number; // 1-10
  timePerQuestion: number;
}

// ============================================================
// Challenge Stats
// ============================================================

export interface ChallengeStats {
  totalPlays: number;
  uniquePlayers: number;
  completions: number;
  completionRate: number;
  averageScore: number;
  bestScore: number;
  shares: number;
  reactions: number;
  reports: number;
  trendingScore: number;
  lastPlayedAt: Date | null;
}

// ============================================================
// Creator Following
// ============================================================

export interface CreatorFollow {
  id: string;
  followerId: string;
  creatorId: string;
  createdAt: Date;
}

// ============================================================
// Moderation
// ============================================================

export interface ContentReport {
  id: string;
  reporterId: string;
  contentType: 'challenge' | 'creator' | 'comment';
  contentId: string;
  reason: CreatorReportReason;
  description: string | null;
  status: ModerationStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  action: ModerationAction | null;
  createdAt: Date;
}

export interface ModerationRecord {
  id: string;
  creatorId: string;
  action: ModerationAction;
  reason: string;
  challengeId: string | null;
  performedBy: string;
  expiresAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Challenge Versioning
// ============================================================

export interface ChallengeVersion {
  id: string;
  challengeId: string;
  version: number;
  rules: CustomChallengeRules;
  config: CustomChallengeConfig;
  title: string;
  description: string;
  createdAt: Date;
}

// ============================================================
// Creator Analytics
// ============================================================

export interface CreatorAnalytics {
  period: 'day' | 'week' | 'month';
  challengesCreated: number;
  challengesPublished: number;
  totalPlays: number;
  uniquePlayers: number;
  completions: number;
  shares: number;
  reactions: number;
  reports: number;
  newFollowers: number;
}

// ============================================================
// Community Discovery
// ============================================================

export interface CommunityChallengeFeed {
  challenges: CustomChallengeWithCreator[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface CustomChallengeWithCreator extends CustomChallenge {
  creator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    creatorLevel: number;
    status: CreatorStatus;
  };
}

export type DiscoverySort = 'trending' | 'new' | 'popular' | 'friends';

// ============================================================
// API Request/Response Types
// ============================================================

export interface CreateChallengeRequest {
  gameId: GameId;
  title: string;
  description?: string;
  difficulty: ChallengeDifficulty;
  rules: CustomChallengeRules;
  config: CustomChallengeConfig;
  visibility?: ChallengeVisibility;
}

export interface UpdateChallengeRequest {
  title?: string;
  description?: string;
  difficulty?: ChallengeDifficulty;
  rules?: CustomChallengeRules;
  config?: CustomChallengeConfig;
  visibility?: ChallengeVisibility;
}

export interface ChallengeListResponse {
  success: boolean;
  data: {
    challenges: CustomChallengeWithCreator[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
  };
}

export interface CreatorProfileResponse {
  success: boolean;
  data: {
    profile: CreatorProfileWithStats;
  };
}

export interface CreatorDashboardResponse {
  success: boolean;
  data: {
    profile: CreatorProfile;
    recentChallenges: CustomChallenge[];
    stats: CreatorAnalytics;
  };
}

export interface ReportChallengeRequest {
  reason: CreatorReportReason;
  description?: string;
}

export interface CreatorFollowResponse {
  success: boolean;
  data: {
    isFollowing: boolean;
    followerCount: number;
  };
}
