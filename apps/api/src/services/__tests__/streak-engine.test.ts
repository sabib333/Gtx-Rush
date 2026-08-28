/**
 * GTX Rush — Streak Engine Tests
 *
 * Tests for:
 * - Streak creation and initialization
 * - Activity recording
 * - Streak extension
 * - Streak breaking
 * - Multiple activities per day (count as ONE)
 * - Streak milestones
 * - Streak status (active, at_risk, broken)
 * - Longest streak tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateStreak,
  recordStreakActivity,
  getStreakResponse,
  hasCompletedToday,
  getUserStreakMilestones,
  _clearAllStreaks,
  _getStreakCount,
  _setStreakForTesting,
} from '../streak-engine';

describe('Streak Engine', () => {
  const testUserId = 'test-streak-user-001';

  beforeEach(() => {
    _clearAllStreaks();
  });

  describe('Streak Initialization', () => {
    it('should create a new streak for a user', () => {
      const streak = getOrCreateStreak(testUserId);
      expect(streak).toBeDefined();
      expect(streak.userId).toBe(testUserId);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.status).toBe('active');
    });

    it('should return existing streak for a user', () => {
      const first = getOrCreateStreak(testUserId);
      const second = getOrCreateStreak(testUserId);
      expect(first.id).toBe(second.id);
    });

    it('should track total streak count', () => {
      getOrCreateStreak(testUserId);
      getOrCreateStreak('user-2');
      expect(_getStreakCount()).toBe(2);
    });
  });

  describe('Activity Recording', () => {
    it('should record first activity and start streak', () => {
      const result = recordStreakActivity(testUserId, '2025-01-15');
      expect(result.streakExtended).toBe(false); // First day doesn't extend
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(true); // New longest streak
    });

    it('should extend streak on consecutive days', () => {
      // Day 1
      recordStreakActivity(testUserId, '2025-01-15');
      // Day 2
      const result = recordStreakActivity(testUserId, '2025-01-16');

      expect(result.streakExtended).toBe(true);
      expect(result.currentStreak).toBe(2);
    });

    it('should break streak on missed day', () => {
      // Day 1
      recordStreakActivity(testUserId, '2025-01-15');
      // Day 2 - missed
      // Day 3
      const result = recordStreakActivity(testUserId, '2025-01-17');

      expect(result.streakExtended).toBe(false);
      expect(result.currentStreak).toBe(1); // Reset to 1
    });

    it('should not extend streak for multiple activities on same day', () => {
      // Day 1 - first activity
      const first = recordStreakActivity(testUserId, '2025-01-15');
      expect(first.currentStreak).toBe(1);

      // Day 1 - second activity (same day)
      const second = recordStreakActivity(testUserId, '2025-01-15');
      expect(second.streakExtended).toBe(false);
      expect(second.currentStreak).toBe(1); // Should not change
    });

    it('should extend streak after multiple activities on previous day', () => {
      // Day 1 - multiple activities
      recordStreakActivity(testUserId, '2025-01-15');
      recordStreakActivity(testUserId, '2025-01-15');

      // Day 2 - single activity
      const result = recordStreakActivity(testUserId, '2025-01-16');
      expect(result.streakExtended).toBe(true);
      expect(result.currentStreak).toBe(2);
    });
  });

  describe('Longest Streak', () => {
    it(' should track longest streak', () => {
      // Build a 3-day streak
      recordStreakActivity(testUserId, '2025-01-15');
      recordStreakActivity(testUserId, '2025-01-16');
      recordStreakActivity(testUserId, '2025-01-17');

      const streak = getOrCreateStreak(testUserId);
      expect(streak.longestStreak).toBe(3);
    });

    it('should not overwrite longest streak when current resets', () => {
      // Build a 3-day streak
      recordStreakActivity(testUserId, '2025-01-15');
      recordStreakActivity(testUserId, '2025-01-16');
      recordStreakActivity(testUserId, '2025-01-17');

      // Miss a day
      recordStreakActivity(testUserId, '2025-01-19');

      const streak = getOrCreateStreak(testUserId);
      expect(streak.longestStreak).toBe(3); // Should preserve longest
      expect(streak.currentStreak).toBe(1); // Current reset
    });
  });

  describe('Streak Milestones', () => {
    it('should earn milestone at 3 days', () => {
      recordStreakActivity(testUserId, '2025-01-15');
      recordStreakActivity(testUserId, '2025-01-16');
      const result = recordStreakActivity(testUserId, '2025-01-17');

      expect(result.milestoneEarned).toBeDefined();
      expect(result.milestoneEarned?.daysRequired).toBe(3);
    });

    it('should earn milestone at 7 days', () => {
      // Build a 7-day streak
      for (let i = 0; i < 7; i++) {
        const date = new Date('2025-01-15');
        date.setUTCDate(date.getUTCDate() + i);
        const result = recordStreakActivity(testUserId, date.toISOString().slice(0, 10));

        if (i === 6) {
          expect(result.milestoneEarned).toBeDefined();
          expect(result.milestoneEarned?.daysRequired).toBe(7);
        }
      }
    });

    it('should not duplicate milestone earnings', () => {
      // Build a 7-day streak
      for (let i = 0; i < 7; i++) {
        const date = new Date('2025-01-15');
        date.setUTCDate(date.getUTCDate() + i);
        recordStreakActivity(testUserId, date.toISOString().slice(0, 10));
      }

      // Check milestones
      const milestones = getUserStreakMilestones(testUserId);
      const sevenDayMilestones = milestones.filter((m) => m.streakDays === 7);
      expect(sevenDayMilestones.length).toBe(1);
    });
  });

  describe('Streak Response', () => {
    it('should return streak response with all fields', () => {
      const response = getStreakResponse(testUserId);
      expect(response).toBeDefined();
      expect(response.userId).toBe(testUserId);
      expect(response.currentStreak).toBe(0);
      expect(response.longestStreak).toBe(0);
      expect(response.weekActivity).toHaveLength(7);
    });

    it('should show today as completed after activity', () => {
      const today = new Date().toISOString().slice(0, 10);
      recordStreakActivity(testUserId, today);

      const response = getStreakResponse(testUserId);
      expect(response.todayCompleted).toBe(true);
    });

    it('should show next milestone', () => {
      const response = getStreakResponse(testUserId);
      expect(response.nextMilestone).toBeDefined();
      expect(response.nextMilestone?.daysRequired).toBe(3); // First milestone
    });

    it('should calculate days until next milestone', () => {
      recordStreakActivity(testUserId, '2025-01-15');

      const response = getStreakResponse(testUserId);
      expect(response.daysUntilNextMilestone).toBe(2); // 3 - 1 = 2
    });
  });

  describe('hasCompletedToday', () => {
    it('should return false when no activity today', () => {
      expect(hasCompletedToday(testUserId)).toBe(false);
    });

    it('should return true after activity today', () => {
      const today = new Date().toISOString().slice(0, 10);
      recordStreakActivity(testUserId, today);
      expect(hasCompletedToday(testUserId)).toBe(true);
    });
  });

  describe('Testing Helpers', () => {
    it('should set streak for testing', () => {
      _setStreakForTesting(testUserId, 5, 10, '2025-01-15');
      const streak = getOrCreateStreak(testUserId);
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(10);
      expect(streak.lastActiveDate).toBe('2025-01-15');
    });

    it('should clear all streaks', () => {
      getOrCreateStreak(testUserId);
      getOrCreateStreak('user-2');
      _clearAllStreaks();
      expect(_getStreakCount()).toBe(0);
    });
  });
});
