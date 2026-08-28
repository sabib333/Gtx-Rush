/**
 * GTX Rush — Ad Service Tests
 *
 * Tests for:
 * - Ad availability checking
 * - Rewarded ad flow
 * - Ad completion
 * - Frequency controls
 * - Daily caps
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkAdAvailability,
  requestRewardedAd,
  completeRewardedAd,
  shouldShowInterstitial,
  getAdConfiguration,
  resetSessionAdCount,
  getUserAdCompletions,
  _clearAdService,
  _getAdCompletionCount,
} from '../ad-service';

describe('Ad Service', () => {
  const testUserId = 'test-user-001';
  const testSessionId = 'session-001';

  beforeEach(() => {
    _clearAdService();
  });

  describe('Ad Availability', () => {
    it('should check ad availability', () => {
      const result = checkAdAvailability(testUserId, 'rewarded', testSessionId);
      expect(result.available).toBe(true);
    });

    it('should respect session limits', () => {
      // Make 5 ads (session limit)
      for (let i = 0; i < 5; i++) {
        requestRewardedAd(testUserId, 'test_placement', testSessionId);
      }

      const result = checkAdAvailability(testUserId, 'rewarded', testSessionId);
      expect(result.available).toBe(false);
      expect(result.reason).toBe('SESSION_LIMIT_REACHED');
    });

    it('should reset session count', () => {
      for (let i = 0; i < 5; i++) {
        requestRewardedAd(testUserId, 'test_placement', testSessionId);
      }

      resetSessionAdCount(testUserId);

      const result = checkAdAvailability(testUserId, 'rewarded', testSessionId);
      expect(result.available).toBe(true);
    });
  });

  describe('Rewarded Ads', () => {
    it('should request a rewarded ad', () => {
      const response = requestRewardedAd(testUserId, 'game_complete', testSessionId);
      expect(response.available).toBe(true);
      expect(response.adType).toBe('rewarded');
      expect(response.adId).toBeDefined();
      expect(response.reward).toBeDefined();
    });

    it('should return unavailable reason when limit reached', () => {
      for (let i = 0; i < 5; i++) {
        requestRewardedAd(testUserId, 'game_complete', testSessionId);
      }

      const response = requestRewardedAd(testUserId, 'game_complete', testSessionId);
      expect(response.available).toBe(false);
      expect(response.unavailableReason).toBe('SESSION_LIMIT_REACHED');
    });

    it('should complete a rewarded ad', () => {
      const adResponse = requestRewardedAd(testUserId, 'game_complete', testSessionId);

      const result = completeRewardedAd(
        testUserId,
        adResponse.adId,
        'game_complete',
        'verification-token-001',
      );

      expect(result.success).toBe(true);
      expect(result.rewardGranted).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('should not complete ad twice (idempotent)', () => {
      const adResponse = requestRewardedAd(testUserId, 'game_complete', testSessionId);

      completeRewardedAd(
        testUserId,
        adResponse.adId,
        'game_complete',
        'verification-token-002',
      );

      const second = completeRewardedAd(
        testUserId,
        adResponse.adId,
        'game_complete',
        'verification-token-003',
      );

      expect(second.success).toBe(false);
      expect(second.error).toBe('AD_ALREADY_COMPLETED');
    });
  });

  describe('Interstitial Ads', () => {
    it('should show interstitial at eligible screen', () => {
      const shouldShow = shouldShowInterstitial(testUserId, 'game_complete', testSessionId);
      expect(shouldShow).toBe(true);
    });

    it('should not show interstitial at ineligible screen', () => {
      const shouldShow = shouldShowInterstitial(testUserId, 'game_play', testSessionId);
      expect(shouldShow).toBe(false);
    });
  });

  describe('Ad Configuration', () => {
    it('should get ad configuration', () => {
      const config = getAdConfiguration();
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.minIntervalMs).toBeGreaterThan(0);
      expect(config.maxPerSession).toBeGreaterThan(0);
      expect(config.maxPerDay).toBeGreaterThan(0);
    });
  });

  describe('Ad Metrics', () => {
    it('should track ad completions', () => {
      const adResponse = requestRewardedAd(testUserId, 'game_complete', testSessionId);
      completeRewardedAd(
        testUserId,
        adResponse.adId,
        'game_complete',
        'verification-token-004',
      );

      expect(getUserAdCompletions(testUserId)).toBe(1);
    });

    it('should track total completions', () => {
      const ad1 = requestRewardedAd(testUserId, 'game_complete', testSessionId);
      completeRewardedAd(testUserId, ad1.adId, 'game_complete', 'token-1');

      const ad2 = requestRewardedAd(testUserId, 'game_complete', testSessionId);
      completeRewardedAd(testUserId, ad2.adId, 'game_complete', 'token-2');

      expect(_getAdCompletionCount()).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should clear ad service', () => {
      _clearAdService();
      expect(_getAdCompletionCount()).toBe(0);
    });
  });
});
