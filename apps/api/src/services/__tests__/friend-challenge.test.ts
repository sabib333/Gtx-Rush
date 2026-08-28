/**
 * Friend Challenge Engine — Tests
 *
 * Tests:
 * - Challenge creation
 * - Deep link generation
 * - Challenge acceptance
 * - Score submission and completion
 * - Challenge expiration
 * - Rematch (creates new entity)
 * - Anti-abuse: self-challenge, rate limiting, spam detection
 * - Share content generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFriendChallenge,
  getFriendChallengeByToken,
  getFriendChallengeById,
  acceptFriendChallenge,
  submitFriendChallengeScore,
  createRematch,
  generateShareContent,
  generateDeepLink,
  getUserFriendChallengeHistory,
  getUserFriendChallenges,
  calculateFriendChallengeXP,
  expireStaleChallenges,
  _clearAllFriendChallenges,
} from '../friend-challenge';

describe('Challenge Engine — Friend Challenge', () => {
  beforeEach(() => {
    _clearAllFriendChallenges();
  });

  describe('Challenge Creation', () => {
    it('should create a friend challenge with valid parameters', () => {
      const result = createFriendChallenge('user-1', 'reaction-rush');

      expect(result.success).toBe(true);
      expect(result.challenge).toBeDefined();
      expect(result.challenge!.challengerId).toBe('user-1');
      expect(result.challenge!.gameId).toBe('reaction-rush');
      expect(result.challenge!.status).toBe('pending');
      expect(result.challenge!.type).toBe('score_target');
    });

    it('should generate a unique challenge token', () => {
      const result1 = createFriendChallenge('user-1', 'reaction-rush');
      const result2 = createFriendChallenge('user-2', 'tap-rush');

      expect(result1.challenge!.challengeToken).not.toBe(result2.challenge!.challengeToken);
    });

    it('should set expiration 24 hours from creation', () => {
      const result = createFriendChallenge('user-1', 'reaction-rush');

      const now = Date.now();
      const expiresAt = result.challenge!.expiresAt.getTime();

      expect(expiresAt).toBeGreaterThan(now);
      expect(expiresAt).toBeLessThanOrEqual(now + 25 * 60 * 60 * 1000); // ~24h
    });

    it('should reject invalid game ID', () => {
      const result = createFriendChallenge('user-1', 'invalid-game');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_GAME');
    });

    it('should accept all three valid games', () => {
      const games = ['reaction-rush', 'tap-rush', 'quiz-rush'];

      for (const game of games) {
        _clearAllFriendChallenges();
        const result = createFriendChallenge('user-1', game);
        expect(result.success).toBe(true);
        expect(result.challenge!.gameId).toBe(game);
      }
    });
  });

  describe('Challenge Lookup', () => {
    it('should find challenge by token', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const found = getFriendChallengeByToken(created.challenge!.challengeToken);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.challenge!.id);
    });

    it('should find challenge by ID', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const found = getFriendChallengeById(created.challenge!.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.challenge!.id);
    });

    it('should return null for non-existent token', () => {
      const found = getFriendChallengeByToken('non-existent-token');

      expect(found).toBeNull();
    });

    it('should return null for non-existent ID', () => {
      const found = getFriendChallengeById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('Challenge Acceptance', () => {
    it('should accept a pending challenge', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const result = acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      expect(result.success).toBe(true);
      expect(result.challenge!.status).toBe('accepted');
      expect(result.challenge!.opponentId).toBe('user-2');
    });

    it('should prevent self-challenge', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const result = acceptFriendChallenge(created.challenge!.challengeToken, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SELF_CHALLENGE_NOT_ALLOWED');
    });

    it('should reject acceptance of non-existent challenge', () => {
      const result = acceptFriendChallenge('non-existent-token', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should reject acceptance of already-accepted challenge', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      const result = acceptFriendChallenge(created.challenge!.challengeToken, 'user-3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_STATUS');
    });
  });

  describe('Score Submission & Completion', () => {
    it('should accept score from challenger', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const result = submitFriendChallengeScore(
        created.challenge!.id,
        'user-1',
        5000,
        'session-1',
      );

      expect(result.success).toBe(true);
      expect(result.challenge!.challengerScore).toBe(5000);
      expect(result.completed).toBe(false); // Not completed yet
    });

    it('should accept score from opponent', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      const result = submitFriendChallengeScore(
        created.challenge!.id,
        'user-2',
        4000,
        'session-2',
      );

      expect(result.success).toBe(true);
      expect(result.challenge!.opponentScore).toBe(4000);
    });

    it('should complete when both players submit scores', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      submitFriendChallengeScore(created.challenge!.id, 'user-1', 5000, 'session-1');
      const result = submitFriendChallengeScore(created.challenge!.id, 'user-2', 4000, 'session-2');

      expect(result.completed).toBe(true);
      expect(result.winner).toBe('challenger');
      expect(result.challenge!.status).toBe('completed');
      expect(result.challenge!.completedAt).toBeDefined();
    });

    it('should determine winner correctly', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      // Challenger wins
      submitFriendChallengeScore(created.challenge!.id, 'user-1', 5000, 's1');
      const result = submitFriendChallengeScore(created.challenge!.id, 'user-2', 4000, 's2');

      expect(result.winner).toBe('challenger');
    });

    it('should handle tie', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      submitFriendChallengeScore(created.challenge!.id, 'user-1', 5000, 's1');
      const result = submitFriendChallengeScore(created.challenge!.id, 'user-2', 5000, 's2');

      expect(result.winner).toBe('tie');
    });

    it('should reject score from non-participant', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');

      const result = submitFriendChallengeScore(created.challenge!.id, 'user-999', 5000, 's1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_PARTICIPANT');
    });

    it('should prevent duplicate completion', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      submitFriendChallengeScore(created.challenge!.id, 'user-1', 5000, 's1');
      submitFriendChallengeScore(created.challenge!.id, 'user-2', 4000, 's2');

      // Try to submit again
      const result = submitFriendChallengeScore(created.challenge!.id, 'user-1', 6000, 's3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_COMPLETED');
    });
  });

  describe('Challenge Expiration', () => {
    it('should expire stale challenges', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');

      // Manually set expiration to past
      const challenge = getFriendChallengeById(created.challenge!.id);
      if (challenge) {
        challenge.expiresAt = new Date(Date.now() - 1000);
      }

      const expiredCount = expireStaleChallenges();

      expect(expiredCount).toBe(1);

      const updated = getFriendChallengeById(created.challenge!.id);
      expect(updated!.status).toBe('expired');
    });

    it('should not expire non-stale challenges', () => {
      createFriendChallenge('user-1', 'reaction-rush');

      const expiredCount = expireStaleChallenges();

      expect(expiredCount).toBe(0);
    });
  });

  describe('Rematch', () => {
    it('should create a rematch with swapped roles', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      const rematch = createRematch(created.challenge!.id, 'user-1');

      expect(rematch.success).toBe(true);
      expect(rematch.challenge).toBeDefined();
      expect(rematch.challenge!.challengerId).toBe('user-1');
      expect(rematch.challenge!.gameId).toBe('reaction-rush');
      expect(rematch.challenge!.id).not.toBe(created.challenge!.id); // New entity
    });

    it('should prevent non-participants from rematching', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');

      const rematch = createRematch(created.challenge!.id, 'user-999');

      expect(rematch.success).toBe(false);
      expect(rematch.error).toBe('NOT_PARTICIPANT');
    });

    it('should preserve original challenge', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      acceptFriendChallenge(created.challenge!.challengeToken, 'user-2');

      createRematch(created.challenge!.id, 'user-1');

      // Original should be unchanged
      const original = getFriendChallengeById(created.challenge!.id);
      expect(original).toBeDefined();
      expect(original!.challengerId).toBe('user-1');
    });
  });

  describe('Share Content', () => {
    it('should generate share content for win', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const content = generateShareContent(created.challenge!, 5000, 'won');

      expect(content).toContain('GTX RUSH');
      expect(content).toContain('5,000');
      expect(content).toContain('🏆');
      expect(content).toContain('PLAY. COMPETE. RISE.');
    });

    it('should generate share content for loss', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const content = generateShareContent(created.challenge!, 3000, 'lost');

      expect(content).toContain('💪');
      expect(content).toContain('Can you do better?');
    });

    it('should generate share content for tie', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const content = generateShareContent(created.challenge!, 5000, 'tie');

      expect(content).toContain('🤝');
    });
  });

  describe('Deep Link', () => {
    it('should generate a Telegram deep link', () => {
      const link = generateDeepLink('abc123def456');

      expect(link).toBe('startapp=chal_abc123def456');
    });
  });

  describe('XP Calculation', () => {
    it('should award more XP for winning', () => {
      const xp = calculateFriendChallengeXP('challenger', true);
      expect(xp).toBe(30);
    });

    it('should award less XP for losing', () => {
      const xp = calculateFriendChallengeXP('opponent', true);
      expect(xp).toBe(10);
    });

    it('should award tie XP', () => {
      const xp = calculateFriendChallengeXP('tie', true);
      expect(xp).toBe(20);
    });
  });

  describe('User Challenge Queries', () => {
    it('should get all challenges for a user', () => {
      createFriendChallenge('user-1', 'reaction-rush');
      createFriendChallenge('user-2', 'tap-rush');

      const user1Challenges = getUserFriendChallenges('user-1');
      expect(user1Challenges).toHaveLength(1);

      const user2Challenges = getUserFriendChallenges('user-2');
      expect(user2Challenges).toHaveLength(1);
    });

    it('should get challenge history for a user', () => {
      const created = createFriendChallenge('user-1', 'reaction-rush');
      const challenge = getFriendChallengeById(created.challenge!.id);

      if (challenge) {
        // Simulate a completed challenge for history
        challenge.challengerScore = 5000;
        challenge.opponentScore = 4000;
        challenge.status = 'completed';
        challenge.completedAt = new Date();
      }

      const history = getUserFriendChallengeHistory('user-1');
      expect(history.entries).toHaveLength(1);
    });
  });
});
