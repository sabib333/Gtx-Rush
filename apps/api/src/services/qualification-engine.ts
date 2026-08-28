/**
 * GTX Rush — Referral Qualification Engine v1.0
 *
 * Converts meaningful invitee activity into QUALIFIED referrals.
 *
 * Flow (Growth Engine Contract §43):
 *   Qualified Activity
 *     → Qualification Thresholds (configurable)
 *     → Fraud Check (already run at registration; rejected referrals never qualify)
 *     → Campaign Budget Check
 *     → Reward Transaction via Economy Engine (never direct XP edits)
 *     → Grant Reward
 *
 * SECURITY:
 * - A referral NEVER qualifies from a link click alone
 * - Rejected/suspicious referrals cannot be rewarded while held
 * - Rewards are idempotent and capped
 * - All thresholds are server-side configuration
 *
 * Contract: Growth Engine Contract v1.0
 */

import type {
  Referral,
  QualificationDecision,
} from '@gtx-rush/types';
import { QUALIFICATION_CONFIG } from '@gtx-rush/config';
import {
  getReferralCodeByCode,
  activateReferral,
  qualifyReferral,
  grantReferralReward,
  _getUserReferralsForInviteeInternal,
} from './referral-engine';
import { checkCampaignBudget, recordRewardSpend } from './campaign-service';
import { awardXP, createRewardTransaction } from './economy-service';
import {
  trackGrowthEvent,
  trackReferralQualified,
  trackReferralRewarded,
} from './growth-analytics';

// ============================================================
// In-memory activity store (production: PostgreSQL via Drizzle ORM)
// ============================================================

interface GameCompletionRecord {
  gameId: string;
  score: number;
  completedAt: number;
}

const userActivity = new Map<string, GameCompletionRecord[]>();
const userEventsJoined = new Map<string, string[]>(); // userId → eventIds

// ============================================================
// Activity Recording
// ============================================================

/**
 * Record a legitimate game completion for a user.
 * Called by the server after score validation/anti-cheat — never by the client.
 */
export function recordGameCompletion(
  userId: string,
  gameId: string,
  score: number,
): void {
  const completions = userActivity.get(userId) ?? [];
  completions.push({ gameId, score, completedAt: Date.now() });
  userActivity.set(userId, completions);

  // After every completion, re-evaluate pending referrals for this user
  evaluatePendingReferrals(userId);
}

/**
 * Record an event join (alternative qualification path when enabled).
 */
export function recordEventJoin(userId: string, eventId: string): void {
  const joined = userEventsJoined.get(userId) ?? [];
  if (joined.includes(eventId)) return;
  joined.push(eventId);
  userEventsJoined.set(userId, joined);

  if (QUALIFICATION_CONFIG.eventJoinQualifies) {
    evaluatePendingReferrals(userId);
  }
}

/**
 * Get the current activity snapshot for a user.
 */
export function getActivitySnapshot(userId: string): {
  gamesCompleted: number;
  validGamesCompleted: number;
  bestScore: number;
  eventsJoined: number;
  lastGameAt: Date | null;
} {
  const completions = userActivity.get(userId) ?? [];
  const valid = countValidCompletions(completions);

  return {
    gamesCompleted: completions.length,
    validGamesCompleted: valid.length,
    bestScore: completions.reduce((max, c) => Math.max(max, c.score), 0),
    eventsJoined: (userEventsJoined.get(userId) ?? []).length,
    lastGameAt: completions.length
      ? new Date(Math.max(...completions.map((c) => c.completedAt)))
      : null,
  };
}

// ============================================================
// Qualification Logic
// ============================================================

/**
 * Count completions that meet legitimacy criteria:
 * - Score >= minimumValidScore (anti fake engagement)
 * - Respect minimum spacing between counted games (anti automation)
 */
function countValidCompletions(
  completions: GameCompletionRecord[],
): GameCompletionRecord[] {
  const sorted = [...completions].sort((a, b) => a.completedAt - b.completedAt);
  const valid: GameCompletionRecord[] = [];
  let lastCountedAt = 0;

  for (const completion of sorted) {
    if (completion.score < QUALIFICATION_CONFIG.minimumValidScore) continue;
    const secondsSinceLast =
      (completion.completedAt - lastCountedAt) / 1000;
    if (
      valid.length > 0 &&
      secondsSinceLast < QUALIFICATION_CONFIG.minSecondsBetweenGames
    ) {
      continue;
    }
    valid.push(completion);
    lastCountedAt = completion.completedAt;
  }

  return valid;
}

/**
 * Evaluate whether a user meets qualification thresholds.
 */
export function checkQualificationEligibility(userId: string): QualificationDecision {
  const snapshot = getActivitySnapshot(userId);
  const unmetCriteria: string[] = [];

  switch (QUALIFICATION_CONFIG.strategy) {
    case 'first_game_completed':
    case 'games_completed': {
      const required = QUALIFICATION_CONFIG.requiredGamesCompleted;
      if (snapshot.validGamesCompleted < required) {
        unmetCriteria.push(
          `Requires ${required} valid game completion(s), has ${snapshot.validGamesCompleted}`,
        );
      }
      break;
    }
    case 'minimum_activity':
      if (snapshot.validGamesCompleted < 1) {
        unmetCriteria.push('Requires at least one valid game');
      }
      if (snapshot.eventsJoined < 1 && unmetCriteria.length > 0) {
        unmetCriteria.push('Or requires joining an event');
      }
      break;
    case 'event_joined':
      if (snapshot.eventsJoined < 1) {
        unmetCriteria.push('Requires joining an event');
      }
      break;
  }

  // Registration window
  if (QUALIFICATION_CONFIG.qualificationWindowHours !== null) {
    const firstGame = userActivity.get(userId)?.[0];
    if (!firstGame) {
      unmetCriteria.push('No recorded activity yet');
    } else {
      const windowMs =
        QUALIFICATION_CONFIG.qualificationWindowHours * 60 * 60 * 1000;
      if (Date.now() - firstGame.completedAt > windowMs) {
        unmetCriteria.push('Qualification window expired');
      }
    }
  }

  return {
    eligible: unmetCriteria.length === 0,
    reason: unmetCriteria.length === 0 ? 'All criteria met' : 'Criteria not met',
    unmetCriteria,
  };
}

// ============================================================
// Referral Qualification Pipeline
// ============================================================

/**
 * Evaluate all pending referrals where this user is the invitee.
 * For each eligible referral: activate → qualify → budget check → reward.
 */
export function evaluatePendingReferrals(inviteeUserId: string): void {
  const pendingReferrals = _getUserReferralsForInviteeInternal(inviteeUserId);

  for (const referral of pendingReferrals) {
    processReferral(referral, inviteeUserId);
  }
}

function processReferral(referral: Referral, inviteeUserId: string): void {
  // Never touch rejected referrals
  if (referral.status === 'rejected' || referral.fraudStatus === 'rejected') {
    return;
  }

  const decision = checkQualificationEligibility(inviteeUserId);
  trackGrowthEvent('referral_qualified', referral.inviterUserId, {
    referralId: referral.id,
    inviteeUserId,
    eligible: decision.eligible,
    reason: decision.reason,
  });

  if (!decision.eligible) return;

  // Advance lifecycle: registered → activated → qualified
  if (referral.status === 'registered') {
    const activated = activateReferral(referral.id, inviteeUserId);
    if (!activated.success) return;
  }

  const qualified = qualifyReferral(referral.id, inviteeUserId);
  if (!qualified.success) return;

  trackReferralQualified(referral.id, referral.inviterUserId, inviteeUserId);

  // Reward through budget controls + Economy Engine
  grantRewardsWithBudgetControls(referral, inviteeUserId);
}

/**
 * Grant rewards respecting campaign budgets and routing all value
 * through the Economy Engine with idempotency keys.
 */
function grantRewardsWithBudgetControls(
  referral: Referral,
  _inviteeUserId: string,
): void {
  // Campaign budget gate (if referral is part of a campaign)
  let budgetApproved = true;
  if (referral.campaignId) {
    const inviterXpCost = estimateRewardCost(referral);
    const budgetCheck = checkCampaignBudget(referral.campaignId, referral.inviterUserId, inviterXpCost);
    budgetApproved = budgetCheck.canReward;

    if (!budgetApproved) {
      trackGrowthEvent('referral_rewarded', 'system', {
        referralId: referral.id,
        blocked: true,
        reason: budgetCheck.reason,
        campaignId: referral.campaignId,
      });
      // Qualification still stands — only rewards stop (Contract §46)
      return;
    }
  }

  const result = grantReferralReward(referral.id);
  if (!result.success || !result.rewards) return;

  for (const reward of result.rewards) {
    if (reward.rewardType === 'xp' && typeof reward.rewardValue === 'number') {
      // Route through the Economy Engine — never edit XP directly
      const xpResult = awardXP(reward.userId, reward.rewardValue, 'referral', {
        referenceId: reward.referenceId,
        referenceType: 'referral',
        idempotencyKey: reward.idempotencyKey,
      });

      createRewardTransaction(
        reward.userId,
        'referral',
        reward.referenceId,
        'referral',
        'xp',
        xpResult.xpAwarded,
        { idempotencyKey: `reward:${reward.idempotencyKey}` },
      );

      trackReferralRewarded(reward.referralId, reward.userId, 'xp', xpResult.xpAwarded);
    }
  }

  // Record spend against campaign budget
  if (referral.campaignId && budgetApproved) {
    const totalSpent = result.rewards.reduce((sum, r) => {
      return typeof r.rewardValue === 'number' ? sum + r.rewardValue : sum;
    }, 0);
    recordRewardSpend(referral.campaignId, referral.inviterUserId, totalSpent);
  }
}

function estimateRewardCost(referral: Referral): number {
  const code = getReferralCodeByCode(referral.referralCode);
  void code;
  // Inviter + invitee default XP is the standard cost of one qualified referral
  return 150 + 100; // matches DEFAULT_REFERRAL_REWARDS
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearQualificationEngine(): void {
  userActivity.clear();
  userEventsJoined.clear();
}
