/**
 * GTX Rush — Campaign Service v1.0
 *
 * Campaign service that handles:
 * - Campaign lifecycle management
 * - Campaign attribution
 * - Campaign-specific rewards
 * - Campaign analytics
 *
 * SECURITY:
 * - Campaign configuration is server-authoritative
 * - Campaign rewards are idempotent
 * - Campaign attribution is tracked
 *
 * Contract: Growth Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Campaign,
  CampaignStatus,
  CampaignConfiguration,
  CampaignRewardConfiguration,
  CampaignAttribution,
  ReferralSource,
  CampaignBudgetConfig,
  CampaignBudgetCheck,
} from '@gtx-rush/types';
import { DEFAULT_CAMPAIGN_CONFIG, CAMPAIGN_BUDGET_DEFAULTS } from '@gtx-rush/config';
import { trackCampaignBudgetExhausted } from './growth-analytics';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const campaigns = new Map<string, Campaign>();
const campaignAttributions = new Map<string, CampaignAttribution[]>();
const campaignByStatus = new Map<CampaignStatus, Set<string>>();

// ============================================================
// Campaign Management
// ============================================================

/**
 * Create a new campaign.
 */
export function createCampaign(params: {
  name: string;
  description: string;
  source: ReferralSource;
  startsAt: Date;
  endsAt: Date;
  configuration?: Partial<CampaignConfiguration>;
  rewardConfiguration?: Partial<CampaignRewardConfiguration>;
  budget?: Partial<CampaignBudgetConfig>;
}): Campaign {
  const id = nanoid();

  const configuration: CampaignConfiguration = {
    deepLinkPrefix: `camp_${id}`,
    shareMessages: [],
    targetAudience: DEFAULT_CAMPAIGN_CONFIG.targetAudience,
    maxParticipants: null,
    participantCount: 0,
    ...params.configuration,
  };

  const rewardConfiguration: CampaignRewardConfiguration = {
    inviter: {
      inviterXp: 200,
      inviteeXp: 100,
      inviterBadgeId: null,
      inviteeBadgeId: null,
      cosmeticId: null,
    },
    invitee: {
      inviterXp: 200,
      inviteeXp: 100,
      inviterBadgeId: null,
      inviteeBadgeId: null,
      cosmeticId: null,
    },
    milestones: [],
    ...params.rewardConfiguration,
  };

  const campaign: Campaign = {
    id,
    name: params.name,
    description: params.description,
    status: 'draft',
    source: params.source,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    configuration: {
      ...configuration,
      budget: {
        config: {
          rewardBudgetXP:
            params.budget?.rewardBudgetXP ?? CAMPAIGN_BUDGET_DEFAULTS.rewardBudgetXP,
          userCap: params.budget?.userCap ?? CAMPAIGN_BUDGET_DEFAULTS.userCap,
          dailyCapXP: params.budget?.dailyCapXP ?? CAMPAIGN_BUDGET_DEFAULTS.dailyCapXP,
          totalUserCap: params.budget?.totalUserCap ?? CAMPAIGN_BUDGET_DEFAULTS.totalUserCap,
        },
        spentXP: 0,
        spentTodayXP: {},
        userSpendCount: {},
        rewardedUsers: 0,
        exhausted: false,
        exhaustedAt: null,
        exhaustedReason: null,
      },
    },
    rewardConfiguration,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  campaigns.set(id, campaign);

  // Update status index
  const statusSet = campaignByStatus.get(campaign.status) ?? new Set();
  statusSet.add(id);
  campaignByStatus.set(campaign.status, statusSet);

  return campaign;
}

/**
 * Update campaign status.
 */
export function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
): boolean {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return false;

  // Remove from old status index
  const oldStatusSet = campaignByStatus.get(campaign.status);
  oldStatusSet?.delete(campaignId);

  // Update status
  campaign.status = status;
  campaign.updatedAt = new Date();

  // Add to new status index
  const newStatusSet = campaignByStatus.get(status) ?? new Set();
  newStatusSet.add(campaignId);
  campaignByStatus.set(status, newStatusSet);

  return true;
}

/**
 * Get a campaign by ID.
 */
export function getCampaign(campaignId: string): Campaign | null {
  return campaigns.get(campaignId) ?? null;
}

/**
 * Get all active campaigns.
 */
export function getActiveCampaigns(): Campaign[] {
  const activeIds = campaignByStatus.get('active') ?? new Set();
  return Array.from(activeIds)
    .map((id) => campaigns.get(id))
    .filter((c): c is Campaign => c !== undefined);
}

/**
 * Get campaigns by status.
 */
export function getCampaignsByStatus(status: CampaignStatus): Campaign[] {
  const statusIds = campaignByStatus.get(status) ?? new Set();
  return Array.from(statusIds)
    .map((id) => campaigns.get(id))
    .filter((c): c is Campaign => c !== undefined);
}

// ============================================================
// Campaign Attribution
// ============================================================

/**
 * Record campaign attribution.
 */
export function recordCampaignAttribution(
  campaignId: string,
  userId: string,
  source: ReferralSource,
  metadata: Record<string, unknown> = {},
): CampaignAttribution {
  const attribution: CampaignAttribution = {
    id: nanoid(),
    campaignId,
    userId,
    source,
    metadata,
    createdAt: new Date(),
  };

  const attributions = campaignAttributions.get(campaignId) ?? [];
  attributions.push(attribution);
  campaignAttributions.set(campaignId, attributions);

  // Update participant count
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.configuration.participantCount++;
  }

  return attribution;
}

/**
 * Get campaign attributions.
 */
export function getCampaignAttributions(campaignId: string): CampaignAttribution[] {
  return campaignAttributions.get(campaignId) ?? [];
}

/**
 * Get user's campaign attributions.
 */
export function getUserCampaignAttributions(userId: string): CampaignAttribution[] {
  const allAttributions: CampaignAttribution[] = [];
  for (const attributions of campaignAttributions.values()) {
    allAttributions.push(
      ...attributions.filter((a) => a.userId === userId),
    );
  }
  return allAttributions;
}

// ============================================================
// Campaign Queries
// ============================================================

/**
 * Check if a campaign is currently active.
 */
export function isCampaignActive(campaignId: string): boolean {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return false;

  const now = new Date();
  return (
    campaign.status === 'active' &&
    now >= campaign.startsAt &&
    now <= campaign.endsAt
  );
}

/**
 * Get campaign by deep link prefix.
 */
export function getCampaignByDeepLinkPrefix(prefix: string): Campaign | null {
  for (const campaign of campaigns.values()) {
    if (campaign.configuration.deepLinkPrefix === prefix) {
      return campaign;
    }
  }
  return null;
}

// ============================================================
// Campaign Lifecycle
// ============================================================

/**
 * Check and update campaign statuses based on time.
 */
export function checkCampaignStatuses(): number {
  let updatedCount = 0;
  const now = new Date();

  for (const campaign of campaigns.values()) {
    // Draft → Scheduled
    if (campaign.status === 'draft' && now >= campaign.startsAt) {
      updateCampaignStatus(campaign.id, 'scheduled');
      updatedCount++;
    }

    // Scheduled → Active
    if (campaign.status === 'scheduled' && now >= campaign.startsAt) {
      updateCampaignStatus(campaign.id, 'active');
      updatedCount++;
    }

    // Active → Ended
    if (campaign.status === 'active' && now > campaign.endsAt) {
      updateCampaignStatus(campaign.id, 'ended');
      updatedCount++;
    }
  }

  return updatedCount;
}

// ============================================================
// Campaign Budget Controls (Growth Engine Contract §46)
//
// When any cap is reached the campaign STOPS REWARDING
// but keeps collecting analytics.
// ============================================================

/**
 * Check whether a campaign can still grant rewards to a user.
 */
export function checkCampaignBudget(
  campaignId: string,
  userId: string,
  xpCost: number = 0,
): CampaignBudgetCheck {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return { canReward: false, reason: 'BUDGET_EXHAUSTED' };

  const budget = campaign.configuration.budget;
  if (!budget) return { canReward: true };

  const { config } = budget;

  // Total reward budget
  if (budget.spentXP + xpCost > config.rewardBudgetXP) {
    markBudgetExhausted(campaign, 'BUDGET_EXHAUSTED');
    return { canReward: false, reason: 'BUDGET_EXHAUSTED' };
  }

  // Daily spend cap
  const today = new Date().toISOString().slice(0, 10);
  const spentToday = budget.spentTodayXP[today] ?? 0;
  if (spentToday + xpCost > config.dailyCapXP) {
    return { canReward: false, reason: 'DAILY_CAP_REACHED' };
  }

  // Per-user reward cap
  const userCount = budget.userSpendCount[userId] ?? 0;
  if (userCount >= config.userCap) {
    return { canReward: false, reason: 'USER_CAP_REACHED' };
  }

  // Total distinct-user cap
  if (
    config.totalUserCap !== null &&
    !(userSpendCountHasUser(budget, userId)) &&
    budget.rewardedUsers >= config.totalUserCap
  ) {
    markBudgetExhausted(campaign, 'TOTAL_CAP_REACHED');
    return { canReward: false, reason: 'TOTAL_CAP_REACHED' }; 
  }

  return { canReward: true };
}

function userSpendCountHasUser(budget: NonNullable<Campaign['configuration']['budget']>, userId: string): boolean {
  return (budget.userSpendCount[userId] ?? 0) > 0;
}

function markBudgetExhausted(
  campaign: Campaign,
  reason: NonNullable<CampaignBudgetCheck['reason']>,
): void {
  const budget = campaign.configuration.budget;
  if (!budget || budget.exhausted) return;

  budget.exhausted = true;
  budget.exhaustedAt = new Date();
  budget.exhaustedReason = reason;
  campaign.updatedAt = new Date();

  trackCampaignBudgetExhausted(campaign.id, reason);
}

/**
 * Record a reward spend against the campaign budget.
 * Call only after checkCampaignBudget has returned canReward.
 */
export function recordRewardSpend(
  campaignId: string,
  userId: string,
  xpAmount: number,
): boolean {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return false;

  const budget = campaign.configuration.budget;
  if (!budget) return true; // no budget configured — always allowed

  const isNewUser = !userSpendCountHasUser(budget, userId);
  if (!isNewUser) {
    const userCount = budget.userSpendCount[userId] ?? 0;
    if (userCount >= budget.config.userCap) return false;
  }

  budget.spentXP += xpAmount;
  const today = new Date().toISOString().slice(0, 10);
  budget.spentTodayXP[today] = (budget.spentTodayXP[today] ?? 0) + xpAmount;
  budget.userSpendCount[userId] = (budget.userSpendCount[userId] ?? 0) + 1;
  if (isNewUser) budget.rewardedUsers++;

  if (budget.spentXP >= budget.config.rewardBudgetXP) {
    markBudgetExhausted(campaign, 'BUDGET_EXHAUSTED');
  }

  campaign.updatedAt = new Date();
  return true;
}

/**
 * Get the current budget state for a campaign.
 */
export function getCampaignBudgetState(campaignId: string) {
  const campaign = campaigns.get(campaignId);
  return campaign?.configuration.budget ?? null;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearCampaignService(): void {
  campaigns.clear();
  campaignAttributions.clear();
  campaignByStatus.clear();
}

export function _getCampaignCount(): number {
  return campaigns.size;
}

export function _getActiveCampaignCount(): number {
  return (campaignByStatus.get('active') ?? new Set()).size;
}
