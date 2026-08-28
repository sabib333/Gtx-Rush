/**
 * GTX Rush — Referral Engine Tests
 *
 * Tests for:
 * - Referral code generation
 * - Deep link resolution
 * - Referral lifecycle
 * - Fraud detection
 * - Self-referral prevention
 * - Reward granting
 * - Dashboard and stats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateReferralCode,
  getUserReferralCode,
  getReferralCodeByCode,
  resolveDeepLink,
  createReferral,
  openReferral,
  registerReferral,
  activateReferral,
  qualifyReferral,
  grantReferralReward,
  getReferralDashboard,
  getReferralStats,
  _getReferralCount,
  _clearReferralEngine,
  _getReferralCodeCount,
  _getReferralCount,
  _getUserReferralCount,
} from '../referral-engine';

describe('Referral Engine', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';

  beforeEach(() => {
    _clearReferralEngine();
  });

  describe('Referral Code Generation', () => {
    it('should generate a referral code for a user', () => {
      const code = generateReferralCode(testUserId);
      expect(code).toBeDefined();
      expect(code.code).toBeDefined();
      expect(code.code.length).toBe(8);
      expect(code.userId).toBe(testUserId);
      expect(code.isActive).toBe(true);
    });

    it('should return existing code if user already has one', () => {
      const first = generateReferralCode(testUserId);
      const second = generateReferralCode(testUserId);
      expect(first.code).toBe(second.code);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const code = generateReferralCode(`user-${i}`);
        codes.add(code.code);
      }
      expect(codes.size).toBe(10);
    });

    it('should get user referral code', () => {
      generateReferralCode(testUserId);
      const code = getUserReferralCode(testUserId);
      expect(code).toBeDefined();
      expect(code?.userId).toBe(testUserId);
    });

    it('should get referral code by code string', () => {
      const generated = generateReferralCode(testUserId);
      const found = getReferralCodeByCode(generated.code);
      expect(found).toBeDefined();
      expect(found?.id).toBe(generated.id);
    });

    it('should return null for non-existent code', () => {
      const found = getReferralCodeByCode('NONEXIST');
      expect(found).toBeNull();
    });
  });

  describe('Deep Link Resolution', () => {
    it('should resolve a referral deep link', () => {
      generateReferralCode(testUserId);
      const code = getUserReferralCode(testUserId);

      const resolution = resolveDeepLink(`ref_${code!.code}`);
      expect(resolution.valid).toBe(true);
      expect(resolution.context?.referralCode).toBe(code!.code);
      expect(resolution.inviter).toBeDefined();
    });

    it('should resolve a challenge deep link', () => {
      const resolution = resolveDeepLink('ch_test-token-123');
      expect(resolution.valid).toBe(true);
      expect(resolution.context?.challengeToken).toBe('test-token-123');
    });

    it('should resolve a campaign deep link', () => {
      generateReferralCode(testUserId);
      const code = getUserReferralCode(testUserId);

      const resolution = resolveDeepLink(`camp_campaign1_${code!.code}`);
      expect(resolution.valid).toBe(true);
      expect(resolution.context?.campaignId).toBe('campaign1');
      expect(resolution.context?.referralCode).toBe(code!.code);
    });

    it('should return invalid for empty start param', () => {
      const resolution = resolveDeepLink('');
      expect(resolution.valid).toBe(false);
    });

    it('should return invalid for invalid code', () => {
      const resolution = resolveDeepLink('ref_INVALIDCODE');
      expect(resolution.valid).toBe(false);
      expect(resolution.error).toBe('INVALID_REFERRAL_CODE');
    });
  });

  describe('Referral Lifecycle', () => {
    it('should create a referral', () => {
      const code = generateReferralCode(testUserId);
      const result = createReferral(testUserId, code.code, 'direct_referral');

      expect(result.success).toBe(true);
      expect(result.referral).toBeDefined();
      expect(result.referral?.inviterUserId).toBe(testUserId);
      expect(result.referral?.status).toBe('created');
    });

    it('should reject referral with invalid code', () => {
      const result = createReferral(testUserId, 'INVALID', 'direct_referral');
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_REFERRAL_CODE');
    });

    it('should open a referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');

      const opened = openReferral(created.referral!.id);
      expect(opened).toBe(true);
    });

    it('should register a referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);

      const registered = registerReferral(created.referral!.id, testUserId2);
      expect(registered.success).toBe(true);
    });

    it('should prevent self-referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);

      const registered = registerReferral(created.referral!.id, testUserId);
      expect(registered.success).toBe(false);
      expect(registered.error).toBe('SELF_REFERRAL_DETECTED');
    });

    it('should activate a referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);
      registerReferral(created.referral!.id, testUserId2);

      const activated = activateReferral(created.referral!.id, testUserId2);
      expect(activated.success).toBe(true);
    });

    it('should qualify a referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);
      registerReferral(created.referral!.id, testUserId2);
      activateReferral(created.referral!.id, testUserId2);

      const qualified = qualifyReferral(created.referral!.id, testUserId2);
      expect(qualified.success).toBe(true);
    });

    it('should complete full lifecycle', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);
      registerReferral(created.referral!.id, testUserId2);
      activateReferral(created.referral!.id, testUserId2);
      qualifyReferral(created.referral!.id, testUserId2);

      const referral = _getReferralCount();
      expect(referral).toBe(1);
    });
  });

  describe('Referral Rewards', () => {
    it('should grant referral reward', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);
      registerReferral(created.referral!.id, testUserId2);
      activateReferral(created.referral!.id, testUserId2);
      qualifyReferral(created.referral!.id, testUserId2);

      const rewardResult = grantReferralReward(created.referral!.id);
      expect(rewardResult.success).toBe(true);
      expect(rewardResult.rewards).toBeDefined();
      expect(rewardResult.rewards!.length).toBe(2); // Inviter + invitee
    });

    it('should not reward unqualified referral', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');

      const rewardResult = grantReferralReward(created.referral!.id);
      expect(rewardResult.success).toBe(false);
      expect(rewardResult.error).toBe('REFERRAL_NOT_QUALIFIED');
    });

    it('should not reward twice (idempotent)', () => {
      const code = generateReferralCode(testUserId);
      const created = createReferral(testUserId, code.code, 'direct_referral');
      openReferral(created.referral!.id);
      registerReferral(created.referral!.id, testUserId2);
      activateReferral(created.referral!.id, testUserId2);
      qualifyReferral(created.referral!.id, testUserId2);

      grantReferralReward(created.referral!.id);
      const second = grantReferralReward(created.referral!.id);
      expect(second.success).toBe(false);
      expect(second.error).toBe('ALREADY_REWARDED');
    });
  });

  describe('Referral Dashboard', () => {
    it('should get referral dashboard', () => {
      const dashboard = getReferralDashboard(testUserId);
      expect(dashboard).toBeDefined();
      expect(dashboard.totalInvited).toBe(0);
      expect(dashboard.qualified).toBe(0);
    });

    it('should track referral counts', () => {
      const code = generateReferralCode(testUserId);
      createReferral(testUserId, code.code, 'direct_referral');
      createReferral(testUserId, code.code, 'direct_referral');

      const dashboard = getReferralDashboard(testUserId);
      expect(dashboard.totalInvited).toBe(2);
    });
  });

  describe('Referral Stats', () => {
    it('should get referral stats', () => {
      const stats = getReferralStats(testUserId);
      expect(stats).toBeDefined();
      expect(stats.invitesSent).toBe(0);
      expect(stats.conversionRates).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clear referral engine', () => {
      const code = generateReferralCode(testUserId);
      createReferral(testUserId, code.code, 'direct_referral');

      _clearReferralEngine();
      expect(_getReferralCodeCount()).toBe(0);
      expect(_getReferralCount()).toBe(0);
    });
  });
});
