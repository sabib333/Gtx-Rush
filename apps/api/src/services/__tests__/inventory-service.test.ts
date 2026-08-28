import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  grantItem,
  getUserInventory,
  getUserInventoryByType,
  userOwnsItem,
  getInventoryStats,
  _clearAllInventory,
} from '../inventory-service';

describe('InventoryService', () => {
  beforeEach(() => {
    _clearAllInventory();
  });

  describe('Item Granting', () => {
    it('should grant an item to user', () => {
      const result = grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
    });

    it('should be idempotent', () => {
      const result1 = grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');
      const result2 = grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should prevent duplicate badges', () => {
      grantItem('user-1', 'badge_test', 'badge', 'achievement', 'tx-1');
      grantItem('user-1', 'badge_test', 'badge', 'achievement', 'tx-2');

      const inventory = getUserInventoryByType('user-1', 'badge');
      expect(inventory).toHaveLength(1);
    });

    it('should allow duplicate non-unique items', () => {
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'purchase', 'tx-1');
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'purchase', 'tx-2');

      const inventory = getUserInventoryByType('user-1', 'profile_frame');
      expect(inventory).toHaveLength(2);
    });
  });

  describe('Inventory Queries', () => {
    it('should get user inventory', () => {
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');
      grantItem('user-1', 'title_test', 'title', 'achievement', 'tx-2');

      const inventory = getUserInventory('user-1');
      expect(inventory).toHaveLength(2);
    });

    it('should get inventory by type', () => {
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');
      grantItem('user-1', 'frame_silver', 'profile_frame', 'purchase', 'tx-2');
      grantItem('user-1', 'title_test', 'title', 'achievement', 'tx-3');

      const frames = getUserInventoryByType('user-1', 'profile_frame');
      expect(frames).toHaveLength(2);

      const titles = getUserInventoryByType('user-1', 'title');
      expect(titles).toHaveLength(1);
    });

    it('should check if user owns item', () => {
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');

      expect(userOwnsItem('user-1', 'frame_bronze')).toBe(true);
      expect(userOwnsItem('user-1', 'frame_silver')).toBe(false);
    });
  });

  describe('Inventory Stats', () => {
    it('should get inventory stats', () => {
      grantItem('user-1', 'frame_bronze', 'profile_frame', 'level_up', 'tx-1');
      grantItem('user-1', 'frame_silver', 'profile_frame', 'purchase', 'tx-2');
      grantItem('user-1', 'title_test', 'title', 'achievement', 'tx-3');

      const stats = getInventoryStats('user-1');
      expect(stats.totalItems).toBe(3);
      expect(stats.itemsByType.profile_frame).toBe(2);
      expect(stats.itemsByType.title).toBe(1);
    });
  });
});
