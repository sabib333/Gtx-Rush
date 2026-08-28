/**
 * GTX Rush — Reward Inventory Tests
 *
 * Tests for:
 * - Reward item initialization
 * - Idempotent reward granting
 * - Duplicate prevention
 * - Inventory management
 * - Reward history
 * - Transaction tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeRewardItems,
  grantReward,
  getUserInventory,
  getUserInventoryByType,
  userHasItem,
  getRewardHistory,
  getTotalXpEarned,
  getRewardItem,
  _clearAllRewards,
  _getRewardItemCount,
  _getUserInventoryCount,
  _getTransactionCount,
} from '../reward-inventory';
import type { MissionRewardConfiguration } from '@gtx-rush/types';

describe('Reward Inventory', () => {
  const testUserId = 'test-reward-user-001';

  beforeEach(() => {
    _clearAllRewards();
    initializeRewardItems();
  });

  describe('Reward Items', () => {
    it('should initialize reward items', () => {
      const count = _getRewardItemCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should have badge items', () => {
      const streak7 = getRewardItem('streak_7_days');
      expect(streak7).toBeDefined();
      expect(streak7?.type).toBe('badge');
      expect(streak7?.rarity).toBe('uncommon');
    });

    it('should have title items', () => {
      const legendary = getRewardItem('title_legendary_streak');
      expect(legendary).toBeDefined();
      expect(legendary?.type).toBe('title');
    });

    it('should return null for non-existent item', () => {
      const item = getRewardItem('non-existent');
      expect(item).toBeNull();
    });
  });

  describe('Reward Granting', () => {
    it('should grant XP reward', () => {
      const config: MissionRewardConfiguration = { xp: 100 };
      const result = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      expect(result.success).toBe(true);
      expect(result.granted.xp).toBe(100);
      expect(result.idempotencyKey).toBeDefined();
    });

    it('should grant badge reward', () => {
      const config: MissionRewardConfiguration = { xp: 0, badgeId: 'streak_7_days' };
      const result = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      expect(result.success).toBe(true);
      expect(userHasItem(testUserId, 'streak_7_days')).toBe(true);
    });

    it('should grant title reward', () => {
      const config: MissionRewardConfiguration = { xp: 0, titleId: 'title_legendary_streak' };
      const result = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      expect(result.success).toBe(true);
      expect(userHasItem(testUserId, 'title_legendary_streak')).toBe(true);
    });

    it('should prevent duplicate badge grants', () => {
      const config: MissionRewardConfiguration = { xp: 0, badgeId: 'streak_7_days' };

      // First grant
      grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      // Second grant (duplicate)
      const result = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      // Should be idempotent
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_GRANTED');
    });

    it('should prevent duplicate title grants', () => {
      const config: MissionRewardConfiguration = { xp: 0, titleId: 'title_legendary_streak' };

      // First grant
      grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      // Second grant (duplicate)
      const result = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_GRANTED');
    });

    it('should allow multiple XP grants with different references', () => {
      const config: MissionRewardConfiguration = { xp: 100 };

      const first = grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');
      const second = grantReward(testUserId, config, 'mission_reward', 'mission-2', 'user_mission');

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    });
  });

  describe('Inventory Management', () => {
    it('should track user inventory', () => {
      const config: MissionRewardConfiguration = { xp: 0, badgeId: 'streak_7_days' };
      grantReward(testUserId, config, 'mission_reward', 'mission-1', 'user_mission');

      const inventory = getUserInventory(testUserId);
      expect(inventory.length).toBe(1);
      expect(inventory[0]?.itemId).toBe('streak_7_days');
    });

    it('should filter inventory by type', () => {
      grantReward(testUserId, { xp: 0, badgeId: 'streak_7_days' }, 'mission_reward', 'mission-1', 'user_mission');
      grantReward(testUserId, { xp: 0, titleId: 'title_legendary_streak' }, 'mission_reward', 'mission-2', 'user_mission');

      const badges = getUserInventoryByType(testUserId, 'badge');
      const titles = getUserInventoryByType(testUserId, 'title');

      expect(badges.length).toBe(1);
      expect(titles.length).toBe(1);
    });

    it('should check if user has item', () => {
      grantReward(testUserId, { xp: 0, badgeId: 'streak_7_days' }, 'mission_reward', 'mission-1', 'user_mission');

      expect(userHasItem(testUserId, 'streak_7_days')).toBe(true);
      expect(userHasItem(testUserId, 'streak_30_days')).toBe(false);
    });

    it('should return empty inventory for new user', () => {
      const inventory = getUserInventory('new-user');
      expect(inventory.length).toBe(0);
    });
  });

  describe('Reward History', () => {
    it('should track reward transactions', () => {
      grantReward(testUserId, { xp: 100 }, 'mission_reward', 'mission-1', 'user_mission');

      const history = getRewardHistory(testUserId);
      expect(history.transactions.length).toBe(1);
      expect(history.transactions[0]?.rewardType).toBe('xp');
    });

    it('should paginate reward history', () => {
      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        grantReward(testUserId, { xp: 100 }, 'mission_reward', `mission-${i}`, 'user_mission');
      }

      const firstPage = getRewardHistory(testUserId, { limit: 2 });
      expect(firstPage.transactions.length).toBe(2);
      expect(firstPage.pagination.hasMore).toBe(true);

      const secondPage = getRewardHistory(testUserId, {
        limit: 2,
        cursor: firstPage.pagination.nextCursor!,
      });
      expect(secondPage.transactions.length).toBe(2);
    });

    it('should filter history by source', () => {
      grantReward(testUserId, { xp: 100 }, 'mission_reward', 'mission-1', 'user_mission');
      grantReward(testUserId, { xp: 50 }, 'streak_milestone', 'milestone-1', 'streak_milestone');

      const missionHistory = getRewardHistory(testUserId, { source: 'mission_reward' });
      const streakHistory = getRewardHistory(testUserId, { source: 'streak_milestone' });

      expect(missionHistory.transactions.length).toBe(1);
      expect(streakHistory.transactions.length).toBe(1);
    });

    it('should return empty history for new user', () => {
      const history = getRewardHistory('new-user');
      expect(history.transactions.length).toBe(0);
      expect(history.pagination.hasMore).toBe(false);
    });
  });

  describe('XP Tracking', () => {
    it('should track total XP earned', () => {
      grantReward(testUserId, { xp: 100 }, 'mission_reward', 'mission-1', 'user_mission');
      grantReward(testUserId, { xp: 200 }, 'mission_reward', 'mission-2', 'user_mission');

      const total = getTotalXpEarned(testUserId);
      expect(total).toBe(300);
    });

    it('should return 0 XP for new user', () => {
      const total = getTotalXpEarned('new-user');
      expect(total).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear all rewards', () => {
      grantReward(testUserId, { xp: 100 }, 'mission_reward', 'mission-1', 'user_mission');
      _clearAllRewards();
      expect(_getRewardItemCount()).toBe(0);
      expect(_getUserInventoryCount(testUserId)).toBe(0);
      expect(_getTransactionCount()).toBe(0);
    });
  });
});
