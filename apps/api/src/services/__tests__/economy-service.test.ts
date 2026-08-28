import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  awardXP,
  getUserXP,
  getUserLevelProgress,
  getUserXPTransactions,
  getEconomyProfile,
  getUserEconomyStats,
  _clearAllEconomyData,
} from '../economy-service';

describe('EconomyService', () => {
  beforeEach(() => {
    _clearAllEconomyData();
  });

  describe('XP Award System', () => {
    it('should award XP to a user', () => {
      const result = awardXP('user-1', 100, 'game_completion', {
        referenceId: 'game-123',
        referenceType: 'game_session',
      });

      expect(result.xpAwarded).toBe(100);
      expect(result.newTotal).toBe(100);
      expect(result.level).toBeGreaterThan(0);
    });

    it('should enforce daily limits', () => {
      // Award XP up to daily limit
      for (let i = 0; i < 10; i++) {
        awardXP('user-1', 60, 'game_completion');
      }

      // Should be limited
      const result = awardXP('user-1', 100, 'game_completion');
      expect(result.xpAwarded).toBeLessThanOrEqual(100);
    });

    it('should apply streak multiplier', () => {
      const result = awardXP('user-1', 100, 'game_completion', {
        streakMultiplier: 1.25,
      });

      expect(result.xpAwarded).toBe(125);
    });

    it('should be idempotent', () => {
      const result1 = awardXP('user-1', 100, 'game_completion', {
        referenceId: 'game-123',
        idempotencyKey: 'key-1',
      });

      const result2 = awardXP('user-1', 100, 'game_completion', {
        referenceId: 'game-123',
        idempotencyKey: 'key-1',
      });

      expect(result2.xpAwarded).toBe(0);
    });

    it('should track XP transactions', () => {
      awardXP('user-1', 100, 'game_completion');
      awardXP('user-1', 50, 'mission');

      const transactions = getUserXPTransactions('user-1');
      expect(transactions).toHaveLength(2);
    });
  });

  describe('Level Progress', () => {
    it('should calculate level progress', () => {
      awardXP('user-1', 500, 'game_completion');

      const progress = getUserLevelProgress('user-1');
      expect(progress.currentLevel).toBeGreaterThan(0);
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('Economy Profile', () => {
    it('should get economy profile', () => {
      awardXP('user-1', 100, 'game_completion');

      const profile = getEconomyProfile('user-1');
      expect(profile.userId).toBe('user-1');
      expect(profile.totalXp).toBe(100);
      expect(profile.currentLevel).toBeGreaterThan(0);
    });
  });

  describe('Economy Stats', () => {
    it('should get user economy stats', () => {
      awardXP('user-1', 100, 'game_completion');
      awardXP('user-1', 50, 'mission');

      const stats = getUserEconomyStats('user-1');
      expect(stats.totalXpEarned).toBe(150);
    });
  });
});
