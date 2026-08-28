/**
 * GTX Rush — Growth Engine Configuration v1.0
 *
 * Configuration for referrals, campaigns, sharing, and growth mechanics.
 * All values are configurable and version-controlled.
 *
 * Contract: Growth Engine Contract v1.0
 */

import type {
  ReferralSource,
  ShareType,
  ReferralMilestone,
  ReferralLimits,
  ReferralRewardConfig,
  QualificationStrategy,
} from '@gtx-rush/types';

// ============================================================
// Referral Code Configuration
// ============================================================

export const REFERRAL_CODE_CONFIG = {
  /** Length of referral code */
  codeLength: 8,
  /** Characters allowed in code (avoid confusing chars like 0/O, 1/I/l) */
  charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  /** Maximum usage count per code (null = unlimited) */
  maxUses: null,
  /** Code expiration in days (null = never) */
  expirationDays: null,
};

// ============================================================
// Referral Limits
// ============================================================

export const REFERRAL_LIMITS: ReferralLimits = {
  /** Maximum qualified referrals per day */
  dailyQualifiedLimit: 10,
  /** Maximum rewardable referrals total */
  totalRewardableLimit: 100,
  /** Maximum rewards per month */
  monthlyRewardCap: 500,
  /** Campaign-specific limits */
  campaignLimits: {},
};

// ============================================================
// Referral Rewards
// ============================================================

export const DEFAULT_REFERRAL_REWARDS: ReferralRewardConfig = {
  /** XP awarded to inviter when invitee qualifies */
  inviterXp: 150,
  /** XP awarded to invitee when they qualify */
  inviteeXp: 100,
  /** Badge awarded to inviter at milestone */
  inviterBadgeId: null,
  /** Badge awarded to invitee */
  inviteeBadgeId: null,
  /** Cosmetic awarded at milestone */
  cosmeticId: null,
};

// ============================================================
// Referral Milestones
// ============================================================

export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  {
    id: 'milestone_3',
    requiredReferrals: 3,
    rewardType: 'badge',
    rewardValue: 'friend_maker',
    rewardConfig: {
      inviterXp: 200,
      inviteeXp: 100,
      inviterBadgeId: 'friend_maker',
      inviteeBadgeId: null,
      cosmeticId: null,
    },
    isActive: true,
  },
  {
    id: 'milestone_10',
    requiredReferrals: 10,
    rewardType: 'cosmetic',
    rewardValue: 'frame_network',
    rewardConfig: {
      inviterXp: 500,
      inviteeXp: 100,
      inviterBadgeId: 'network_builder',
      inviteeBadgeId: null,
      cosmeticId: 'frame_network',
    },
    isActive: true,
  },
  {
    id: 'milestone_25',
    requiredReferrals: 25,
    rewardType: 'title',
    rewardValue: 'social_butterfly',
    rewardConfig: {
      inviterXp: 1000,
      inviteeXp: 100,
      inviterBadgeId: null,
      inviteeBadgeId: null,
      cosmeticId: null,
    },
    isActive: true,
  },
  {
    id: 'milestone_50',
    requiredReferrals: 50,
    rewardType: 'cosmetic',
    rewardValue: 'frame_legendary_network',
    rewardConfig: {
      inviterXp: 2000,
      inviteeXp: 100,
      inviterBadgeId: 'legendary_networker',
      inviteeBadgeId: null,
      cosmeticId: 'frame_legendary_network',
    },
    isActive: true,
  },
];

// ============================================================
// Referral Qualification Configuration (Growth Engine Contract §4)
//
// A referral becomes QUALIFIED only after meaningful activity.
// Thresholds are configurable; never reward link clicks.
// ============================================================

export const QUALIFICATION_CONFIG = {
  /** Active qualification strategy */
  strategy: 'games_completed' as QualificationStrategy,
  /** Number of legitimate game completions required */
  requiredGamesCompleted: 1,
  /** Minimum score for a completion to count as legitimate (anti fake engagement) */
  minimumValidScore: 10,
  /** Minimum seconds between counted completions (anti automated signups) */
  minSecondsBetweenGames: 5,
  /** Alternative qualification path: joining an event counts */
  eventJoinQualifies: true,
  /** Time window after registration to qualify (hours) — null = unlimited */
  qualificationWindowHours: 72,
};

// ============================================================
// Campaign Budget Defaults (Growth Engine Contract §46)
// When any cap is hit the campaign STOPS REWARDING
// but continues collecting analytics.
// ============================================================

export const CAMPAIGN_BUDGET_DEFAULTS = {
  rewardBudgetXP: 50000,
  userCap: 10,
  dailyCapXP: 5000,
  totalUserCap: null,
};

// ============================================================
// Source Quality Score Configuration (Growth Engine Contract §36)
// Sources are ranked by QUALITY, not acquisition volume.
// ============================================================

export const SOURCE_QUALITY_CONFIG = {
  weights: {
    activationRate: 0.25,
    d1Retention: 0.25,
    d7Retention: 0.2,
    engagementScore: 0.15,
    fraudPenalty: 0.1,
    monetizationScore: 0.05,
  },
};

export const ACTIVATION_CONFIG = {
  /** Minimum games to play for activation */
  minGamesPlayed: 1,
  /** Minimum score for activation */
  minScore: 1,
  /** Whether profile setup is required */
  requireProfileSetup: false,
  /** Time window for activation (hours) */
  activationWindowHours: 24,
};

// ============================================================
// Share Configuration
// ============================================================

export const SHARE_TEMPLATES: Record<ShareType, {
  title: string;
  description: string;
  cta: string;
}> = {
  score: {
    title: '⚡ GTX RUSH',
    description: 'I scored {score} in {gameName}. Think you can beat me?',
    cta: 'PLAY. COMPETE. RISE.',
  },
  badge: {
    title: '🏆 BADGE UNLOCKED',
    description: 'I just unlocked {badgeName} in GTX Rush. Can you get it too?',
    cta: 'PLAY. COMPETE. RISE.',
  },
  challenge: {
    title: '🔥 CHALLENGE',
    description: '{inviterName} challenged you in {gameName}. Can you beat them?',
    cta: 'ACCEPT CHALLENGE',
  },
  personal_best: {
    title: '📈 NEW PERSONAL BEST!',
    description: 'I just set a new personal best of {score} in {gameName}!',
    cta: 'BEAT MY SCORE',
  },
  achievement: {
    title: '🎯 ACHIEVEMENT UNLOCKED',
    description: 'I just unlocked {achievementName}. Try GTX Rush!',
    cta: 'PLAY NOW',
  },
  daily_rush: {
    title: '⚡ DAILY RUSH',
    description: 'Today\'s Daily Rush is live! Can you beat {score}?',
    cta: 'PLAY DAILY RUSH',
  },
  rank: {
    title: '🏆 GTX RUSH LEADERBOARD',
    description: 'I\'m #{rank} in GTX Rush this week. Can you beat me?',
    cta: 'PLAY. COMPETE. RISE.',
  },
  event: {
    title: '⚡ EVENT LIVE',
    description: '{eventName} is live! I\'m #{rank}. Join me!',
    cta: 'JOIN THE EVENT',
  },
  team_invite: {
    title: '🛡️ TEAM INVITE',
    description: '{inviterName} invited you to join {teamName}. Compete together!',
    cta: 'JOIN TEAM',
  },
  creator_challenge: {
    title: '🎨 CREATOR CHALLENGE',
    description: '{creatorName} created a challenge: {challengeName}. Can you clear it?',
    cta: 'PLAY CHALLENGE',
  },
};

// ============================================================
// Deep Link Configuration
// ============================================================

export const DEEP_LINK_CONFIG = {
  /** Base URL for deep links */
  baseUrl: 'https://t.me',
  /** Bot username */
  botUsername: 'gtxrushbot',
  /** Start parameter prefix for referrals */
  referralPrefix: 'ref_',
  /** Start parameter prefix for challenges */
  challengePrefix: 'ch_',
  /** Start parameter prefix for campaigns */
  campaignPrefix: 'camp_',
  /** Start parameter prefix for teams */
  teamPrefix: 'team_',
  /** Start parameter prefix for events */
  eventPrefix: 'event_',
  /** Start parameter prefix for creators */
  creatorPrefix: 'creator_',
};

/**
 * Generate a deep link for a team invite.
 */
export function generateTeamDeepLink(teamCode: string, referralCode: string): string {
  const params = new URLSearchParams({ start: `team_${teamCode}_${referralCode}` });
  return `${DEEP_LINK_CONFIG.baseUrl}/${DEEP_LINK_CONFIG.botUsername}?${params.toString()}`;
}

/**
 * Generate a deep link for an event invite.
 */
export function generateEventDeepLink(eventId: string, referralCode: string): string {
  const params = new URLSearchParams({ start: `event_${eventId}_${referralCode}` });
  return `${DEEP_LINK_CONFIG.baseUrl}/${DEEP_LINK_CONFIG.botUsername}?${params.toString()}`;
}

// ============================================================
// Fraud Detection Configuration
// ============================================================

export const FRAUD_CONFIG = {
  /** Maximum referrals from same IP per day */
  maxReferralsPerIpPerDay: 5,
  /** Maximum referrals from same device per day */
  maxReferralsPerDevicePerDay: 3,
  /** Minimum account age for referral (hours) */
  minAccountAgeHours: 1,
  /** Minimum games for inviter to be eligible */
  minGamesForInviter: 1,
  /** Suspicious rapid account creation window (minutes) */
  rapidAccountCreationWindowMinutes: 5,
  /** Maximum accounts per IP in rapid window */
  maxAccountsPerIpInRapidWindow: 3,
  /** Risk score threshold for rejection */
  rejectionThreshold: 80,
  /** Risk score threshold for hold */
  holdThreshold: 50,
};

// ============================================================
// Campaign Configuration (Default)
// ============================================================

export const DEFAULT_CAMPAIGN_CONFIG = {
  /** Default campaign duration (days) */
  defaultDurationDays: 30,
  /** Maximum concurrent campaigns */
  maxConcurrentCampaigns: 5,
  /** Campaign share message templates */
  shareMessages: [],
  /** Target audience */
  targetAudience: {
    minLevel: 1,
    maxLevel: 0,
    countries: [],
    segments: [],
  },
};

// ============================================================
// Growth Analytics Configuration
// ============================================================

export const GROWTH_ANALYTICS_CONFIG = {
  /** Cohort tracking window (days) */
  cohortWindowDays: 30,
  /** K-factor calculation window (days) */
  kFactorWindowDays: 7,
  /** Minimum users for cohort analysis */
  minCohortSize: 100,
};

// ============================================================
// Notification Configuration
// ============================================================

export const NOTIFICATION_CONFIG = {
  /** Enable referral notifications */
  enableReferralNotifications: true,
  /** Enable challenge notifications */
  enableChallengeNotifications: true,
  /** Maximum notifications per day */
  maxNotificationsPerDay: 10,
  /** Notification cooldown (minutes) */
  notificationCooldownMinutes: 60,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate a deep link for a referral.
 */
export function generateReferralDeepLink(referralCode: string): string {
  const params = new URLSearchParams({ start: `${REFERRAL_CODE_CONFIG.codeLength > 0 ? 'ref_' : ''}${referralCode}` });
  return `${DEEP_LINK_CONFIG.baseUrl}/${DEEP_LINK_CONFIG.botUsername}?${params.toString()}`;
}

/**
 * Generate a deep link for a challenge.
 */
export function generateChallengeDeepLink(challengeToken: string): string {
  const params = new URLSearchParams({ start: `ch_${challengeToken}` });
  return `${DEEP_LINK_CONFIG.baseUrl}/${DEEP_LINK_CONFIG.botUsername}?${params.toString()}`;
}

/**
 * Generate a deep link for a campaign.
 */
export function generateCampaignDeepLink(campaignId: string, referralCode: string): string {
  const params = new URLSearchParams({ start: `camp_${campaignId}_${referralCode}` });
  return `${DEEP_LINK_CONFIG.baseUrl}/${DEEP_LINK_CONFIG.botUsername}?${params.toString()}`;
}

/**
 * Get share message for a specific type.
 */
export function getShareMessage(
  type: ShareType,
  variables: Record<string, string | number>,
): string {
  const template = SHARE_TEMPLATES[type];
  if (!template) return '';

  let message = template.description;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(`{${key}}`, String(value));
  }

  return `${template.title}\n\n${message}\n\n${template.cta}`;
}

/**
 * Get the next referral milestone for a user.
 */
export function getNextReferralMilestone(
  qualifiedReferrals: number,
): ReferralMilestone | null {
  for (const milestone of REFERRAL_MILESTONES) {
    if (milestone.requiredReferrals > qualifiedReferrals) {
      return milestone;
    }
  }
  return null;
}

/**
 * Calculate progress to next milestone.
 */
export function calculateMilestoneProgress(
  qualifiedReferrals: number,
): {
  current: number;
  next: ReferralMilestone | null;
  progress: number;
  percentage: number;
} {
  const next = getNextReferralMilestone(qualifiedReferrals);
  if (!next) {
    return {
      current: qualifiedReferrals,
      next: null,
      progress: 0,
      percentage: 100,
    };
  }

  const previousMilestone = REFERRAL_MILESTONES.find(
    (m) => m.requiredReferrals < next.requiredReferrals,
  );

  const base = previousMilestone?.requiredReferrals ?? 0;
  const target = next.requiredReferrals;
  const progress = qualifiedReferrals - base;
  const range = target - base;
  const percentage = Math.min(100, Math.round((progress / range) * 100));

  return {
    current: qualifiedReferrals,
    next,
    progress,
    percentage,
  };
}

/**
 * Validate a referral code format.
 */
export function isValidReferralCode(code: string): boolean {
  if (code.length !== REFERRAL_CODE_CONFIG.codeLength) {
    return false;
  }

  for (const char of code) {
    if (!REFERRAL_CODE_CONFIG.charset.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate K-factor.
 */
export function calculateKFactor(
  averageInvitesPerUser: number,
  inviteConversionRate: number,
): number {
  return averageInvitesPerUser * inviteConversionRate;
}
