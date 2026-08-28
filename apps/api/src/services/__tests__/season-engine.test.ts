/**
 * Season Engine — Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSeason,
  getActiveSeason,
  getSeasonById,
  getAllSeasons,
  startSeason,
  endSeason,
  archiveSeason,
  calculateSeasonScore,
  updateSeasonRanking,
  getSeasonRankings,
  distributeSeasonReward,
  _clearAllSeasons,
} from '../season-engine';
import { _clearAllRankings } from '../ranking-service';

describe('Season Engine', () => {
  beforeEach(() => {
    _clearAllSeasons();
    _clearAllRankings();
  });

  describe('Season Lifecycle', () => {
    it('should create a season as UPCOMING', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      expect(season).toBeDefined();
      expect(season.number).toBe(1);
      expect(season.name).toBe('Rise');
      expect(season.status).toBe('upcoming');
    });

    it('should start a season (UPCOMING → ACTIVE)', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      const started = startSeason(season.id);
      expect(started).toBe(true);

      const active = getActiveSeason();
      expect(active).toBeDefined();
      expect(active!.status).toBe('active');
    });

    it('should end a season (ACTIVE → ENDED)', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));
      startSeason(season.id);

      const ended = endSeason(season.id);
      expect(ended).toBe(true);

      const active = getActiveSeason();
      expect(active).toBeNull();

      const endedSeason = getSeasonById(season.id);
      expect(endedSeason!.status).toBe('ended');
    });

    it('should archive a season (ENDED → ARCHIVED)', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));
      startSeason(season.id);
      endSeason(season.id);

      const archived = archiveSeason(season.id);
      expect(archived).toBe(true);

      const archivedSeason = getSeasonById(season.id);
      expect(archivedSeason!.status).toBe('archived');
    });

    it('should only have one active season at a time', () => {
      const s1 = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));
      const s2 = createSeason(2, 'Clash', new Date('2026-02-01'), new Date('2026-03-01'));

      startSeason(s1.id);
      startSeason(s2.id);

      const active = getActiveSeason();
      expect(active!.id).toBe(s2.id);
      expect(active!.number).toBe(2);
    });

    it('should return all seasons sorted by number', () => {
      createSeason(2, 'Clash', new Date('2026-02-01'), new Date('2026-03-01'));
      createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      const all = getAllSeasons();
      expect(all).toHaveLength(2);
      expect(all[0]!.number).toBe(2);
      expect(all[1]!.number).toBe(1);
    });
  });

  describe('Season Scoring', () => {
    it('should calculate season score from breakdown', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      const score = calculateSeasonScore('user-1', season.id, {
        bestScores: 15000,
        challengeWins: 10,
        dailyParticipation: 20,
        xpEarned: 5000,
      });

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1000);
    });

    it('should return 0 for non-existent season', () => {
      const score = calculateSeasonScore('user-1', 'non-existent', {
        bestScores: 15000,
        challengeWins: 10,
        dailyParticipation: 20,
        xpEarned: 5000,
      });

      expect(score).toBe(0);
    });
  });

  describe('Season Rankings', () => {
    it('should update and track season rankings', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      updateSeasonRanking('user-1', season.id, {
        bestScores: 15000,
        challengeWins: 10,
        dailyParticipation: 20,
        xpEarned: 5000,
      });

      const ranking = getSeasonRanking('user-1', season.id);
      expect(ranking).toBeDefined();
      expect(ranking!.score).toBeGreaterThan(0);
    });

    it('should get season rankings sorted by score', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      updateSeasonRanking('user-1', season.id, {
        bestScores: 5000,
        challengeWins: 2,
        dailyParticipation: 5,
        xpEarned: 1000,
      });

      updateSeasonRanking('user-2', season.id, {
        bestScores: 15000,
        challengeWins: 10,
        dailyParticipation: 20,
        xpEarned: 5000,
      });

      const rankings = getSeasonRankings(season.id);
      expect(rankings.entries).toHaveLength(2);
      expect(rankings.entries[0]!.score).toBeGreaterThan(rankings.entries[1]!.score);
    });
  });

  describe('Reward Distribution', () => {
    it('should distribute season rewards idempotently', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      const t1 = distributeSeasonReward('user-1', season.id, 1);
      const t2 = distributeSeasonReward('user-1', season.id, 1);

      expect(t1).toBeDefined();
      expect(t1!.xp).toBeGreaterThan(0);
      expect(t2!.id).toBe(t1!.id); // Same transaction (idempotent)
    });

    it('should not reward ranks outside reward tiers', () => {
      const season = createSeason(1, 'Rise', new Date('2026-01-01'), new Date('2026-02-01'));

      const t = distributeSeasonReward('user-1', season.id, 100000);
      expect(t).toBeNull();
    });
  });
});
