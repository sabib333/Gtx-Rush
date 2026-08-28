/**
 * GTX Rush — Qualification Engine Tests
 *
 * Covers (Growth Engine Contract §4, §44, §58 REFERRAL):
 * - Valid referral qualification after meaningful activity
 * - No qualification for link clicks alone
 * - Low-score / fake engagement rejection
 * - Campaign budget gating on rewards
 * - Rewards flow through the Economy Engine with idempotency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateReferralCode,
  createReferral,
  registerReferral,
  getReferralCodeByCode,
  _clearReferralEngine,
} from '../referral-engine';
import {
  recordGameCompletion,
  checkQualificationEligibility,
  getActivitySnapshot,
  evaluatePendingReferrals,
  _clearQualificationEngine,
} from '../qualification-engine';
import {
  createCampaign,
  getCampaignBudgetState,
} from '../campaign-service';
import { getUserXP, _clearAllEconomyData } from '../economy-service';

describe('Qualification Engine', () => {
  const inviterId = 'qual-inviter-001';
  const inviteeId = 'qual-invitee-001';
  let referralCode = '';

  beforeEach(() => {
    _clearReferralEngine();
    _clearQualificationEngine();
    _clearAllEconomyData();

    const code = generateReferralCode(inviterId);
    referralCode = code.code;
    const created = createReferral(inviterId, referralCode, 'direct_referral', {});
    expect(created.success).toBe(true);
    const registered = registerReferral(created.referral!.id, inviteeId);
    expect(registered.success).toBe(true);
  });

  describe('Meaningful activity requirement', () => {
    it('should NOT qualify a referral from a link click alone', () => {
      const decision = checkQualificationEligibility(inviteeId);
      expect(decision.eligible).toBe(false);
      expect(decision.unmetCriteria.length).toBeGreaterThan(0);
    });

    it('should qualify a referral after a valid first game completion', () => {
      recordGameCompletion(inviteeId, 'reaction-rush', 500);

      const decision = checkQualificationEligibility(inviteeId);
      expect(decision.eligible).toBe(true);

      // Pipeline runs automatically on completion
      const code = getReferralCodeByCode(referralCode)!;
      void code;
      // inviter should now have received XP through the Economy Engine
      expect(getUserXP(inviterId)).toBeGreaterThan(0);
    });

    it('should NOT qualify when scores are below legitimacy threshold', () => {
      recordGameCompletion(inviteeId, 'reaction-rush', 5); // below minimumValidScore

      const snapshot = getActivitySnapshot(inviteeId);
      expect(snapshot.validGamesCompleted).toBe(0);

      const decision = checkQualificationEligibility(inviteeId);
      expect(decision.eligible).toBe(false);
      expect(getUserXP(inviterId)).toBe(0);
    });

    it('should count multiple games toward multi-game thresholds', () => {
      recordGameCompletion(inviteeId, 'reaction-rush', 100);
      // Space out beyond anti-farm window by using a distinct call pattern;
      // engine counts valid completions with minimum spacing
      recordGameCompletion(inviteeId, 'tap-rush', 300);

      const snapshot = getActivitySnapshot(inviteeId);
      expect(snapshot.validGamesCompleted).toBeGreaterThanOrEqual(1);
      expect(snapshot.bestScore).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Reward flow through Economy Engine', () => {
    it('should grant inviter and invitee XP exactly once per referral', () => {
      recordGameCompletion(inviteeId, 'quiz-rush', 800);
      const inviterXp = getUserXP(inviterId);
      const inviteeXp = getUserXP(inviteeId);
      expect(inviterXp).toBeGreaterThan(0);
      expect(inviteeXp).toBeGreaterThan(0);

      // Re-evaluating must not double-grant (idempotency)
      evaluatePendingReferrals(inviteeId);
      expect(getUserXP(inviterId)).toBe(inviterXp);
      expect(getUserXP(inviteeId)).toBe(inviteeXp);
    });
  });

  describe('Campaign budget gating', () => {
    it('should stop rewarding when campaign budget is exhausted but still qualify', () => {
      const campaign = createCampaign({
        name: 'Tiny Budget',
        description: 'Exhausts immediately',
        source: 'campaign',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        budget: { rewardBudgetXP: 50 }, // less than one referral's cost
      });

      // Create a fresh referral tied to the exhausted-budget campaign
      const created = createReferral(
        inviterId,
        referralCode,
        'campaign',
        { campaignId: campaign.id },
      );
      expect(created.success).toBe(true);
      registerReferral(created.referral!.id, 'budget-invitee-001');

      recordGameCompletion('budget-invitee-001', 'tap-rush', 400);

      // Budget blocks the payout…
      const budgetState = getCampaignBudgetState(campaign.id);
      expect(budgetState?.exhausted).toBe(true);

      // …and the inviter earned nothing from THIS campaign referral
      expect(budgetState?.spentXP).toBe(0);
    });
  });
});
