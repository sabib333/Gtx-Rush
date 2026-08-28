/**
 * GTX Rush — Share Engine Tests
 *
 * Tests for:
 * - Share link generation
 * - Different share types
 * - Deep link integration
 * - Share tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateShareLink,
  generateChallengeShareLink,
  generateScoreShareLink,
  generateBadgeShareLink,
  generatePersonalBestShareLink,
  getShareLink,
  getUserShareLinks,
  _clearShareEngine,
  _getShareLinkCount,
  _getUserShareLinkCount,
} from '../share-engine';
import { generateReferralCode, _clearReferralEngine } from '../referral-engine';

describe('Share Engine', () => {
  const testUserId = 'test-user-001';

  beforeEach(() => {
    _clearShareEngine();
    _clearReferralEngine();
  });

  describe('Share Link Generation', () => {
    it('should generate a score share link', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);

      expect(result.success).toBe(true);
      expect(result.shareLink).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.deepLink).toBeDefined();
      expect(result.shareLink?.type).toBe('score');
    });

    it('should generate a challenge share link', () => {
      const result = generateChallengeShareLink(
        testUserId,
        'challenge-123',
        'tap-rush',
        5000,
      );

      expect(result.success).toBe(true);
      expect(result.shareLink?.type).toBe('challenge');
      expect(result.shareLink?.metadata.challengeId).toBe('challenge-123');
    });

    it('should generate a badge share link', () => {
      const result = generateBadgeShareLink(testUserId, 'speed_demon');

      expect(result.success).toBe(true);
      expect(result.shareLink?.type).toBe('badge');
      expect(result.shareLink?.metadata.badgeId).toBe('speed_demon');
    });

    it('should generate a personal best share link', () => {
      const result = generatePersonalBestShareLink(testUserId, 'quiz-rush', 15000);

      expect(result.success).toBe(true);
      expect(result.shareLink?.type).toBe('personal_best');
      expect(result.shareLink?.metadata.score).toBe(15000);
    });

    it('should generate a generic share link', () => {
      const result = generateShareLink({
        type: 'score',
        userId: testUserId,
        gameId: 'reaction-rush',
        score: 9842,
      });

      expect(result.success).toBe(true);
      expect(result.shareLink).toBeDefined();
    });

    it('should require challenge ID for challenge share', () => {
      const result = generateShareLink({
        type: 'challenge',
        userId: testUserId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('CHALLENGE_ID_REQUIRED');
    });

    it('should include deep link in share message', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);

      expect(result.message?.deepLink).toBeDefined();
      expect(result.message?.deepLink).toContain('t.me');
    });

    it('should include referral code in deep link', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);

      expect(result.deepLink).toBeDefined();
      expect(result.deepLink).toContain('ref_');
    });
  });

  describe('Share Link Queries', () => {
    it('should get share link by ID', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);
      const link = getShareLink(result.shareLink!.id);

      expect(link).toBeDefined();
      expect(link?.id).toBe(result.shareLink!.id);
    });

    it('should get user share links', () => {
      generateScoreShareLink(testUserId, 'reaction-rush', 9842);
      generateBadgeShareLink(testUserId, 'speed_demon');

      const links = getUserShareLinks(testUserId);
      expect(links.length).toBe(2);
    });

    it('should return empty for user with no shares', () => {
      const links = getUserShareLinks('non-existent-user');
      expect(links.length).toBe(0);
    });
  });

  describe('Share Content', () => {
    it('should include game name in share message', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);
      expect(result.message?.description).toContain('Reaction Rush');
    });

    it('should include score in share message', () => {
      const result = generateScoreShareLink(testUserId, 'reaction-rush', 9842);
      expect(result.message?.description).toContain('9842');
    });

    it('should include badge name in share message', () => {
      const result = generateBadgeShareLink(testUserId, 'speed_demon');
      expect(result.message?.description).toContain('speed_demon');
    });
  });

  describe('Cleanup', () => {
    it('should clear share engine', () => {
      generateScoreShareLink(testUserId, 'reaction-rush', 9842);
      _clearShareEngine();
      expect(_getShareLinkCount()).toBe(0);
    });
  });
});
