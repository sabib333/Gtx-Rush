/**
 * GTX Rush — Growth Engine Types v1.0
 *
 * Type definitions for the Referral & Viral Growth Engine.
 * Covers referrals, campaigns, sharing, and growth analytics.
 *
 * Contract: Growth Engine Contract v1.0
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type ReferralStatus = 'created' | 'opened' | 'registered' | 'activated' | 'qualified' | 'rewarded' | 'rejected';
export type ReferralSource = 'direct_referral' | 'friend_challenge' | 'share_score' | 'share_achievement' | 'campaign' | 'organic';
export type ReferralFraudStatus = 'valid' | 'suspicious' | 'rejected';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';
export type ShareType = 'score' | 'badge' | 'challenge' | 'personal_best' | 'achievement' | 'daily_rush' | 'rank' | 'event' | 'team_invite' | 'creator_challenge';
export type GrowthEventType = 'referral_link_created' | 'referral_link_opened' | 'referral_registered' | 'referral_activated' | 'referral_qualified' | 'referral_rewarded' | 'referral_rejected' | 'share_score' | 'share_badge' | 'share_challenge' | 'share_personal_best' | 'campaign_opened' | 'campaign_activated';
export type AcquisitionSource = 'organic' | 'referral' | 'challenge' | 'campaign' | 'shared_score' | 'shared_badge';

/**
 * Qualification strategy for referrals (configurable per Growth Engine Contract §4).
 */
export type QualificationStrategy =
  | 'first_game_completed'
  | 'games_completed'
  | 'minimum_activity'
  | 'event_joined';

// ============================================================
// Campaign Budget Types (Growth Engine Contract §46)
// ============================================================

export interface CampaignBudgetConfig {
  /** Total reward budget in XP-equivalent units */
  rewardBudgetXP: number;
  /** Maximum rewards per user across the campaign */
  userCap: number;
  /** Maximum reward spend per day */
  dailyCapXP: number;
  /** Maximum total rewarded users (null = unlimited within budget) */
  totalUserCap: number | null;
}

export interface CampaignBudgetState {
  config: CampaignBudgetConfig;
  /** Total XP-equivalent spent so far */
  spentXP: number;
  /** XP spent today (key: YYYY-MM-DD) */
  spentTodayXP: Record<string, number>;
  /** Rewards granted per user */
  userSpendCount: Record<string, number>;
  /** Distinct users rewarded */
  rewardedUsers: number;
  /** Set true when any cap is hit; analytics keep flowing, rewards stop */
  exhausted: boolean;
  exhaustedAt: Date | null;
  exhaustedReason: string | null;
}

export interface CampaignBudgetCheck {
  canReward: boolean;
  reason?: 'BUDGET_EXHAUSTED' | 'DAILY_CAP_REACHED' | 'USER_CAP_REACHED' | 'TOTAL_CAP_REACHED';
}

// ============================================================
// Qualification Engine Types (Growth Engine Contract §4, §44)
// ============================================================

export interface UserActivitySnapshot {
  userId: string;
  gamesCompleted: number;
  validGamesCompleted: number;
  bestScore: number;
  totalScore: number;
  eventsJoined: number;
  firstGameAt: Date | null;
  lastGameAt: Date | null;
}

export interface QualificationDecision {
  eligible: boolean;
  reason: string;
  unmetCriteria: string[];
}

// ============================================================
// K-Factor Trends & Source Quality (Growth Engine Contract §33-36)
// ============================================================

export interface KFactorTrendPoint {
  date: string; // YYYY-MM-DD
  invitesPerActiveUser: number;
  inviteToQualifiedConversion: number;
  kFactor: number;
}

export interface SourceQualityScore {
  source: AcquisitionSource;
  activationRate: number;
  d1Retention: number;
  d7Retention: number;
  engagementScore: number;
  fraudRate: number;
  monetizationScore: number;
  qualityScore: number; // 0-100 weighted composite
}

// ============================================================
// Growth Experiment Types (Growth Engine Contract §42)
// ============================================================

export type GrowthExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface GrowthExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100
}

export interface GrowthExperimentDefinition {
  id: string;
  name: string;
  hypothesis: string;
  targetMetric: string;
  status: GrowthExperimentStatus;
  variants: GrowthExperimentVariant[];
  startedAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}

export interface ExperimentAssignmentResult {
  experimentId: string;
  variantId: string;
  assignedAt: Date;
}

// ============================================================
// Referral Types
// ============================================================

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  isActive: boolean;
  usageCount: number;
  maxUses: number | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface Referral {
  id: string;
  inviterUserId: string;
  inviteeUserId: string | null;
  referralCode: string;
  source: ReferralSource;
  campaignId: string | null;
  status: ReferralStatus;
  fraudStatus: ReferralFraudStatus;
  metadata: ReferralMetadata;
  createdAt: Date;
  openedAt: Date | null;
  registeredAt: Date | null;
  activatedAt: Date | null;
  qualifiedAt: Date | null;
  rewardedAt: Date | null;
}

export interface ReferralMetadata {
  /** Campaign ID if from a campaign */
  campaignId?: string;
  /** Challenge ID if from a challenge share */
  challengeId?: string;
  /** Game ID if from a game share */
  gameId?: string;
  /** Score if from a score share */
  score?: number;
  /** Device/platform info */
  platform?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface ReferralWithUsers extends Referral {
  inviter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  };
  invitee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  } | null;
}

// ============================================================
// Referral Rewards
// ============================================================

export interface ReferralReward {
  id: string;
  referralId: string;
  userId: string;
  rewardType: 'xp' | 'badge' | 'cosmetic' | 'title';
  rewardValue: number | string;
  source: string;
  referenceId: string;
  idempotencyKey: string;
  claimedAt: Date | null;
  createdAt: Date;
}

export interface ReferralRewardConfig {
  /** XP awarded to inviter */
  inviterXp: number;
  /** XP awarded to invitee */
  inviteeXp: number;
  /** Badge awarded to inviter at milestone */
  inviterBadgeId: string | null;
  /** Badge awarded to invitee */
  inviteeBadgeId: string | null;
  /** Cosmetic awarded at milestone */
  cosmeticId: string | null;
}

export interface ReferralMilestone {
  id: string;
  requiredReferrals: number;
  rewardType: 'xp' | 'badge' | 'cosmetic' | 'title';
  rewardValue: number | string;
  rewardConfig: ReferralRewardConfig;
  isActive: boolean;
}

// ============================================================
// Referral Limits
// ============================================================

export interface ReferralLimits {
  /** Maximum qualified referrals per day */
  dailyQualifiedLimit: number;
  /** Maximum rewardable referrals total */
  totalRewardableLimit: number;
  /** Maximum rewards per month */
  monthlyRewardCap: number;
  /** Campaign-specific limits */
  campaignLimits: Record<string, number>;
}

// ============================================================
// Campaign Types
// ============================================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  source: ReferralSource;
  startsAt: Date;
  endsAt: Date;
  configuration: CampaignConfiguration;
  rewardConfiguration: CampaignRewardConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignConfiguration {
  /** Deep link prefix */
  deepLinkPrefix: string;
  /** Custom share messages */
  shareMessages: CampaignShareMessage[];
  /** Target audience */
  targetAudience: CampaignTargetAudience;
  /** Maximum participants */
  maxParticipants: number | null;
  /** Current participant count */
  participantCount: number;
  /** Budget controls (Growth Engine Contract §46) */
  budget?: CampaignBudgetState;
  [key: string]: unknown;
}

export interface CampaignShareMessage {
  type: ShareType;
  template: string;
  deepLink: string;
}

export interface CampaignTargetAudience {
  /** Minimum user level */
  minLevel: number;
  /** Maximum user level (0 = no max) */
  maxLevel: number;
  /** Countries (empty = all) */
  countries: string[];
  /** User segments */
  segments: string[];
}

export interface CampaignRewardConfiguration {
  /** Inviter rewards */
  inviter: ReferralRewardConfig;
  /** Invitee rewards */
  invitee: ReferralRewardConfig;
  /** Campaign-specific milestones */
  milestones: ReferralMilestone[];
}

export interface CampaignAttribution {
  id: string;
  campaignId: string;
  userId: string;
  source: ReferralSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Share Types
// ============================================================

export interface ShareData {
  type: ShareType;
  userId: string;
  gameId?: string;
  score?: number;
  challengeId?: string;
  badgeId?: string;
  achievementId?: string;
}

export interface ShareMessage {
  title: string;
  description: string;
  deepLink: string;
  imageUrl?: string;
}

export interface ShareLink {
  id: string;
  type: ShareType;
  userId: string;
  deepLink: string;
  referralCode: string;
  campaignId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date | null;
}

// ============================================================
// Deep Link Types
// ============================================================

export interface DeepLinkContext {
  /** Referral code from deep link */
  referralCode: string | null;
  /** Challenge token from deep link */
  challengeToken: string | null;
  /** Campaign ID from deep link */
  campaignId: string | null;
  /** Source type */
  source: ReferralSource;
  /** Additional parameters */
  params: Record<string, string>;
}

export interface DeepLinkResolution {
  valid: boolean;
  context: DeepLinkContext | null;
  inviter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  } | null;
  campaign: Campaign | null;
  error?: string;
}

// ============================================================
// Referral Dashboard Types
// ============================================================

export interface ReferralDashboard {
  /** Total friends invited */
  totalInvited: number;
  /** Friends who registered */
  registered: number;
  /** Friends who activated */
  activated: number;
  /** Friends who qualified */
  qualified: number;
  /** Total rewards earned */
  rewardsEarned: ReferralReward[];
  /** Next milestone */
  nextMilestone: ReferralMilestone | null;
  /** Progress to next milestone */
  progressToNextMilestone: number;
  /** Referral code */
  referralCode: string;
  /** Recent referrals */
  recentReferrals: ReferralWithUsers[];
}

export interface ReferralStats {
  /** Invites sent */
  invitesSent: number;
  /** Invite opens */
  inviteOpens: number;
  /** New users */
  newUsers: number;
  /** Activated users */
  activatedUsers: number;
  /** Qualified referrals */
  qualifiedReferrals: number;
  /** Conversion rates */
  conversionRates: {
    inviteToOpen: number;
    openToActivation: number;
    activationToQualification: number;
    overallConversion: number;
  };
  /** K-factor estimate */
  kFactor: number;
}

// ============================================================
// Growth Analytics Types
// ============================================================

export type GrowthAnalyticsEvent =
  | 'referral_link_created'
  | 'referral_link_opened'
  | 'referral_registered'
  | 'referral_activated'
  | 'referral_qualified'
  | 'referral_rewarded'
  | 'referral_rejected'
  | 'share_score'
  | 'share_badge'
  | 'share_challenge'
  | 'share_personal_best'
  | 'share_rank'
  | 'share_event'
  | 'share_team_invite'
  | 'share_creator_challenge'
  | 'campaign_opened'
  | 'campaign_activated'
  | 'campaign_budget_exhausted';

export interface GrowthAnalyticsData {
  eventName: GrowthAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export interface GrowthFunnelMetrics {
  activeUsers: number;
  shares: number;
  inviteOpens: number;
  newUsers: number;
  firstGames: number;
  secondGames: number;
  day2Return: number;
  day7Return: number;
  monetization: number;
}

export interface CohortMetrics {
  cohortType: AcquisitionSource;
  userCount: number;
  d1Retention: number;
  d7Retention: number;
  d30Retention: number;
  averageGamesPlayed: number;
  averageRevenue: number;
}

// ============================================================
// API Response Types
// ============================================================

export interface ReferralCodeResponse {
  code: string;
  deepLink: string;
  qrCode?: string;
}

export interface ReferralDashboardResponse {
  dashboard: ReferralDashboard;
  stats: ReferralStats;
}

export interface CampaignResponse {
  campaign: Campaign;
  userAttribution: CampaignAttribution | null;
}

export interface ShareLinkResponse {
  shareLink: ShareLink;
  message: ShareMessage;
  deepLink: string;
}

export interface DeepLinkResolveResponse {
  valid: boolean;
  context: DeepLinkContext | null;
  inviter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  } | null;
  campaign: Campaign | null;
  landingExperience: LandingExperience | null;
}

export interface LandingExperience {
  type: 'referral' | 'challenge' | 'campaign' | 'share';
  title: string;
  description: string;
  inviterName: string;
  ctaText: string;
  ctaDeepLink: string;
}

// ============================================================
// Fraud Detection Types
// ============================================================

export interface ReferralFraudCheck {
  referralId: string;
  userId: string;
  signals: FraudSignal[];
  riskScore: number;
  recommendation: 'approve' | 'hold' | 'reject';
  reason: string;
}

export interface FraudSignal {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
  /** Optional contribution to composite risk score (AI Intelligence Engine) */
  weight?: number;
}

// ============================================================
// Notification Types
// ============================================================

export interface GrowthNotification {
  id: string;
  userId: string;
  type: 'friend_joined' | 'friend_beat_score' | 'challenge_waiting' | 'referral_reward' | 'campaign_reward';
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}
