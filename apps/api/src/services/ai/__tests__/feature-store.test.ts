/**
 * GTX Rush — AI Feature Store Tests
 *
 * Covers (AI Contract §2, §16, §36, §37, §58 RECOMMENDATION):
 * - Player behavioral features from gameplay events
 * - New user / empty history handling
 * - Content quality features
 * - Text fingerprinting and similarity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordGameplayEvent,
  computePlayerFeatures,
  recordContentPlay,
  recordContentReport,
  recordContentReaction,
  computeContentFeatures,
  computeTextFingerprint,
  textSimilarity,
  _clearFeatureStore,
} from '../feature-store';

describe('AI Feature Store', () => {
  beforeEach(() => {
    _clearFeatureStore();
  });

  describe('Player Features (§2)', () => {
    it('should handle empty history / new users gracefully', () => {
      const features = computePlayerFeatures('brand-new-user');
      expect(features.gamesPlayed).toBe(0);
      expect(features.preferredGames).toHaveLength(0);
      expect(features.daysSinceLastActive).toBe(-1);
    });

    it('should aggregate gameplay behavior into non-sensitive features', () => {
      for (let i = 0; i < 5; i++) {
        recordGameplayEvent({
          userId: 'player-1',
          gameId: 'reaction-rush',
          eventType: 'game_completed',
          score: 6000,
          sessionMinutes: 8,
        });
        recordGameplayEvent({
          userId: 'player-1',
          gameId: 'tap-rush',
          eventType: 'game_completed',
          score: 3000,
          sessionMinutes: 5,
        });
      }
      recordGameplayEvent({ userId: 'player-1', gameId: 'reaction-rush', eventType: 'event_joined' });
      recordGameplayEvent({ userId: 'player-1', gameId: 'reaction-rush', eventType: 'challenge_sent' });
      recordGameplayEvent({ userId: 'player-1', gameId: 'reaction-rush', eventType: 'social_action' });

      const features = computePlayerFeatures('player-1');
      expect(features.gamesPlayed).toBe(10);
      expect(features.preferredGames[0]).toBe('reaction-rush');
      expect(features.eventParticipation).toBe(1);
      expect(features.challengeActivity).toBe(1);
      expect(features.socialActivity).toBe(1);
      expect(features.averageSessionMinutes).toBeGreaterThan(0);
      expect(features.activeDaysLast7).toBeGreaterThanOrEqual(1);
    });

    it('should never contain sensitive personal characteristics (§36)', () => {
      const features = computePlayerFeatures('player-privacy');
      const keys = Object.keys(features);
      const forbidden = ['religion', 'politics', 'health', 'orientation', 'ethnicity', 'beliefs'];
      for (const key of keys) {
        expect(forbidden.includes(key)).toBe(false);
      }
    });
  });

  describe('Content Features (§16)', () => {
    it('should compute quality signals from observations', () => {
      // 4 plays: 3 completed, 1 abandoned, 2 repeat players, 1 report, 3 reactions
      recordContentPlay('ch-1', 'p1', 'completed');
      recordContentPlay('ch-1', 'p1', 'completed'); // repeat player
      recordContentPlay('ch-1', 'p2', 'completed');
      recordContentPlay('ch-1', 'p3', 'abandoned');
      recordContentReport('ch-1');
      recordContentReaction('ch-1', true);
      recordContentReaction('ch-1', true);
      recordContentReaction('ch-1', true);

      const features = computeContentFeatures('ch-1', 'creator-1', 'fingerprint');
      expect(features.playCount).toBe(4);
      expect(features.completionRate).toBeCloseTo(0.75);
      expect(features.abandonmentRate).toBeCloseTo(0.25);
      expect(features.repeatPlayRate).toBeCloseTo(2 / 4);
      expect(features.reportCount).toBe(1);
      expect(features.positiveReactions).toBe(3);
    });

    it('should default to zeros for unplayed content', () => {
      const features = computeContentFeatures('unplayed', 'creator-9', 'fp');
      expect(features.playCount).toBe(0);
      expect(features.completionRate).toBe(0);
    });
  });

  describe('Text Fingerprinting (§20)', () => {
    it('should produce identical fingerprints for equivalent texts', () => {
      const a = computeTextFingerprint('Beat the Boss Rush!');
      const b = computeTextFingerprint('beat the boss rush');
      expect(a).toBe(b);
    });

    it('should measure similarity between related and unrelated texts', () => {
      const similar = textSimilarity(
        'Reaction Rush speed trial beat ten rounds',
        'reaction rush SPEED TRIAL - beat ten rounds fast!',
      );
      const different = textSimilarity(
        'Reaction Rush speed trial',
        'History quiz about ancient Rome',
      );
      expect(similar).toBeGreaterThan(different);
      expect(similar).toBeGreaterThan(0.6);
    });
  });
});
