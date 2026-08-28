/**
 * GTX Rush — LiveOps Types v1.0
 *
 * Type definitions for the Live Operations Engine.
 * Covers seasons, battle pass, missions, events, community goals, analytics, and admin.
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type LiveOpsSeasonStatus = 'draft' | 'scheduled' | 'active' | 'ending' | 'ended' | 'archived';
export type BattlePassTrack = 'free' | 'premium';
export type BattlePassStatus = 'active' | 'purchased' | 'expired';
export type MissionCategory = 'daily' | 'weekly' | 'seasonal' | 'event' | 'special' | 'community';
export type MissionRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type MissionRerollStatus = 'available' | 'rerolled' | 'locked';
export type LiveOpsEventType = 'score' | 'win' | 'time_attack' | 'community' | 'team' | 'creator' | 'challenge' | 'season';
export type EventEntryType = 'free' | 'qualified' | 'invite_based' | 'team_based';
export type LiveOpsEventStatus = 'draft' | 'scheduled' | 'active' | 'ending' | 'completed' | 'archived' | 'cancelled';
export type CommunityGoalStatus = 'active' | 'completed' | 'expired';
export type TeamEventType = 'score' | 'wins' | 'participation' | 'mission_completion';
export type ContentRotationType = 'games' | 'challenges' | 'missions' | 'creators' | 'events';
export type LoginRewardStatus = 'available' | 'claimed' | 'expired';
export type DailyLoginResetMode = 'strict' | 'lenient';

// ============================================================
// LiveOps Season
// ============================================================

export interface LiveOpsSeason {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: LiveOpsSeasonStatus;
  theme: string;
  bannerUrl: string | null;
  rewardTrack: LiveOpsRewardTrack;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveOpsRewardTrack {
  levels: LiveOpsSeasonLevel[];
  totalLevels: number;
}

export interface LiveOpsSeasonLevel {
  level: number;
  xpRequired: number;
  freeReward: LiveOpsReward | null;
  premiumReward: LiveOpsReward | null;
}

export interface LiveOpsReward {
  type: 'xp' | 'badge' | 'title' | 'cosmetic' | 'profile_frame' | 'profile_bg' | 'emote' | 'theme' | 'event_ticket';
  value: string | number;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  itemId: string | null;
}

// ============================================================
// Season Progression
// ============================================================

export interface SeasonProgression {
  userId: string;
  seasonId: string;
  seasonXp: number;
  seasonLevel: number;
  totalXpEarned: number;
  lastXpAwardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonXpTransaction {
  id: string;
  userId: string;
  seasonId: string;
  amount: number;
  source: SeasonXpSource;
  referenceId: string | null;
  referenceType: string | null;
  balanceAfter: number;
  idempotencyKey: string;
  createdAt: Date;
}

export type SeasonXpSource =
  | 'game_play'
  | 'game_win'
  | 'mission_complete'
  | 'mission_reward'
  | 'streak_bonus'
  | 'event_participation'
  | 'event_reward'
  | 'daily_login'
  | 'admin_grant'
  | 'battle_pass_bonus';

// ============================================================
// Battle Pass
// ============================================================

export interface BattlePass {
  id: string;
  seasonId: string;
  name: string;
  description: string;
  priceStars: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BattlePassPurchase {
  id: string;
  userId: string;
  battlePassId: string;
  seasonId: string;
  status: BattlePassStatus;
  telegramPaymentId: string | null;
  idempotencyKey: string;
  purchasedAt: Date;
  expiresAt: Date | null;
}

export interface BattlePassRewardClaim {
  id: string;
  userId: string;
  seasonId: string;
  level: number;
  track: BattlePassTrack;
  reward: LiveOpsReward;
  transactionId: string;
  claimedAt: Date;
}

export interface BattlePassProgress {
  seasonId: string;
  currentLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  maxLevel: number;
  isPremium: boolean;
  freeTrack: BattlePassTrackProgress;
  premiumTrack: BattlePassTrackProgress;
}

export interface BattlePassTrackProgress {
  track: BattlePassTrack;
  unlockedLevels: number[];
  claimedRewards: string[];
  pendingRewards: BattlePassPendingReward[];
}

export interface BattlePassPendingReward {
  level: number;
  reward: LiveOpsReward;
  claimable: boolean;
  reason: string | null;
}

// ============================================================
// LiveOps Missions (Extended from retention missions)
// ============================================================

export interface LiveOpsMissionTemplate {
  id: string;
  name: string;
  description: string;
  category: MissionCategory;
  type: string;
  target: number;
  gameId: string | null;
  configuration: Record<string, unknown>;
  rewardConfig: LiveOpsMissionReward;
  difficulty: 'easy' | 'medium' | 'hard' | 'special';
  rarity: MissionRarity;
  weight: number;
  minLevel: number;
  maxLevel: number;
  seasonId: string | null;
  eventId: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
}

export interface LiveOpsMissionReward {
  seasonXp: number;
  accountXp: number;
  badgeId: string | null;
  titleId: string | null;
  cosmeticId: string | null;
  eventTicket: number;
}

export interface LiveOpsUserMission {
  id: string;
  userId: string;
  missionTemplateId: string;
  category: MissionCategory;
  seasonId: string | null;
  eventId: string | null;
  progress: number;
  target: number;
  status: 'locked' | 'active' | 'completed' | 'claimed' | 'expired';
  rerollStatus: MissionRerollStatus;
  rerollCount: number;
  completedAt: Date | null;
  claimedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveOpsUserMissionWithTemplate extends LiveOpsUserMission {
  template: LiveOpsMissionTemplate;
}

export interface MissionRerollResult {
  success: boolean;
  previousMissionId: string;
  newMissionId: string | null;
  remainingRerolls: number;
  error?: string;
}

// ============================================================
// LiveOps Events
// ============================================================

export interface LiveOpsEvent {
  id: string;
  name: string;
  description: string;
  type: LiveOpsEventType;
  startTime: Date;
  endTime: Date;
  status: LiveOpsEventStatus;
  rules: LiveOpsEventRules;
  rewards: LiveOpsEventRewards;
  bannerUrl: string | null;
  entryType: EventEntryType;
  gameId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveOpsEventRules {
  eligibility: string;
  scoring: string;
  duration: string;
  rewards: string;
  leaderboard: string;
  tieBreaker: string;
  maxParticipants: number | null;
  requiresLevel: number;
  customRules: Record<string, unknown>;
}

export interface LiveOpsEventRewards {
  tiers: LiveOpsEventRewardTier[];
  participationReward: LiveOpsReward;
  totalBudget: number | null;
  distributedCount: number;
}

export interface LiveOpsEventRewardTier {
  minRank: number;
  maxRank: number | null;
  reward: LiveOpsReward;
}

export interface LiveOpsEventEntry {
  id: string;
  eventId: string;
  userId: string;
  joinedAt: Date;
  score: number;
  rank: number | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface LiveOpsEventLeaderboard {
  eventId: string;
  entries: LiveOpsEventLeaderboardEntry[];
  totalParticipants: number;
  updatedAt: Date;
}

export interface LiveOpsEventLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  reward: LiveOpsReward | null;
}

// ============================================================
// Community Events
// ============================================================

export interface CommunityGoal {
  id: string;
  name: string;
  description: string;
  type: string;
  targetValue: number;
  currentValue: number;
  startTime: Date;
  endTime: Date;
  status: CommunityGoalStatus;
  reward: LiveOpsReward;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Team Events
// ============================================================

export interface TeamEvent {
  id: string;
  name: string;
  description: string;
  type: TeamEventType;
  startTime: Date;
  endTime: Date;
  status: LiveOpsEventStatus;
  teams: TeamEventTeam[];
  reward: LiveOpsReward;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamEventTeam {
  teamId: string;
  teamName: string;
  score: number;
  memberCount: number;
}

// ============================================================
// Creator Events
// ============================================================

export interface CreatorEvent {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  type: string;
  startTime: Date;
  endTime: Date;
  status: LiveOpsEventStatus;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  reward: LiveOpsReward;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Daily Login System
// ============================================================

export interface DailyLoginConfig {
  enabled: boolean;
  resetMode: DailyLoginResetMode;
  rewards: DailyLoginReward[];
  streakBonus: boolean;
}

export interface DailyLoginReward {
  day: number;
  reward: LiveOpsReward;
  isStreakBonus: boolean;
  streakRequired: number;
}

export interface UserDailyLogin {
  userId: string;
  lastLoginDate: string;
  currentDay: number;
  totalLogins: number;
  lastRewardClaimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Streak System (Extended)
// ============================================================

export interface LiveOpsStreakConfig {
  enabled: boolean;
  dailyStreak: boolean;
  weeklyStreak: boolean;
  recoveryEnabled: boolean;
  maxRecoveryDays: number;
}

// ============================================================
// Season Milestones
// ============================================================

export interface SeasonMilestone {
  id: string;
  seasonId: string;
  level: number;
  name: string;
  description: string;
  reward: LiveOpsReward;
  isSecret: boolean;
}

// ============================================================
// Content Rotation
// ============================================================

export interface ContentRotation {
  id: string;
  type: ContentRotationType;
  items: ContentRotationItem[];
  rotationIntervalMs: number;
  lastRotatedAt: Date;
  isActive: boolean;
}

export interface ContentRotationItem {
  id: string;
  name: string;
  weight: number;
  isActive: boolean;
  lastShownAt: Date | null;
}

// ============================================================
// LiveOps Calendar
// ============================================================

export interface LiveOpsCalendarEntry {
  id: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  title: string;
  description: string;
  type: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

// ============================================================
// Reward Budget
// ============================================================

export interface RewardBudget {
  id: string;
  name: string;
  totalBudget: number;
  distributedCount: number;
  userCap: number;
  dailyCap: number;
  dailyDistributedToday: number;
  isExhausted: boolean;
  fallbackReward: LiveOpsReward | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// LiveOps Experiments (A/B Testing)
// ============================================================

export interface LiveOpsExperiment {
  id: string;
  name: string;
  hypothesis: string;
  variants: LiveOpsExperimentVariant[];
  activeVariant: string;
  metric: string;
  guardrail: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
}

export interface LiveOpsExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
  metrics: Record<string, number>;
}

// ============================================================
// LiveOps Analytics
// ============================================================

export interface LiveOpsAnalyticsData {
  seasonId: string | null;
  eventId: string | null;
  missionId: string | null;
  battlePassId: string | null;
  event: LiveOpsAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export type LiveOpsAnalyticsEvent =
  | 'season_viewed'
  | 'season_xp_earned'
  | 'season_level_up'
  | 'battle_pass_viewed'
  | 'battle_pass_purchase_attempted'
  | 'battle_pass_purchase_completed'
  | 'battle_pass_reward_claimed'
  | 'mission_viewed'
  | 'mission_started'
  | 'mission_progressed'
  | 'mission_completed'
  | 'mission_claimed'
  | 'mission_rerolled'
  | 'mission_expired'
  | 'event_viewed'
  | 'event_joined'
  | 'event_started'
  | 'event_completed'
  | 'event_score_submitted'
  | 'event_reward_claimed'
  | 'community_goal_progressed'
  | 'community_goal_completed'
  | 'daily_login_viewed'
  | 'daily_login_claimed'
  | 'liveops_home_viewed'
  | 'content_rotated'
  | 'experiment_exposure';

export interface LiveOpsEventImpressions {
  views: number;
  joins: number;
  starts: number;
  completions: number;
  shares: number;
  challenges: number;
  retention: number;
  rewardsDistributed: number;
}

export interface BattlePassImpressions {
  views: number;
  purchaseAttempts: number;
  completedPurchases: number;
  levelProgressions: number;
  rewardClaims: number;
  completionRate: number;
}

export interface MissionImpressions {
  impressions: number;
  starts: number;
  completions: number;
  claims: number;
  expirations: number;
  rerolls: number;
}

// ============================================================
// Admin LiveOps Dashboard
// ============================================================

export interface AdminLiveOpsDashboard {
  activeSeason: LiveOpsSeason | null;
  liveEvents: LiveOpsEvent[];
  upcomingEvents: LiveOpsEvent[];
  missionPools: Record<string, number>;
  battlePass: {
    active: BattlePass | null;
    purchases: number;
    revenue: number;
  };
  participation: {
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
  };
  completion: {
    missionsCompleted: number;
    eventsCompleted: number;
    battlePassMaxLevel: number;
  };
  revenue: {
    battlePassRevenue: number;
    totalRevenue: number;
  };
  retention: {
    d1: number;
    d7: number;
    d30: number;
  };
}

// ============================================================
// Scheduled Jobs
// ============================================================

export interface LiveOpsScheduledJobResult {
  jobName: string;
  startedAt: Date;
  completedAt: Date;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}

// ============================================================
// LiveOps Home Response
// ============================================================

export interface LiveOpsHomeResponse {
  season: {
    id: string;
    name: string;
    theme: string;
    currentLevel: number;
    xpToNextLevel: number;
    timeRemaining: number;
    isPremium: boolean;
  } | null;
  liveNow: LiveOpsEventCard[];
  upcoming: LiveOpsEventCard[];
  endingSoon: LiveOpsEventCard[];
  activeMissions: LiveOpsUserMissionWithTemplate[];
  communityGoals: CommunityGoal[];
  battlePassProgress: BattlePassProgress | null;
  dailyLogin: {
    currentDay: number;
    nextReward: LiveOpsReward | null;
    claimed: boolean;
  };
}

export interface LiveOpsEventCard {
  id: string;
  name: string;
  type: string;
  timeRemaining: number;
  reward: LiveOpsReward;
  cta: string;
  bannerUrl: string | null;
}

// ============================================================
// Notification Types
// ============================================================

export interface LiveOpsNotification {
  id: string;
  userId: string;
  type: 'event_starting' | 'challenge_received' | 'mission_completed' | 'reward_available' | 'season_ending';
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}
