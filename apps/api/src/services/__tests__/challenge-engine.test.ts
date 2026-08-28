/**
 * Daily Challenge Engine — Tests
 *
 * Tests:
 * - Daily challenge creation and lifecycle
 * - Attempt validation and tracking
 * - Best-score logic across multiple attempts
 * - Daily leaderboard with tie-breaking
 * - XP and streak reward integration
 * - Expired challenge handling
 * - Edge cases and security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateDailyChallenge,
  getCurrentDailyChallenge,
  getDailyChallengeById,
  validateDailyChallengeAttempt,
  recordChallengeAttempt,
  getUserBestScore,
  getUserAttemptCount,
  getDailyLeaderboard,
  awardDailyChallengeRewards,
  buildDailyChallengeResult,
  recordDailyChallengeHistory,
  getUserChallengeHistory,
  _clearAllChallenges,
} from '../challenge-engine';

describe('Challenge Engine — Daily Challenge', () => {
  beforeEach(() => {
    _clearAllChallenges();
  });

  describe('Challenge Creation', () => {
    it('should create a daily challenge for today', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      expect(challenge).toBeDefined();
      expect(challenge.gameId).toBe('reaction-rush');
      expect(challenge.mode).toBe('daily_rush');
      expect(challenge.status).toBe('active');
      expect(challenge.maxAttempts).toBe(3);
      expect(challenge.rewardXp).toBe(50);
    });

    it('should return existing challenge if one already exists for today', () => {
      const challenge1 = getOrCreateDailyChallenge('reaction-rush', 'system');
      const challenge2 = getOrCreateDailyChallenge('tap-rush', 'system');

      expect(challenge1.id).toBe(challenge2.id);
      // Should not change the game if already created
      expect(challenge2.gameId).toBe('reaction-rush');
    });

    it('should set proper UTC date boundaries', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      expect(challenge.startsAt).toBeInstanceOf(Date);
      expect(challenge.endsAt).toBeInstanceOf(Date);
      expect(challenge.endsAt.getTime()).toBeGreaterThan(challenge.startsAt.getTime());

      // Should be approximately 24 hours apart
      const duration = challenge.endsAt.getTime() - challenge.startsAt.getTime();
      expect(duration).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
      expect(duration).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('should set server-authoritative configuration', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      expect(challenge.configuration).toBeDefined();
      expect(challenge.rules).toBeDefined();
      expect(challenge.rules.serverAuthoritative).toBe(true);
      expect(challenge.rewardConfiguration).toBeDefined();
      expect(challenge.rewardConfiguration.xp).toBe(50);
    });
  });

  describe('Challenge Lifecycle', () => {
    it('should return current active challenge', () => {
      getOrCreateDailyChallenge('reaction-rush', 'system');
      const current = getCurrentDailyChallenge();

      expect(current).toBeDefined();
      expect(current!.status).toBe('active');
    });

    it('should return null if no challenge exists', () => {
      _clearAllChallenges();
      const current = getCurrentDailyChallenge();

      expect(current).toBeNull();
    });

    it('should get challenge by ID', () => {
      const created = getOrCreateDailyChallenge('reaction-rush', 'system');
      const retrieved = getDailyChallengeById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return null for non-existent challenge ID', () => {
      const retrieved = getDailyChallengeById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('Attempt Validation', () => {
    it('should allow valid attempt for active challenge', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const validation = validateDailyChallengeAttempt(challenge.id, 'user-1');

      expect(validation.valid).toBe(true);
      expect(validation.attemptNumber).toBe(1);
      expect(validation.maxAttempts).toBe(3);
    });

    it('should reject attempt for non-existent challenge', () => {
      const validation = validateDailyChallengeAttempt('non-existent', 'user-1');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should enforce attempt limits', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      // Use all attempts
      for (let i = 0; i < 3; i++) {
        recordChallengeAttempt(challenge.id, 'user-1', `session-${i}`, 1000, null);
      }

      // Should reject 4th attempt
      const validation = validateDailyChallengeAttempt(challenge.id, 'user-1');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('MAX_ATTEMPTS_REACHED');
      expect(validation.attemptNumber).toBe(3);
      expect(validation.maxAttempts).toBe(3);
    });

    it('should track attempt numbers correctly', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const v1 = validateDailyChallengeAttempt(challenge.id, 'user-1');
      expect(v1.attemptNumber).toBe(1);

      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 1000, null);

      const v2 = validateDailyChallengeAttempt(challenge.id, 'user-1');
      expect(v2.attemptNumber).toBe(2);
    });

    it('should track attempts independently per user', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      // User 1 uses all attempts
      for (let i = 0; i < 3; i++) {
        recordChallengeAttempt(challenge.id, 'user-1', `session-${i}`, 1000, null);
      }

      // User 2 should still have attempts
      const validation = validateDailyChallengeAttempt(challenge.id, 'user-2');
      expect(validation.valid).toBe(true);
      expect(validation.attemptNumber).toBe(1);
    });
  });

  describe('Best Score Logic', () => {
    it('should return 0 for user with no attempts', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');
      const bestScore = getUserBestScore(challenge.id, 'user-1');

      expect(bestScore).toBe(0);
    });

    it('should return the score for single attempt', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');
      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 5000, null);

      const bestScore = getUserBestScore(challenge.id, 'user-1');
      expect(bestScore).toBe(5000);
    });

    it('should return the best score across multiple attempts', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 3000, null);
      recordChallengeAttempt(challenge.id, 'user-1', 'session-2', 5000, null);
      recordChallengeAttempt(challenge.id, 'user-1', 'session-3', 4000, null);

      const bestScore = getUserBestScore(challenge.id, 'user-1');
      expect(bestScore).toBe(5000);
    });

    it('should only count valid attempts', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 3000, null, true);
      recordChallengeAttempt(challenge.id, 'user-1', 'session-2', 5000, null, false); // Invalid
      recordChallengeAttempt(challenge.id, 'user-1', 'session-3', 4000, null, true);

      const bestScore = getUserBestScore(challenge.id, 'user-1');
      expect(bestScore).toBe(4000); // Only valid scores counted
    });

    it('should track attempt count correctly', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      expect(getUserAttemptCount(challenge.id, 'user-1')).toBe(0);

      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 3000, null);
      expect(getUserAttemptCount(challenge.id, 'user-1')).toBe(1);

      recordChallengeAttempt(challenge.id, 'user-1', 'session-2', 5000, null);
      expect(getUserAttemptCount(challenge.id, 'user-1')).toBe(2);
    });
  });

  describe('Daily Leaderboard', () => {
    it('should return empty leaderboard for challenge with no participants', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');
      const leaderboard = getDailyLeaderboard(challenge.id);

      expect(leaderboard.entries).toHaveLength(0);
      expect(leaderboard.totalParticipants).toBe(0);
    });

    it('should rank users by score (highest first)', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 's1', 3000, null);
      recordChallengeAttempt(challenge.id, 'user-2', 's2', 5000, null);
      recordChallengeAttempt(challenge.id, 'user-3', 's3', 4000, null);

      const leaderboard = getDailyLeaderboard(challenge.id);

      expect(leaderboard.entries).toHaveLength(3);
      expect(leaderboard.entries[0]!.userId).toBe('user-2');
      expect(leaderboard.entries[0]!.score).toBe(5000);
      expect(leaderboard.entries[0]!.rank).toBe(1);
      expect(leaderboard.entries[1]!.userId).toBe('user-3');
      expect(leaderboard.entries[1]!.rank).toBe(2);
      expect(leaderboard.entries[2]!.userId).toBe('user-1');
      expect(leaderboard.entries[2]!.rank).toBe(3);
    });

    it('should break ties by completion time (faster wins)', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 's1', 5000, 10000);
      recordChallengeAttempt(challenge.id, 'user-2', 's2', 5000, 8000); // Faster

      const leaderboard = getDailyLeaderboard(challenge.id);

      expect(leaderboard.entries[0]!.userId).toBe('user-2');
      expect(leaderboard.entries[0]!.rank).toBe(1);
      expect(leaderboard.entries[1]!.userId).toBe('user-1');
      expect(leaderboard.entries[1]!.rank).toBe(2);
    });

    it('should break ties by submission time (earlier wins)', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      // Same score, same completion time, different submission times
      recordChallengeAttempt(challenge.id, 'user-1', 's1', 5000, 10000);
      recordChallengeAttempt(challenge.id, 'user-2', 's2', 5000, 10000);

      const leaderboard = getDailyLeaderboard(challenge.id);

      // user-1 submitted first, should be ranked higher
      expect(leaderboard.entries[0]!.userId).toBe('user-1');
      expect(leaderboard.entries[0]!.rank).toBe(1);
      expect(leaderboard.entries[1]!.userId).toBe('user-2');
      expect(leaderboard.entries[1]!.rank).toBe(2);
    });

    it('should show current user rank', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 's1', 3000, null);
      recordChallengeAttempt(challenge.id, 'user-2', 's2', 5000, null);
      recordChallengeAttempt(challenge.id, 'user-3', 's3', 4000, null);

      const leaderboard = getDailyLeaderboard(challenge.id, { currentUserId: 'user-2' });

      expect(leaderboard.userRank).toBeDefined();
      expect(leaderboard.userRank!.userId).toBe('user-2');
      expect(leaderboard.userRank!.rank).toBe(1);
      expect(leaderboard.userRank!.isCurrentUser).toBe(true);
    });

    it('should show placeholder rank for non-participating user', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 's1', 3000, null);

      const leaderboard = getDailyLeaderboard(challenge.id, { currentUserId: 'user-999' });

      expect(leaderboard.userRank).toBeDefined();
      expect(leaderboard.userRank!.userId).toBe('user-999');
      expect(leaderboard.userRank!.isCurrentUser).toBe(true);
    });
  });

  describe('Rewards & Streak', () => {
    it('should award XP for daily challenge completion', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const rewards = awardDailyChallengeRewards(challenge.id, 'user-1', false, false);

      expect(rewards.xpAwarded).toBeGreaterThan(0);
      expect(rewards.totalXp).toBe(rewards.xpAwarded);
    });

    it('should award personal best bonus', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const rewards = awardDailyChallengeRewards(challenge.id, 'user-1', true, false);

      expect(rewards.xpAwarded).toBeGreaterThan(50); // Base + PB bonus
    });

    it('should award streak contribution', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const rewards = awardDailyChallengeRewards(challenge.id, 'user-1', false, false);

      expect(rewards.streakContribution).toBe(true);
    });

    it('should not give streak contribution if already contributed today', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      // First award
      awardDailyChallengeRewards(challenge.id, 'user-1', false, false);

      // Second award (idempotent)
      const rewards = awardDailyChallengeRewards(challenge.id, 'user-1', false, false);

      expect(rewards.xpAwarded).toBe(0); // No duplicate rewards
      expect(rewards.streakContribution).toBe(false);
    });

    it('should not award duplicate rewards', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const rewards1 = awardDailyChallengeRewards(challenge.id, 'user-1', true, false);
      const rewards2 = awardDailyChallengeRewards(challenge.id, 'user-1', true, false);

      expect(rewards1.xpAwarded).toBeGreaterThan(0);
      expect(rewards2.xpAwarded).toBe(0); // Duplicate prevention
    });
  });

  describe('Challenge History', () => {
    it('should record daily challenge history', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      const entry = recordDailyChallengeHistory(
        'user-1',
        challenge.id,
        'reaction-rush',
        5000,
        1,
        50,
      );

      expect(entry).toBeDefined();
      expect(entry.userId).toBe('user-1');
      expect(entry.challengeType).toBe('daily_rush');
      expect(entry.score).toBe(5000);
      expect(entry.xpAwarded).toBe(50);
    });

    it('should retrieve user challenge history', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordDailyChallengeHistory('user-1', challenge.id, 'reaction-rush', 5000, 1, 50);
      recordDailyChallengeHistory('user-1', challenge.id, 'tap-rush', 3000, 2, 30);

      const history = getUserChallengeHistory('user-1');

      expect(history.entries).toHaveLength(2);
      // Newest first
      expect(history.entries[0]!.challengeType).toBe('daily_rush');
    });

    it('should paginate history', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      for (let i = 0; i < 5; i++) {
        recordDailyChallengeHistory('user-1', challenge.id, 'reaction-rush', 5000 + i, i + 1, 50);
      }

      const page1 = getUserChallengeHistory('user-1', { limit: 2 });
      expect(page1.entries).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = getUserChallengeHistory('user-1', { limit: 2, cursor: page1.nextCursor! });
      expect(page2.entries).toHaveLength(2);
      expect(page2.hasMore).toBe(true);
    });
  });

  describe('Result Building', () => {
    it('should build daily challenge result', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');
      recordChallengeAttempt(challenge.id, 'user-1', 'session-1', 5000, null);

      const result = buildDailyChallengeResult(challenge.id, 'user-1', 5000, 50);

      expect(result).toBeDefined();
      expect(result!.score).toBe(5000);
      expect(result!.bestScore).toBe(5000);
      expect(result!.xpAwarded).toBe(50);
      expect(result!.maxAttempts).toBe(3);
    });

    it('should return null for non-existent challenge', () => {
      const result = buildDailyChallengeResult('non-existent', 'user-1', 5000, 50);

      expect(result).toBeNull();
    });
  });

  describe('Security Edge Cases', () => {
    it('should use server-side attempt tracking (not client-submitted)', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      // User tries to claim they're on attempt 1 when they've used all 3
      for (let i = 0; i < 3; i++) {
        recordChallengeAttempt(challenge.id, 'user-1', `session-${i}`, 1000, null);
      }

      // Server should reject based on actual count
      const validation = validateDailyChallengeAttempt(challenge.id, 'user-1');
      expect(validation.valid).toBe(false);
    });

    it('should prevent cross-user best score contamination', () => {
      const challenge = getOrCreateDailyChallenge('reaction-rush', 'system');

      recordChallengeAttempt(challenge.id, 'user-1', 's1', 5000, null);
      recordChallengeAttempt(challenge.id, 'user-2', 's2', 3000, null);

      expect(getUserBestScore(challenge.id, 'user-1')).toBe(5000);
      expect(getUserBestScore(challenge.id, 'user-2')).toBe(3000);
    });
  });
});
