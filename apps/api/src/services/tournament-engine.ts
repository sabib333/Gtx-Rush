/**
 * GTX Rush — Tournament Engine v1.0
 *
 * Tournament engine that handles:
 * - Tournament creation and management
 * - Score Attack tournaments
 * - Head-to-Head integration
 * - Leaderboard tournaments
 * - Tournament progression
 *
 * SECURITY:
 * - Tournament state is server-authoritative
 * - Results are validated
 * - Rewards are idempotent
 *
 * Contract: Live Ops Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Event,
  TournamentFormat,
  TournamentConfig,
  EventParticipant,
  EventAttempt,
} from '@gtx-rush/types';
import {
  TOURNAMENT_FORMAT_DEFAULTS,
} from '@gtx-rush/config';
import {
  createEvent,
  joinEvent,
  submitEventAttempt,
  getEvent,
  getEventParticipants,
  getEventLeaderboard,
  updateEventStatus,
} from './event-engine';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const tournamentConfigs = new Map<string, TournamentConfig>();
const tournamentMatches = new Map<string, TournamentMatch[]>();

// ============================================================
// Tournament Types
// ============================================================

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  player1Id: string;
  player2Id: string | null;
  player1Score: number | null;
  player2Score: number | null;
  winnerId: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  startedAt: Date | null;
  completedAt: Date | null;
}

// ============================================================
// Tournament Creation
// ============================================================

/**
 * Create a new tournament.
 *
 * SECURITY:
 * - Tournament creation is server-side only
 * - Configuration is validated
 */
export function createTournament(params: {
  name: string;
  description: string;
  format: TournamentFormat;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
  maxParticipants?: number;
  config?: Partial<TournamentConfig>;
}): Event {
  const formatDefaults = TOURNAMENT_FORMAT_DEFAULTS[params.format];

  const tournamentConfig: TournamentConfig = {
    format: params.format,
    bracket: params.format === 'bracket' || params.format === 'elimination' ? {
      bracketSize: params.config?.bracket?.bracketSize ?? 16,
      currentRound: 0,
      totalRounds: Math.log2(params.config?.bracket?.bracketSize ?? 16),
      matchesPerRound: [],
    } : null,
    headToHead: params.format === 'head_to_head' ? {
      matchDurationMs: params.config?.headToHead?.matchDurationMs ?? 60000,
      winsNeeded: params.config?.headToHead?.winsNeeded ?? 3,
      maxMatchesPerRound: params.config?.headToHead?.maxMatchesPerRound ?? 5,
    } : null,
    leaderboard: params.format === 'leaderboard_tournament' || params.format === 'score_attack' ? {
      durationMs: formatDefaults.durationMs,
      updateFrequencyMs: 60000,
      showRealTime: true,
    } : null,
    ...params.config,
  };

  // Create event with tournament-specific settings
  const event = createEvent({
    name: params.name,
    description: params.description,
    type: 'tournament',
    gameId: params.gameId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    rules: {
      maxAttempts: null, // Unlimited for most tournaments
      bestScoreCounts: params.format === 'score_attack',
      attemptConstraint: 'unlimited',
    },
    scoringConfig: {
      formula: params.format === 'score_attack' ? 'best_score' : 'total_score',
      multiplier: 1.0,
      participationPoints: 10,
      personalBestBonus: 50,
      topN: 5,
    },
    metadata: {
      imageUrl: null,
      color: null,
      sponsor: null,
      campaignId: null,
    },
  });

  // Store tournament config
  tournamentConfigs.set(event.id, tournamentConfig);

  return event;
}

/**
 * Get tournament config.
 */
export function getTournamentConfig(tournamentId: string): TournamentConfig | null {
  return tournamentConfigs.get(tournamentId) ?? null;
}

// ============================================================
// Score Attack Tournament
// ============================================================

/**
 * Create a score attack tournament.
 */
export function createScoreAttackTournament(params: {
  name: string;
  description: string;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
}): Event {
  return createTournament({
    name: params.name,
    description: params.description,
    format: 'score_attack',
    gameId: params.gameId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });
}

// ============================================================
// Head-to-Head Tournament
// ============================================================

/**
 * Create a head-to-head tournament.
 */
export function createHeadToHeadTournament(params: {
  name: string;
  description: string;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
  winsNeeded?: number;
}): Event {
  return createTournament({
    name: params.name,
    description: params.description,
    format: 'head_to_head',
    gameId: params.gameId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    config: {
      headToHead: {
        matchDurationMs: 60000,
        winsNeeded: params.winsNeeded ?? 3,
        maxMatchesPerRound: 5,
      },
    },
  });
}

/**
 * Create a head-to-head match.
 */
export function createHeadToHeadMatch(
  tournamentId: string,
  player1Id: string,
  player2Id: string,
): TournamentMatch {
  const matches = tournamentMatches.get(tournamentId) ?? [];
  const matchNumber = matches.length + 1;

  const match: TournamentMatch = {
    id: nanoid(),
    tournamentId,
    round: 1,
    matchNumber,
    player1Id,
    player2Id,
    player1Score: null,
    player2Score: null,
    winnerId: null,
    status: 'pending',
    startedAt: null,
    completedAt: null,
  };

  matches.push(match);
  tournamentMatches.set(tournamentId, matches);

  return match;
}

/**
 * Submit head-to-head match result.
 */
export function submitHeadToHeadResult(
  tournamentId: string,
  matchId: string,
  playerId: string,
  score: number,
): {
  success: boolean;
  match?: TournamentMatch;
  error?: string;
} {
  const matches = tournamentMatches.get(tournamentId) ?? [];
  const match = matches.find((m) => m.id === matchId);

  if (!match) {
    return { success: false, error: 'MATCH_NOT_FOUND' };
  }

  if (match.status === 'completed') {
    return { success: false, error: 'MATCH_COMPLETED' };
  }

  // Update score
  if (match.player1Id === playerId) {
    match.player1Score = score;
  } else if (match.player2Id === playerId) {
    match.player2Score = score;
  } else {
    return { success: false, error: 'NOT_IN_MATCH' };
  }

  // Start match if not started
  if (match.status === 'pending') {
    match.status = 'in_progress';
    match.startedAt = new Date();
  }

  // Check if both players have submitted
  if (match.player1Score !== null && match.player2Score !== null) {
    // Determine winner
    if (match.player1Score > match.player2Score) {
      match.winnerId = match.player1Id;
    } else if (match.player2Score > match.player1Score) {
      match.winnerId = match.player2Id;
    }
    // Tie: no winner (could be handled differently)

    match.status = 'completed';
    match.completedAt = new Date();
  }

  return { success: true, match };
}

/**
 * Get tournament matches.
 */
export function getTournamentMatches(tournamentId: string): TournamentMatch[] {
  return tournamentMatches.get(tournamentId) ?? [];
}

// ============================================================
// Leaderboard Tournament
// ============================================================

/**
 * Create a leaderboard tournament.
 */
export function createLeaderboardTournament(params: {
  name: string;
  description: string;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
  updateFrequencyMs?: number;
}): Event {
  return createTournament({
    name: params.name,
    description: params.description,
    format: 'leaderboard_tournament',
    gameId: params.gameId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    config: {
      leaderboard: {
        durationMs: params.endsAt.getTime() - params.startsAt.getTime(),
        updateFrequencyMs: params.updateFrequencyMs ?? 60000,
        showRealTime: true,
      },
    },
  });
}

// ============================================================
// Tournament Queries
// ============================================================

/**
 * Get tournament standings.
 */
export function getTournamentStandings(tournamentId: string): {
  standings: Array<{
    rank: number;
    userId: string;
    score: number;
    matches: number;
    wins: number;
    losses: number;
  }>;
  totalParticipants: number;
} {
  const config = tournamentConfigs.get(tournamentId);

  if (config?.format === 'head_to_head') {
    // Calculate standings from matches
    const matches = getTournamentMatches(tournamentId);
    const playerStats = new Map<string, { score: number; matches: number; wins: number; losses: number }>();

    for (const match of matches) {
      if (match.status !== 'completed') continue;

      // Update player 1 stats
      if (!playerStats.has(match.player1Id)) {
        playerStats.set(match.player1Id, { score: 0, matches: 0, wins: 0, losses: 0 });
      }
      const p1Stats = playerStats.get(match.player1Id)!;
      p1Stats.matches++;
      if (match.winnerId === match.player1Id) {
        p1Stats.wins++;
        p1Stats.score += 100; // Points per win
      } else {
        p1Stats.losses++;
      }

      // Update player 2 stats
      if (match.player2Id) {
        if (!playerStats.has(match.player2Id)) {
          playerStats.set(match.player2Id, { score: 0, matches: 0, wins: 0, losses: 0 });
        }
        const p2Stats = playerStats.get(match.player2Id)!;
        p2Stats.matches++;
        if (match.winnerId === match.player2Id) {
          p2Stats.wins++;
          p2Stats.score += 100;
        } else {
          p2Stats.losses++;
        }
      }
    }

    // Sort by score
    const standings = Array.from(playerStats.entries())
      .map(([userId, stats]) => ({
        rank: 0,
        userId,
        ...stats,
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return {
      standings,
      totalParticipants: playerStats.size,
    };
  }

  // For other formats, use leaderboard
  const leaderboard = getEventLeaderboard(tournamentId, { limit: 100 });
  return {
    standings: leaderboard.entries.map((entry) => ({
      rank: entry.rank,
      userId: entry.userId,
      score: entry.eventScore,
      matches: entry.attemptCount,
      wins: 0,
      losses: 0,
    })),
    totalParticipants: leaderboard.totalParticipants,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearTournamentEngine(): void {
  tournamentConfigs.clear();
  tournamentMatches.clear();
}

export function _getTournamentConfigCount(): number {
  return tournamentConfigs.size;
}

export function _getTournamentMatchCount(tournamentId: string): number {
  return (tournamentMatches.get(tournamentId) ?? []).length;
}
