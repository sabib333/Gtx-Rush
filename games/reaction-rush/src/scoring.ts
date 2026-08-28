/**
 * Reaction Rush — Server-Side Scoring
 *
 * This module calculates scores from raw input events.
 * It is used by both the game engine and the API routes.
 */

import type { GameInput, GameResult as TypesGameResult } from '@gtx-rush/types';
import { REACTION_RUSH_CONFIG, calculateRoundScore, calculateGameResult } from './config';
import type { InputEvent, RoundData, GameResult } from './config';

/**
 * Convert raw GameInput[] into structured round data.
 * Used by the server to reconstruct gameplay from submitted events.
 */
export function reconstructRounds(inputs: GameInput[]): RoundData[] {
  const roundMap = new Map<number, RoundData>();

  for (const input of inputs) {
    const data = input.data as Record<string, unknown>;
    const roundNumber = data.roundNumber as number;

    if (!roundMap.has(roundNumber)) {
      roundMap.set(roundNumber, {
        roundNumber,
        state: 'waiting',
        targetActivatedAt: null,
        targetTappedAt: null,
        reactionTimeMs: null,
        isFalseStart: false,
        events: [],
      });
    }

    const round = roundMap.get(roundNumber)!;
    const event: InputEvent = {
      type: input.type as InputEvent['type'],
      timestamp: input.timestamp,
      roundNumber,
      data: data as Record<string, unknown>,
    };
    round.events.push(event);

    switch (input.type) {
      case 'round_started':
        round.state = 'waiting';
        break;
      case 'target_activated':
        round.state = 'target_active';
        round.targetActivatedAt = input.timestamp;
        break;
      case 'target_tapped':
        round.state = 'tapped';
        round.targetTappedAt = input.timestamp;
        if (round.targetActivatedAt) {
          round.reactionTimeMs = input.timestamp - round.targetActivatedAt;
        }
        break;
      case 'false_start':
        round.state = 'false_start';
        round.isFalseStart = true;
        break;
    }
  }

  return Array.from(roundMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
}

/**
 * Calculate score from raw game inputs (server-side).
 * This is the authoritative scoring function.
 */
export function calculateServerScore(inputs: GameInput[], durationMs: number): GameResult {
  const rounds = reconstructRounds(inputs);
  const startedAt = inputs.length > 0 ? inputs[0]!.timestamp : 0;
  const endedAt = startedAt + durationMs;

  return calculateGameResult(rounds, startedAt, endedAt);
}

/**
 * Calculate score and return in the @gtx-rush/types GameResult format.
 * Used by the BaseGame framework.
 */
export function calculateScore(inputs: GameInput[]): TypesGameResult {
  const rounds = reconstructRounds(inputs);
  const startedAt = inputs.length > 0 ? inputs[0]!.timestamp : 0;
  const durationMs = inputs.length > 1
    ? inputs[inputs.length - 1]!.timestamp - inputs[0]!.timestamp
    : 0;
  const localResult = calculateGameResult(rounds, startedAt, startedAt + durationMs);

  return {
    score: localResult.score,
    breakdown: localResult.breakdown as unknown as Record<string, number>,
    metadata: {
      averageReactionTime: localResult.averageReactionTime,
      bestReactionTime: localResult.bestReactionTime,
      roundsCompleted: localResult.completedRounds,
    },
    antiCheatFlags: [],
    durationMs: localResult.durationMs,
    inputCount: inputs.length,
  };
}

/**
 * Validate that an input sequence is structurally valid.
 */
export function validateInputSequence(inputs: GameInput[], expectedRounds: number): {
  valid: boolean;
  error?: string;
} {
  if (inputs.length === 0) {
    return { valid: false, error: 'No inputs provided' };
  }

  // Check round numbers
  const roundNumbers = new Set(inputs.map((i) => (i.data as { roundNumber: number }).roundNumber));
  if (roundNumbers.size > expectedRounds) {
    return { valid: false, error: `Too many rounds: ${roundNumbers.size} > ${expectedRounds}` };
  }

  // Check for valid event types
  const validTypes = new Set(['round_started', 'target_activated', 'target_tapped', 'false_start', 'round_completed']);
  for (const input of inputs) {
    if (!validTypes.has(input.type)) {
      return { valid: false, error: `Invalid event type: ${input.type}` };
    }
  }

  // Check timestamp ordering within each round
  for (const roundNum of roundNumbers) {
    const roundInputs = inputs
      .filter((i) => (i.data as { roundNumber: number }).roundNumber === roundNum)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Timestamps should be non-decreasing
    for (let i = 1; i < roundInputs.length; i++) {
      if (roundInputs[i]!.timestamp < roundInputs[i - 1]!.timestamp) {
        return { valid: false, error: `Timestamps out of order in round ${roundNum}` };
      }
    }

    // Check event sequence validity
    const types = roundInputs.map((i) => i.type);
    if (types.includes('target_tapped') && !types.includes('target_activated')) {
      return { valid: false, error: `Round ${roundNum}: target tapped without activation` };
    }
  }

  return { valid: true };
}
