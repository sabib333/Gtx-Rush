/**
 * Ranking Service — Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitScore,
  getLeaderboard,
  getUserRank,
  getAroundMe,
  setUserProfile,
  _clearAllRankings,
} from '../ranking-service';

describe('Ranking Service', () => {
  beforeEach(() => {
    _clearAllRankings();
  });

  describe('Score Submission', () => {
    it('should submit a score to global ranking', () => {
      const record = submitScore('user-1', 5000, 'global', 'score');

      expect(record).toBeDefined();
      expect(record.userId).toBe('user-1');
      expect(record.score).toBe(5000);
      expect(record.scope).toBe('global');
    });

    it('should update score if new score is higher', () => {
      submitScore('user-1', 3000, 'global', 'score');
      const updated = submitScore('user-1', 5000, 'global', 'score');

      expect(updated.score).toBe(5000);
    });

    it('should not downgrade score', () => {
      submitScore('user-1', 5000, 'global', 'score');
      const result = submitScore('user-1', 3000, 'global', 'score');

      expect(result.score).toBe(5000);
    });

    it('should submit game-specific scores', () => {
      submitScore('user-1', 5000, 'game', 'score', { gameId: 'reaction-rush' });

      const leaderboard = getLeaderboard({
        scope: 'game',
        type: 'score',
        gameId: 'reaction-rush',
      });

      expect(leaderboard.entries).toHaveLength(1);
      expect(leaderboard.entries[0]!.score).toBe(5000);
    });

    it('should submit country-specific scores', () => {
      setUserProfile({ id: 'user-1', displayName: 'Alice', avatarUrl: null, level: 5, country: 'US' });
      submitScore('user-1', 5000, 'country', 'score', { countryCode: 'US' });

      const leaderboard = getLeaderboard({
        scope: 'country',
        type: 'score',
        countryCode: 'US',
      });

      expect(leaderboard.entries).toHaveLength(1);
    });
  });

  describe('Leaderboard', () => {
    it('should rank users by score (highest first)', () => {
      submitScore('user-1', 3000, 'global', 'score');
      submitScore('user-2', 5000, 'global', 'score');
      submitScore('user-3', 4000, 'global', 'score');

      const leaderboard = getLeaderboard({ scope: 'global', type: 'score' });

      expect(leaderboard.entries).toHaveLength(3);
      expect(leaderboard.entries[0]!.userId).toBe('user-2');
      expect(leaderboard.entries[0]!.rank).toBe(1);
      expect(leaderboard.entries[1]!.userId).toBe('user-3');
      expect(leaderboard.entries[2]!.userId).toBe('user-1');
    });

    it('should break ties by submission time (earlier wins)', () => {
      submitScore('user-1', 5000, 'global', 'score');
      submitScore('user-2', 5000, 'global', 'score');

      const leaderboard = getLeaderboard({ scope: 'global', type: 'score' });

      expect(leaderboard.entries[0]!.userId).toBe('user-1');
      expect(leaderboard.entries[1]!.userId).toBe('user-2');
    });

    it('should paginate results', () => {
      for (let i = 0; i < 10; i++) {
        submitScore(`user-${i}`, 1000 + i, 'global', 'score');
      }

      const page1 = getLeaderboard({ scope: 'global', type: 'score', limit: 3 });
      expect(page1.entries).toHaveLength(3);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.nextCursor).toBeDefined();

      const page2 = getLeaderboard({
        scope: 'global',
        type: 'score',
        limit: 3,
        cursor: page1.pagination.nextCursor!,
      });
      expect(page2.entries).toHaveLength(3);
    });

    it('should return total participants', () => {
      submitScore('user-1', 5000, 'global', 'score');
      submitScore('user-2', 4000, 'global', 'score');

      const leaderboard = getLeaderboard({ scope: 'global', type: 'score' });
      expect(leaderboard.totalParticipants).toBe(2);
    });
  });

  describe('User Rank', () => {
    it('should get user rank', () => {
      submitScore('user-1', 3000, 'global', 'score');
      submitScore('user-2', 5000, 'global', 'score');
      setUserProfile({ id: 'user-2', displayName: 'Bob', avatarUrl: null, level: 10, country: 'US' });

      const rank = getUserRank('user-2', 'global', 'score');

      expect(rank).toBeDefined();
      expect(rank!.rank).toBe(1);
      expect(rank!.score).toBe(5000);
      expect(rank!.isCurrentUser).toBe(true);
    });

    it('should return null for non-ranked user', () => {
      const rank = getUserRank('user-999', 'global', 'score');
      expect(rank).toBeNull();
    });
  });

  describe('Around Me', () => {
    it('should get top 3, user position, and nearby entries', () => {
      for (let i = 0; i < 10; i++) {
        submitScore(`user-${i}`, 1000 + i * 100, 'global', 'score');
        setUserProfile({ id: `user-${i}`, displayName: `Player ${i}`, avatarUrl: null, level: i + 1, country: 'US' });
      }

      const aroundMe = getAroundMe('user-5', 'global', 'score', { contextSize: 2 });

      expect(aroundMe.top).toHaveLength(3);
      expect(aroundMe.user).toBeDefined();
      expect(aroundMe.user.isCurrentUser).toBe(true);
      expect(aroundMe.bottom.length).toBeGreaterThan(0);
      expect(aroundMe.totalParticipants).toBe(10);
    });

    it('should handle user not in ranking', () => {
      submitScore('user-1', 5000, 'global', 'score');

      const aroundMe = getAroundMe('user-999', 'global', 'score');

      expect(aroundMe.user.rank).toBe(2); // After the one ranked user
      expect(aroundMe.user.score).toBe(0);
    });
  });
});
