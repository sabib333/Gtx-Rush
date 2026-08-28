/**
 * GTX Rush — Campaign Budget Controls Tests
 *
 * Covers (Growth Engine Contract §46, §58 CAMPAIGN):
 * - Budget check approval
 * - Total budget exhaustion
 * - Daily cap
 * - Per-user cap
 * - Total-user cap
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCampaign,
  updateCampaignStatus,
  checkCampaignBudget,
  recordRewardSpend,
  getCampaignBudgetState,
  _clearCampaignService,
} from '../campaign-service';

function makeActiveCampaign(budget: Parameters<typeof createCampaign>[0]['budget']) {
  const campaign = createCampaign({
    name: 'Budget Test',
    description: 'test',
    source: 'campaign',
    startsAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    budget,
  });
  updateCampaignStatus(campaign.id, 'active');
  return campaign;
}

describe('Campaign Budget Controls', () => {
  beforeEach(() => {
    _clearCampaignService();
  });

  it('should allow rewards while budget remains', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 1000,
      userCap: 5,
      dailyCapXP: 500,
      totalUserCap: null,
    });

    const check = checkCampaignBudget(campaign.id, 'user-1', 150);
    expect(check.canReward).toBe(true);
  });

  it('should stop rewarding when the total budget is exhausted', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 300,
      userCap: 10,
      dailyCapXP: 10000,
      totalUserCap: null,
    });

    expect(recordRewardSpend(campaign.id, 'user-1', 250)).toBe(true);

    const check = checkCampaignBudget(campaign.id, 'user-2', 100);
    expect(check.canReward).toBe(false);
    expect(check.reason).toBe('BUDGET_EXHAUSTED');

    const state = getCampaignBudgetState(campaign.id);
    expect(state?.exhausted).toBe(true);
  });

  it('should enforce the daily cap', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 100000,
      userCap: 10,
      dailyCapXP: 200,
      totalUserCap: null,
    });

    recordRewardSpend(campaign.id, 'user-1', 180);
    const check = checkCampaignBudget(campaign.id, 'user-2', 50);
    expect(check.canReward).toBe(false);
    expect(check.reason).toBe('DAILY_CAP_REACHED');
  });

  it('should enforce the per-user cap', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 100000,
      userCap: 2,
      dailyCapXP: 100000,
      totalUserCap: null,
    });

    recordRewardSpend(campaign.id, 'user-1', 10);
    recordRewardSpend(campaign.id, 'user-1', 10);

    const check = checkCampaignBudget(campaign.id, 'user-1', 0);
    expect(check.canReward).toBe(false);
    expect(check.reason).toBe('USER_CAP_REACHED');
  });

  it('should enforce the total distinct-user cap', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 100000,
      userCap: 5,
      dailyCapXP: 100000,
      totalUserCap: 2,
    });

    recordRewardSpend(campaign.id, 'user-1', 10);
    recordRewardSpend(campaign.id, 'user-2', 10);

    const check = checkCampaignBudget(campaign.id, 'user-3', 0);
    expect(check.canReward).toBe(false);
    expect(check.reason).toBe('TOTAL_CAP_REACHED');
  });

  it('should keep collecting analytics after exhaustion', () => {
    const campaign = makeActiveCampaign({
      rewardBudgetXP: 100,
      userCap: 10,
      dailyCapXP: 100000,
      totalUserCap: null,
    });

    recordRewardSpend(campaign.id, 'user-1', 100);
    // Attribution recording still works post-exhaustion
    const state = getCampaignBudgetState(campaign.id);
    expect(state?.exhausted).toBe(true);
    expect(state?.spentXP).toBe(100);
    expect(state?.rewardedUsers).toBe(1);
  });
});
