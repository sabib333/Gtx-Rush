/**
 * Tier System, Badge Engine, Level Service — Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateTier, _clearAllTiers } from '../tier-system';
import { evaluateBadges, getUserBadges, hasBadge, _clearAllBadges } from '../badge-engine';
import { awardXP, getCurrentLevel, getXPToNextLevel, getUserXP, _clearAllLevels } from '../level-service';
import { _clearAllRankings } from '../ranking-service';

describe('Tier System', () => {
  beforeEach(() => {
    _clearAllTiers();
  });

  it('should evaluate bronze tier for low scores', () => {
    const { tierName, division } = evaluateTier(50);
    expect(tierName).toBe('bronze');
    expect(division).toBe(1);
  });

  it('should evaluate gold tier for mid-range scores', () => {
    const { tierName, division } = evaluateTier(800);
    expect(tierName).toBe('gold');
    expect(division).toBe(2);
  });

  it('should evaluate diamond tier for high scores', () => {
    const { tierName, division } = evaluateTier(2000);
    expect(tierName).toBe('diamond');
    expect(division).toBe(1);
  });

  it('should evaluate legend tier for maximum scores', () => {
    const { tierName, division } = evaluateTier(4000);
    expect(tierName).toBe('legend');
    expect(division).toBe(1);
  });
});

describe('Badge Engine', () => {
  beforeEach(() => {
    _clearAllBadges();
  });

  it('should unlock first_rush badge on first game', () => {
    const badges = evaluateBadges({
      type: 'first_game',
      userId: 'user-1',
      value: 1,
    });

    expect(badges).toHaveLength(1);
    expect(badges[0]!.slug).toBe('first_rush');
    expect(hasBadge('user-1', 'first_rush')).toBe(true);
  });

  it('should not unlock badge twice', () => {
    evaluateBadges({ type: 'first_game', userId: 'user-1', value: 1 });
    const second = evaluateBadges({ type: 'first_game', userId: 'user-1', value: 1 });

    expect(second).toHaveLength(0);
  });

  it('should unlock score-based badge when threshold met', () => {
    const badges = evaluateBadges({
      type: 'score_reached',
      userId: 'user-1',
      value: 8000,
      gameId: 'reaction-rush',
    });

    expect(badges).toHaveLength(1);
    expect(badges[0]!.slug).toBe('speed_demon');
  });

  it('should not unlock score badge below threshold', () => {
    const badges = evaluateBadges({
      type: 'score_reached',
      userId: 'user-1',
      value: 5000,
      gameId: 'reaction-rush',
    });

    expect(badges).toHaveLength(0);
  });

  it('should get all badges for a user', () => {
    evaluateBadges({ type: 'first_game', userId: 'user-1', value: 1 });
    evaluateBadges({ type: 'level_reached', userId: 'user-1', value: 5 });

    const badges = getUserBadges('user-1');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Level Service', () => {
  beforeEach(() => {
    _clearAllLevels();
    _clearAllRankings();
  });

  it('should award XP', () => {
    const result = awardXP('user-1', 100, 'game_play');

    expect(result.xpAwarded).toBe(100);
    expect(result.newTotal).toBe(100);
    expect(result.level).toBe(1);
    expect(result.levelUp).toBe(false);
  });

  it('should detect level up', () => {
    // Level 2 requires 100 XP
    const result = awardXP('user-1', 150, 'game_play');

    expect(result.newTotal).toBe(150);
    expect(result.level).toBe(2);
    expect(result.levelUp).toBe(true);
  });

  it('should calculate current level from XP', () => {
    expect(getCurrentLevel(0)).toBe(1);
    expect(getCurrentLevel(100)).toBe(2);
    expect(getCurrentLevel(300)).toBe(3);
    expect(getCurrentLevel(1000)).toBe(5);
    expect(getCurrentLevel(5500)).toBe(10);
  });

  it('should calculate XP to next level', () => {
    const info = getXPToNextLevel(150);

    expect(info.currentLevel).toBe(2);
    expect(info.nextLevel).toBeDefined();
    expect(info.nextLevel!.level).toBe(3);
    expect(info.progress).toBeGreaterThan(0);
    expect(info.progress).toBeLessThanOrEqual(100);
  });

  it('should enforce daily limits', () => {
    // game_play has daily limit of 100
    for (let i = 0; i < 15; i++) {
      awardXP('user-1', 10, 'game_play');
    }

    const total = getUserXP('user-1');
    expect(total).toBe(100); // Capped at daily limit
  });

  it('should get XP transaction history', () => {
    awardXP('user-1', 100, 'game_play');
    awardXP('user-1', 50, 'daily_challenge');

    const history = getUserXP('user-1');
    expect(history.length).toBeGreaterThanOrEqual(2);
  });
});
