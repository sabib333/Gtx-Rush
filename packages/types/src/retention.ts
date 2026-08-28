/**
 * GTX Rush — Retention Engine Types v1.0
 *
 * Type definitions for the Retention & Progression Engine.
 * Covers missions, streaks, rewards, inventory, and retention analytics.
 *
 * Contract: Retention Engine Contract v1.0
 */

// ============================================================
// Mission Types
// ============================================================

export type MissionType =
  | 'PLAY_GAME'
  | 'COMPLETE_GAME'
  | 'SCORE_THRESHOLD'
  | 'WIN_CHALLENGE'
  | 'COMPLETE_DAILY_RUSH'
  | 'ACHIEVE_COMBO'
  | 'ACHIEVE_ACCURACY'
  | 'ANSWER_CORRECTLY'
  | 'SET_PERSONAL_BEST'
  | 'SHARE_RESULT';

export type MissionFrequency = 'daily' | 'weekly' | 'monthly' | 'once';

export type MissionStatus = 'active' | 'completed' | 'expired' | 'claimed';

export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export type MissionRewardType = 'xp' | 'badge' | 'title' | 'cosmetic' | 'profile_frame';

export interface MissionDefinition {
  id: string;
  name: string;
  description: string;
  type: MissionType;
  target: number;
  gameId: string | null;
  configuration: MissionConfiguration;
  rewardConfiguration: MissionRewardConfiguration;
  frequency: MissionFrequency;
  difficulty: MissionDifficulty;
  status: 'active' | 'inactive';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MissionConfiguration {
  /** Game-specific filters */
  gameId?: string;
  /** Minimum score threshold for SCORE_THRESHOLD missions */
  minScore?: number;
  /** Minimum accuracy percentage for ACHIEVE_ACCURACY missions */
  minAccuracy?: number;
  /** Combo threshold for ACHIEVE_COMBO missions */
  comboThreshold?: number;
  /** Challenge type filter for WIN_CHALLENGE missions */
  challengeType?: string;
  /** Additional configuration */
  [key: string]: unknown;
}

export interface MissionRewardConfiguration {
  xp: number;
  badgeId?: string;
  titleId?: string;
  cosmeticId?: string;
  profileFrameId?: string;
}

// ============================================================
// User Mission Instances
// ============================================================

export interface UserMission {
  id: string;
  userId: string;
  missionId: string;
  period: string; // YYYY-MM-DD for daily, YYYY-Www for weekly, YYYY-MM for monthly
  progress: number;
  target: number;
  status: MissionStatus;
  completedAt: Date | null;
  rewardClaimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMissionWithDefinition extends UserMission {
  mission: MissionDefinition;
}

// ============================================================
// Mission Progress Events
// ============================================================

export type MissionEventType =
  | 'GAME_COMPLETED'
  | 'DAILY_RUSH_COMPLETED'
  | 'CHALLENGE_WON'
  | 'SCORE_RECORDED'
  | 'PERSONAL_BEST'
  | 'COMBO_ACHIEVED'
  | 'ACCURACY_ACHIEVED'
  | 'CORRECT_ANSWER'
  | 'SHARE_RESULT';

export interface MissionProgressEvent {
  userId: string;
  eventType: MissionEventType;
  gameId: string;
  timestamp: Date;
  metadata: {
    score?: number;
    accuracy?: number;
    combo?: number;
    correctAnswers?: number;
    challengeId?: string;
    sessionId?: string;
    isPersonalBest?: boolean;
  };
}

// ============================================================
// Streak Types
// ============================================================

export type StreakStatus = 'active' | 'at_risk' | 'broken';

export interface Streak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD in UTC
  lastQualifyingActivityAt: Date | null;
  status: StreakStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreakMilestone {
  id: string;
  daysRequired: number;
  rewardType: MissionRewardType;
  rewardValue: string;
  rewardConfiguration: MissionRewardConfiguration;
  isActive: boolean;
}

export interface UserStreakMilestone {
  id: string;
  userId: string;
  milestoneId: string;
  streakDays: number;
  earnedAt: Date;
  rewardClaimedAt: Date | null;
}

export interface StreakDay {
  date: string; // YYYY-MM-DD
  qualifyingActivity: boolean;
  activityCount: number;
}

export interface StreakResponse {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  status: StreakStatus;
  lastActiveDate: string;
  daysUntilNextMilestone: number;
  nextMilestone: StreakMilestone | null;
  weekActivity: StreakDay[];
  todayCompleted: boolean;
}

// ============================================================
// Reward Inventory Types
// ============================================================

export type RewardItemType = 'badge' | 'title' | 'cosmetic' | 'profile_frame' | 'xp';

export type RewardItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RewardItem {
  id: string;
  type: RewardItemType;
  name: string;
  description: string;
  rarity: RewardItemRarity;
  iconUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export interface UserInventoryItem {
  id: string;
  userId: string;
  itemId: string;
  itemType: RewardItemType;
  source: string;
  sourceReferenceId: string | null;
  metadata: Record<string, unknown>;
  grantedAt: Date;
}

export interface RetentionRewardTransaction {
  id: string;
  userId: string;
  source: RetentionRewardSource;
  referenceId: string;
  referenceType: string;
  rewardType: RewardItemType;
  rewardValue: number | string;
  idempotencyKey: string;
  createdAt: Date;
}

export type RetentionRewardSource =
  | 'mission_reward'
  | 'streak_milestone'
  | 'level_up'
  | 'season_reward'
  | 'daily_rush'
  | 'badge_reward'
  | 'admin_grant';

// ============================================================
// Level Progression Types
// ============================================================

export interface LevelUpEvent {
  userId: string;
  previousLevel: number;
  newLevel: number;
  xpAwarded: number;
  xpTotal: number;
  unlockedRewards: MissionRewardConfiguration[];
  timestamp: Date;
}

// ============================================================
// Retention Analytics Types
// ============================================================

export type RetentionAnalyticsEvent =
  | 'mission_viewed'
  | 'mission_started'
  | 'mission_progressed'
  | 'mission_completed'
  | 'mission_claimed'
  | 'mission_expired'
  | 'streak_started'
  | 'streak_extended'
  | 'streak_milestone'
  | 'streak_broken'
  | 'level_up'
  | 'reward_unlocked'
  | 'reward_claimed'
  | 'daily_rush_viewed'
  | 'retention_home_viewed';

export interface RetentionAnalyticsData {
  eventName: RetentionAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// API Response Types
// ============================================================

export interface DailyMissionsResponse {
  missions: UserMissionWithDefinition[];
  completedCount: number;
  totalCount: number;
  period: string;
}

export interface WeeklyMissionsResponse {
  missions: UserMissionWithDefinition[];
  completedCount: number;
  totalCount: number;
  period: string;
}

export interface MissionProgressResponse {
  missionId: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardClaimable: boolean;
}

export interface ClaimMissionRewardRequest {
  missionId: string;
}

export interface ClaimMissionRewardResponse {
  success: boolean;
  reward: {
    type: MissionRewardType;
    value: number | string;
    description: string;
  };
  xpAwarded: number;
  newTotal: number;
  levelUp: boolean;
  newLevel?: number;
}

export interface StreakInfoResponse {
  currentStreak: number;
  longestStreak: number;
  status: StreakStatus;
  lastActiveDate: string;
  todayCompleted: boolean;
  daysUntilNextMilestone: number;
  nextMilestone: StreakMilestone | null;
  weekActivity: StreakDay[];
}

export interface RewardHistoryResponse {
  transactions: RetentionRewardTransaction[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface RetentionHomeResponse {
  dailyRush: {
    gameId: string;
    gameName: string;
    userBestScore: number;
    isActive: boolean;
  } | null;
  streak: StreakResponse;
  dailyMissions: DailyMissionsResponse;
  weeklyMissions: WeeklyMissionsResponse;
  level: {
    current: number;
    xpTotal: number;
    xpToNextLevel: number;
    progress: number;
  };
  rank: {
    global: number | null;
    tier: string | null;
  };
}
