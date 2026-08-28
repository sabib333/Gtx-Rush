/**
 * GTX Rush — Tournament Engine Tests
 *
 * Tests for:
 * - Tournament creation
 * - Score Attack tournaments
 * - Head-to-Head tournaments
 * - Leaderboard tournaments
 * - Tournament standings
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTournament,
  createScoreAttackTournament,
  createHeadToHeadTournament,
  createLeaderboardTournament,
  createHeadToHeadMatch,
  submitHeadToHeadResult,
  getTournamentConfig,
  getTournamentMatches,
  getTournamentStandings,
  _clearTournamentEngine,
  _getTournamentConfigCount,
  _getTournamentMatchCount,
} from '../tournament-engine';
import { _clearEventEngine } from '../event-engine';

describe('Tournament Engine', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';

  beforeEach(() => {
    _clearTournamentEngine();
    _clearEventEngine();
  });

  describe('Tournament Creation', () => {
    it('should create a tournament', () => {
      const tournament = createTournament({
        name: 'Test Tournament',
        description: 'A test tournament',
        format: 'score_attack',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      expect(tournament).toBeDefined();
      expect(tournament.name).toBe('Test Tournament');
      expect(tournament.type).toBe('tournament');
    });

    it('should create a score attack tournament', () => {
      const tournament = createScoreAttackTournament({
        name: 'Score Attack',
        description: 'Get the highest score',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      expect(tournament).toBeDefined();
      expect(tournament.name).toBe('Score Attack');
    });

    it('should create a head-to-head tournament', () => {
      const tournament = createHeadToHeadTournament({
        name: 'Head to Head',
        description: 'Battle other players',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        winsNeeded: 3,
      });

      expect(tournament).toBeDefined();
      expect(tournament.name).toBe('Head to Head');

      const config = getTournamentConfig(tournament.id);
      expect(config).toBeDefined();
      expect(config?.format).toBe('head_to_head');
    });

    it('should create a leaderboard tournament', () => {
      const tournament = createLeaderboardTournament({
        name: 'Leaderboard Tournament',
        description: 'Top of the leaderboard wins',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      expect(tournament).toBeDefined();
      expect(tournament.name).toBe('Leaderboard Tournament');
    });
  });

  describe('Head-to-Head Matches', () => {
    it('should create a head-to-head match', () => {
      const tournament = createHeadToHeadTournament({
        name: 'H2H Tournament',
        description: 'Battle',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      const match = createHeadToHeadMatch(tournament.id, testUserId, testUserId2);
      expect(match).toBeDefined();
      expect(match.player1Id).toBe(testUserId);
      expect(match.player2Id).toBe(testUserId2);
      expect(match.status).toBe('pending');
    });

    it('should submit head-to-head result', () => {
      const tournament = createHeadToHeadTournament({
        name: 'H2H Tournament',
        description: 'Battle',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      const match = createHeadToHeadMatch(tournament.id, testUserId, testUserId2);

      // Player 1 submits
      const result1 = submitHeadToHeadResult(tournament.id, match.id, testUserId, 5000);
      expect(result1.success).toBe(true);
      expect(result1.match?.status).toBe('in_progress');

      // Player 2 submits
      const result2 = submitHeadToHeadResult(tournament.id, match.id, testUserId2, 9842);
      expect(result2.success).toBe(true);
      expect(result2.match?.status).toBe('completed');
      expect(result2.match?.winnerId).toBe(testUserId2); // Higher score wins
    });

    it('should not submit to completed match', () => {
      const tournament = createHeadToHeadTournament({
        name: 'H2H Tournament',
        description: 'Battle',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      const match = createHeadToHeadMatch(tournament.id, testUserId, testUserId2);

      submitHeadToHeadResult(tournament.id, match.id, testUserId, 5000);
      submitHeadToHeadResult(tournament.id, match.id, testUserId2, 9842);

      const result = submitHeadToHeadResult(tournament.id, match.id, testUserId, 10000);
      expect(result.success).toBe(false);
      expect(result.error).toBe('MATCH_COMPLETED');
    });

    it('should get tournament matches', () => {
      const tournament = createHeadToHeadTournament({
        name: 'H2H Tournament',
        description: 'Battle',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      createHeadToHeadMatch(tournament.id, testUserId, testUserId2);
      createHeadToHeadMatch(tournament.id, 'user-3', 'user-4');

      const matches = getTournamentMatches(tournament.id);
      expect(matches.length).toBe(2);
    });
  });

  describe('Tournament Standings', () => {
    it('should get tournament standings', () => {
      const tournament = createScoreAttackTournament({
        name: 'Score Attack',
        description: 'Get the highest score',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      // Would need to join and submit scores to test standings
      const standings = getTournamentStandings(tournament.id);
      expect(standings).toBeDefined();
      expect(standings.standings).toBeDefined();
    });

    it('should calculate head-to-head standings', () => {
      const tournament = createHeadToHeadTournament({
        name: 'H2H Tournament',
        description: 'Battle',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      const match = createHeadToHeadMatch(tournament.id, testUserId, testUserId2);
      submitHeadToHeadResult(tournament.id, match.id, testUserId, 5000);
      submitHeadToHeadResult(tournament.id, match.id, testUserId2, 9842);

      const standings = getTournamentStandings(tournament.id);
      expect(standings.standings.length).toBe(2);
      expect(standings.standings[0].userId).toBe(testUserId2); // Winner first
    });
  });

  describe('Cleanup', () => {
    it('should clear tournament engine', () => {
      createScoreAttackTournament({
        name: 'Test',
        description: 'Test',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      _clearTournamentEngine();
      expect(_getTournamentConfigCount()).toBe(0);
    });
  });
});
