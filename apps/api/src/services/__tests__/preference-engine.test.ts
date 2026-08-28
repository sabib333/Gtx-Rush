import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordGamePlay,
  getPlayerProfile,
  getPreferredGame,
  getPlayerSkillBand,
  getGamePreferences,
  isNewUser,
  _clearUserData,
  _clearAllData,
} from '../preference-engine';

describe('PreferenceEngine', () => {
  beforeEach(() => {
    _clearAllData();
  });

  describe('Game Preference Tracking', () => {
    it('should track game play events', () => {
      const profile = recordGamePlay(
        'user-1',
        'reaction-rush',
        9842,
        true,
        120,
        true,
        false,
        false,
      );

      expect(profile).toBeDefined();
      expect(profile.userId).toBe('user-1');
      expect(profile.gamePreferences).toHaveLength(1);
      expect(profile.gamePreferences[0].gameId).toBe('reaction-rush');
      expect(profile.gamePreferences[0].gamesPlayed).toBe(1);
    });

    it('should update existing game preference', () => {
      recordGamePlay('user-1', 'reaction-rush', 9842, true, 120, true, false, false);
      const profile = recordGamePlay('user-1', 'reaction-rush', 10200, true, 110, true, false, false);

      expect(profile.gamePreferences).toHaveLength(1);
      expect(profile.gamePreferences[0].gamesPlayed).toBe(2);
      expect(profile.gamePreferences[0].bestScore).toBe(10200);
    });

    it('should calculate preference scores', () => {
      // Play multiple games to establish preference
      for (let i = 0; i < 10; i++) {
        recordGamePlay('user-1', 'reaction-rush', 9000 + i * 100, true, 120, i === 9, false, false);
      }
      for (let i = 0; i < 3; i++) {
        recordGamePlay('user-1', 'tap-rush', 8000 + i * 100, true, 90, false, false, false);
      }

      const profile = getPlayerProfile('user-1');
      const reactionPref = profile.gamePreferences.find((p) => p.gameId === 'reaction-rush');
      const tapPref = profile.gamePreferences.find((p) => p.gameId === 'tap-rush');

      expect(reactionPref).toBeDefined();
      expect(tapPref).toBeDefined();
      expect(reactionPref!.preferenceScore).toBeGreaterThan(tapPref!.preferenceScore);
    });

    it('should determine primary and secondary games', () => {
      for (let i = 0; i < 10; i++) {
        recordGamePlay('user-1', 'reaction-rush', 9000, true, 120, false, false, false);
      }
      for (let i = 0; i < 5; i++) {
        recordGamePlay('user-1', 'tap-rush', 8000, true, 90, false, false, false);
      }

      const profile = getPlayerProfile('user-1');
      expect(profile.primaryGame).toBe('reaction-rush');
      expect(profile.secondaryGame).toBe('tap-rush');
    });

    it('should get preferred game', () => {
      for (let i = 0; i < 10; i++) {
        recordGamePlay('user-1', 'quiz-rush', 7000, true, 180, false, false, false);
      }

      const preferredGame = getPreferredGame('user-1');
      expect(preferredGame).toBe('quiz-rush');
    });
  });

  describe('Skill Estimation', () => {
    it('should track skill estimates per game', () => {
      recordGamePlay('user-1', 'reaction-rush', 9842, true, 120, true, false, false);

      const skillBand = getPlayerSkillBand('user-1', 'reaction-rush');
      expect(skillBand).toBeDefined();
      expect(['beginner', 'intermediate', 'advanced', 'expert', 'elite']).toContain(skillBand);
    });

    it('should update skill estimates', () => {
      recordGamePlay('user-1', 'reaction-rush', 9842, true, 120, true, false, false);
      recordGamePlay('user-1', 'reaction-rush', 10200, true, 110, true, false, false);

      const profile = getPlayerProfile('user-1');
      const skill = profile.skillEstimates.find((s) => s.gameId === 'reaction-rush');

      expect(skill).toBeDefined();
      expect(skill!.gamesPlayed).toBe(2);
    });
  });

  describe('User Detection', () => {
    it('should detect new users', () => {
      expect(isNewUser('user-1')).toBe(true);
    });

    it('should detect returning users', () => {
      for (let i = 0; i < 5; i++) {
        recordGamePlay('user-1', 'reaction-rush', 9000, true, 120, false, false, false);
      }

      expect(isNewUser('user-1')).toBe(false);
    });
  });

  describe('Game Preferences', () => {
    it('should return game preferences sorted by score', () => {
      for (let i = 0; i < 10; i++) {
        recordGamePlay('user-1', 'reaction-rush', 9000, true, 120, false, false, false);
      }
      for (let i = 0; i < 5; i++) {
        recordGamePlay('user-1', 'tap-rush', 8000, true, 90, false, false, false);
      }

      const preferences = getGamePreferences('user-1');
      expect(preferences).toHaveLength(2);
      expect(preferences[0].gameId).toBe('reaction-rush');
      expect(preferences[1].gameId).toBe('tap-rush');
    });
  });
});
