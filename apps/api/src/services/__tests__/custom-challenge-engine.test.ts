import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createChallenge,
  updateChallenge,
  publishChallenge,
  archiveChallenge,
  getChallenge,
  getCreatorChallenges,
  recordChallengePlay,
  _clearAllChallenges,
} from '../custom-challenge-engine';
import type { CreateChallengeRequest } from '@gtx-rush/types';

describe('CustomChallengeEngine', () => {
  beforeEach(() => {
    _clearAllChallenges();
  });

  describe('Challenge Creation', () => {
    it('should create a new challenge', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Can You Beat Me?',
        description: 'Try to beat my score!',
        difficulty: 'hard',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {
          reaction: {
            rounds: 10,
            timeWindow: 1500,
            targetPattern: 'random',
            difficulty: 7,
          },
        },
      };

      const result = createChallenge('creator-1', request);

      expect(result.success).toBe(true);
      expect(result.challenge).toBeDefined();
      expect(result.challenge?.title).toBe('Can You Beat Me?');
      expect(result.challenge?.gameId).toBe('reaction-rush');
      expect(result.challenge?.status).toBe('draft');
    });

    it('should reject invalid title', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'AB', // Too short
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const result = createChallenge('creator-1', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title');
    });

    it('should reject forbidden title patterns', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'OFFICIAL GTX ADMIN REWARD',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const result = createChallenge('creator-1', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden');
    });

    it('should reject invalid game config', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Test Challenge',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {
          reaction: {
            rounds: 100, // Exceeds max
            timeWindow: 1500,
            targetPattern: 'random',
            difficulty: 7,
          },
        },
      };

      const result = createChallenge('creator-1', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rounds');
    });
  });

  describe('Challenge Publishing', () => {
    it('should publish a draft challenge', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Test Challenge',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const createResult = createChallenge('creator-1', request);
      const challenge = createResult.challenge!;

      const publishResult = publishChallenge(challenge.id, 'creator-1');

      expect(publishResult.success).toBe(true);
      expect(publishResult.challenge?.status).toBe('published');
      expect(publishResult.challenge?.publishedAt).toBeDefined();
    });

    it('should not publish challenges from other creators', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Test Challenge',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const createResult = createChallenge('creator-1', request);
      const challenge = createResult.challenge!;

      const publishResult = publishChallenge(challenge.id, 'creator-2');

      expect(publishResult.success).toBe(false);
      expect(publishResult.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Challenge Stats', () => {
    it('should record plays', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Test Challenge',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const createResult = createChallenge('creator-1', request);
      const challenge = createResult.challenge!;

      recordChallengePlay(challenge.id, 'user-1', 9800, true);
      recordChallengePlay(challenge.id, 'user-2', 9200, false);

      const updated = getChallenge(challenge.id);
      expect(updated?.stats.totalPlays).toBe(2);
      expect(updated?.stats.completions).toBe(1);
      expect(updated?.stats.bestScore).toBe(9800);
    });
  });

  describe('Challenge Archiving', () => {
    it('should archive a challenge', () => {
      const request: CreateChallengeRequest = {
        gameId: 'reaction-rush',
        title: 'Test Challenge',
        difficulty: 'medium',
        rules: {
          goalType: 'beat_score',
          goalValue: 9500,
          timeLimit: null,
          roundLimit: null,
          allowedRetries: 3,
          scoringMethod: 'best',
        },
        config: {},
      };

      const createResult = createChallenge('creator-1', request);
      const challenge = createResult.challenge!;

      const archiveResult = archiveChallenge(challenge.id, 'creator-1');

      expect(archiveResult.success).toBe(true);

      const archived = getChallenge(challenge.id);
      expect(archived?.status).toBe('archived');
    });
  });
});
