/**
 * GTX Rush — Event Scoring Engine Tests
 *
 * Tests for:
 * - Score calculation
 * - Rank calculation
 * - Tie-breaking
 * - Score validation
 * - Score aggregation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateScore,
  calculateEventScoreFromMultiple,
  calculateRanks,
  getUserRank,
  getRankChange,
  validateEventScore,
  batchValidateAttempts,
  aggregateScores,
  getBestScore,
  getTotalScore,
  getAverageScore,
  _clearEventScoring,
} from '../event-scoring';
import type { Event, EventAttempt, EventParticipant, EventScoringConfig } from '@gtx-rush/types';

describe('Event Scoring Engine', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';
  const testUserId3 = 'test-user-003';

  beforeEach(() => {
    _clearEventScoring();
  });

  describe('Score Calculation', () => {
    it('should calculate event score from game score', () => {
      const config: EventScoringConfig = {
        formula: 'best_score',
        multiplier: 1.0,
        participationPoints: 10,
        personalBestBonus: 50,
        topN: 5,
        customRules: {},
      };

      const result = calculateScore(9842, config);
      expect(result.eventScore).toBe(9842);
      expect(result.validated).toBe(true);
    });

    it('should apply multiplier', () => {
      const config: EventScoringConfig = {
        formula: 'best_score',
        multiplier: 2.0,
        participationPoints: 10,
        personalBestBonus: 50,
        topN: 5,
        customRules: {},
      };

      const result = calculateScore(5000, config);
      expect(result.eventScore).toBe(10000);
    });

    it('should reject score with anti-cheat flags', () => {
      const config: EventScoringConfig = {
        formula: 'best_score',
        multiplier: 1.0,
        participationPoints: 10,
        personalBestBonus: 50,
        topN: 5,
        customRules: {},
      };

      const result = calculateScore(9842, config, ['speed_hack']);
      expect(result.validated).toBe(false);
      expect(result.eventScore).toBe(0);
    });

    it('should calculate event score from multiple scores', () => {
      const config: EventScoringConfig = {
        formula: 'total_score',
        multiplier: 1.0,
        participationPoints: 10,
        personalBestBonus: 50,
        topN: 5,
        customRules: {},
      };

      const score = calculateEventScoreFromMultiple([5000, 6000, 7000], config);
      expect(score).toBe(18000); // Sum of all scores
    });
  });

  describe('Rank Calculation', () => {
    it('should calculate ranks correctly', () => {
      const participants: EventParticipant[] = [
        { id: '1', eventId: 'e1', userId: testUserId, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 5000, eventScore: 5000, rank: null, metadata: {} },
        { id: '2', eventId: 'e1', userId: testUserId2, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 9842, eventScore: 9842, rank: null, metadata: {} },
        { id: '3', eventId: 'e1', userId: testUserId3, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 7500, eventScore: 7500, rank: null, metadata: {} },
      ];

      const ranks = calculateRanks(participants);
      expect(ranks.get(testUserId2)).toBe(1); // Highest score
      expect(ranks.get(testUserId3)).toBe(2);
      expect(ranks.get(testUserId)).toBe(3);
    });

    it('should handle tie-breaking with earliest timestamp', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);

      const participants: EventParticipant[] = [
        { id: '1', eventId: 'e1', userId: testUserId, status: 'active', joinedAt: new Date(), lastAttemptAt: now, attemptCount: 1, bestScore: 9842, eventScore: 9842, rank: null, metadata: {} },
        { id: '2', eventId: 'e1', userId: testUserId2, status: 'active', joinedAt: new Date(), lastAttemptAt: earlier, attemptCount: 1, bestScore: 9842, eventScore: 9842, rank: null, metadata: {} },
      ];

      const ranks = calculateRanks(participants, 'earliest_timestamp');
      expect(ranks.get(testUserId2)).toBe(1); // Earlier timestamp wins
      expect(ranks.get(testUserId)).toBe(2);
    });

    it('should get user rank', () => {
      const participants: EventParticipant[] = [
        { id: '1', eventId: 'e1', userId: testUserId, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 5000, eventScore: 5000, rank: null, metadata: {} },
        { id: '2', eventId: 'e1', userId: testUserId2, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 9842, eventScore: 9842, rank: null, metadata: {} },
      ];

      const rank = getUserRank(participants, testUserId2);
      expect(rank).toBe(1);
    });

    it('should calculate rank change', () => {
      const participants: EventParticipant[] = [
        { id: '1', eventId: 'e1', userId: testUserId, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 5000, eventScore: 5000, rank: null, metadata: {} },
        { id: '2', eventId: 'e1', userId: testUserId2, status: 'active', joinedAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1, bestScore: 9842, eventScore: 9842, rank: null, metadata: {} },
      ];

      // User was rank 2, now rank 1
      const change = getRankChange(participants, testUserId, 2);
      expect(change).toBe(1); // Improved by 1 position
    });
  });

  describe('Score Validation', () => {
    it('should validate a good score', () => {
      const event: Event = {
        id: 'e1',
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        status: 'active',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        rules: { maxAttempts: 10, bestScoreCounts: true, tieBreak: 'earliest_timestamp', customRules: [], attemptConstraint: 'limited' },
        scoringConfig: { formula: 'best_score', multiplier: 1.0, participationPoints: 10, personalBestBonus: 50, topN: 5, customRules: {} },
        rewardConfig: { tiers: [], participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null }, autoDistribute: true },
        eligibilityConfig: { minLevel: 1, maxLevel: 0, requiredGameId: null, minAccountAgeDays: 0, countries: [], requiredSeasonId: null, requiredTier: null },
        visibility: 'public',
        metadata: { imageUrl: null, color: null, sponsor: null, campaignId: null },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const attempt: EventAttempt = {
        id: 'a1',
        eventId: 'e1',
        userId: testUserId,
        sessionId: 's1',
        gameScore: 9842,
        eventScore: 9842,
        validationStatus: 'pending',
        attemptNumber: 1,
        isValid: true,
        antiCheatFlags: [],
        submittedAt: new Date(),
        validatedAt: null,
      };

      const result = validateEventScore(attempt, event);
      expect(result.valid).toBe(true);
      expect(result.status).toBe('validated');
    });

    it('should reject score with anti-cheat flags', () => {
      const event: Event = {
        id: 'e1',
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        status: 'active',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        rules: { maxAttempts: 10, bestScoreCounts: true, tieBreak: 'earliest_timestamp', customRules: [], attemptConstraint: 'limited' },
        scoringConfig: { formula: 'best_score', multiplier: 1.0, participationPoints: 10, personalBestBonus: 50, topN: 5, customRules: {} },
        rewardConfig: { tiers: [], participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null }, autoDistribute: true },
        eligibilityConfig: { minLevel: 1, maxLevel: 0, requiredGameId: null, minAccountAgeDays: 0, countries: [], requiredSeasonId: null, requiredTier: null },
        visibility: 'public',
        metadata: { imageUrl: null, color: null, sponsor: null, campaignId: null },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const attempt: EventAttempt = {
        id: 'a1',
        eventId: 'e1',
        userId: testUserId,
        sessionId: 's1',
        gameScore: 9842,
        eventScore: 9842,
        validationStatus: 'pending',
        attemptNumber: 1,
        isValid: true,
        antiCheatFlags: ['speed_hack'],
        submittedAt: new Date(),
        validatedAt: null,
      };

      const result = validateEventScore(attempt, event);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('held');
    });

    it('should reject negative score', () => {
      const event: Event = {
        id: 'e1',
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        status: 'active',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        rules: { maxAttempts: 10, bestScoreCounts: true, tieBreak: 'earliest_timestamp', customRules: [], attemptConstraint: 'limited' },
        scoringConfig: { formula: 'best_score', multiplier: 1.0, participationPoints: 10, personalBestBonus: 50, topN: 5, customRules: {} },
        rewardConfig: { tiers: [], participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null }, autoDistribute: true },
        eligibilityConfig: { minLevel: 1, maxLevel: 0, requiredGameId: null, minAccountAgeDays: 0, countries: [], requiredSeasonId: null, requiredTier: null },
        visibility: 'public',
        metadata: { imageUrl: null, color: null, sponsor: null, campaignId: null },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const attempt: EventAttempt = {
        id: 'a1',
        eventId: 'e1',
        userId: testUserId,
        sessionId: 's1',
        gameScore: -100,
        eventScore: -100,
        validationStatus: 'pending',
        attemptNumber: 1,
        isValid: true,
        antiCheatFlags: [],
        submittedAt: new Date(),
        validatedAt: null,
      };

      const result = validateEventScore(attempt, event);
      expect(result.valid).toBe(false);
      expect(result.status).toBe('rejected');
    });
  });

  describe('Score Aggregation', () => {
    it('should aggregate scores with total formula', () => {
      const attempts: EventAttempt[] = [
        { id: 'a1', eventId: 'e1', userId: testUserId, sessionId: 's1', gameScore: 5000, eventScore: 5000, validationStatus: 'validated', attemptNumber: 1, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
        { id: 'a2', eventId: 'e1', userId: testUserId, sessionId: 's2', gameScore: 6000, eventScore: 6000, validationStatus: 'validated', attemptNumber: 2, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
        { id: 'a3', eventId: 'e1', userId: testUserId, sessionId: 's3', gameScore: 7000, eventScore: 7000, validationStatus: 'validated', attemptNumber: 3, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
      ];

      const total = aggregateScores(attempts, 'total_score');
      expect(total).toBe(18000);
    });

    it('should get best score', () => {
      const attempts: EventAttempt[] = [
        { id: 'a1', eventId: 'e1', userId: testUserId, sessionId: 's1', gameScore: 5000, eventScore: 5000, validationStatus: 'validated', attemptNumber: 1, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
        { id: 'a2', eventId: 'e1', userId: testUserId, sessionId: 's2', gameScore: 9842, eventScore: 9842, validationStatus: 'validated', attemptNumber: 2, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
      ];

      const best = getBestScore(attempts);
      expect(best).toBe(9842);
    });

    it('should get total score', () => {
      const attempts: EventAttempt[] = [
        { id: 'a1', eventId: 'e1', userId: testUserId, sessionId: 's1', gameScore: 5000, eventScore: 5000, validationStatus: 'validated', attemptNumber: 1, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
        { id: 'a2', eventId: 'e1', userId: testUserId, sessionId: 's2', gameScore: 6000, eventScore: 6000, validationStatus: 'validated', attemptNumber: 2, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
      ];

      const total = getTotalScore(attempts);
      expect(total).toBe(11000);
    });

    it('should get average score', () => {
      const attempts: EventAttempt[] = [
        { id: 'a1', eventId: 'e1', userId: testUserId, sessionId: 's1', gameScore: 5000, eventScore: 5000, validationStatus: 'validated', attemptNumber: 1, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
        { id: 'a2', eventId: 'e1', userId: testUserId, sessionId: 's2', gameScore: 7000, eventScore: 7000, validationStatus: 'validated', attemptNumber: 2, isValid: true, antiCheatFlags: [], submittedAt: new Date(), validatedAt: new Date() },
      ];

      const average = getAverageScore(attempts);
      expect(average).toBe(6000);
    });
  });
});
