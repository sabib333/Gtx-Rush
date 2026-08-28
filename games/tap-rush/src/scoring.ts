/**
 * Tap Rush — Server-Side Scoring
 *
 * This module calculates scores from raw input events.
 * It is used by both the game engine and the API routes.
 *
 * The score is NEVER trusted from the client.
 * Server reconstructs the entire game from submitted events.
 */

import type { GameInput, GameResult as TypesGameResult } from '@gtx-rush/types';
import {
  TAP_RUSH_CONFIG,
  calculateTapScore,
  calculateComboMultiplier,
  calculateGameResult,
} from './config';
import type { InputEvent, Target, TargetType } from './config';

/**
 * Reconstruct target and tap data from raw GameInput[].
 * Used by the server to rebuild gameplay from submitted events.
 */
export function reconstructEvents(inputs: GameInput[]): InputEvent[] {
  const events: InputEvent[] = [];

  for (const input of inputs) {
    const data = input.data as Record<string, unknown>;

    const event: InputEvent = {
      type: input.type as InputEvent['type'],
      timestamp: input.timestamp,
    };

    if (data.targetId) event.targetId = data.targetId as string;
    if (data.targetType) event.targetType = data.targetType as TargetType;
    if (data.targetX != null && data.targetY != null) {
      event.targetPosition = { x: data.targetX as number, y: data.targetY as number };
    }
    if (data.tapX != null && data.tapY != null) {
      event.tapPosition = { x: data.tapX as number, y: data.tapY as number };
    }
    if (data.combo != null) event.combo = data.combo as number;

    events.push(event);
  }

  return events;
}

/**
 * Reconstruct a target map from spawned events.
 * Used by the server to validate tap coordinates.
 */
export function reconstructTargets(events: InputEvent[]): Map<string, Target> {
  const targets = new Map<string, Target>();

  for (const event of events) {
    if (event.type === 'target_spawned' && event.targetId && event.targetPosition) {
      targets.set(event.targetId, {
        id: event.targetId,
        type: (event.targetType as TargetType) ?? 'normal',
        x: event.targetPosition.x,
        y: event.targetPosition.y,
        size: TAP_RUSH_CONFIG.targetSizePx,
        spawnTimestamp: event.timestamp,
        state: 'active',
      });
    }
  }

  return targets;
}

/**
 * Calculate score from raw game inputs (server-side).
 * Derives duration from the input timestamps themselves.
 * Used by the BaseGame framework.
 */
export function calculateScore(inputs: GameInput[]): TypesGameResult {
  const events = reconstructEvents(inputs);
  const startedAt = events.length > 0 ? events[0]!.timestamp : 0;
  const durationMs = inputs.length > 1
    ? inputs[inputs.length - 1]!.timestamp - inputs[0]!.timestamp
    : 0;
  const endedAt = startedAt + durationMs;

  const localResult = calculateGameResult(events, startedAt, endedAt);

  return {
    score: localResult.score,
    breakdown: localResult.breakdown as unknown as Record<string, number>,
    metadata: {
      validTaps: localResult.validTaps,
      invalidTaps: localResult.invalidTaps,
      accuracy: localResult.accuracy,
      highestCombo: localResult.highestCombo,
      tapsPerSecond: localResult.tapsPerSecond,
      bonusTaps: localResult.bonusTaps,
    },
    antiCheatFlags: [],
    durationMs: localResult.durationMs,
    inputCount: inputs.length,
  };
}

/**
 * Calculate score from raw game inputs (server-side) with explicit duration.
 * This is the authoritative scoring function.
 */
export function calculateServerScore(inputs: GameInput[], durationMs: number): TypesGameResult {
  const events = reconstructEvents(inputs);
  const startedAt = events.length > 0 ? events[0]!.timestamp : 0;
  const endedAt = startedAt + durationMs;

  const localResult = calculateGameResult(events, startedAt, endedAt);

  return {
    score: localResult.score,
    breakdown: localResult.breakdown as unknown as Record<string, number>,
    metadata: {
      validTaps: localResult.validTaps,
      invalidTaps: localResult.invalidTaps,
      accuracy: localResult.accuracy,
      highestCombo: localResult.highestCombo,
      tapsPerSecond: localResult.tapsPerSecond,
      bonusTaps: localResult.bonusTaps,
    },
    antiCheatFlags: [],
    durationMs: localResult.durationMs,
    inputCount: inputs.length,
  };
}

/**
 * Validate that an input sequence is structurally valid.
 */
export function validateInputSequence(inputs: GameInput[], durationMs: number): {
  valid: boolean;
  error?: string;
} {
  if (inputs.length === 0) {
    return { valid: false, error: 'No inputs provided' };
  }

  const validTypes = new Set([
    'session_started',
    'target_spawned',
    'target_hit',
    'target_missed',
    'invalid_tap',
    'session_finished',
  ]);

  for (const input of inputs) {
    if (!validTypes.has(input.type)) {
      return { valid: false, error: `Invalid event type: ${input.type}` };
    }
  }

  // First event must be session_started
  if (inputs[0]!.type !== 'session_started') {
    return { valid: false, error: 'First event must be session_started' };
  }

  // Last event should be session_finished
  if (inputs[inputs.length - 1]!.type !== 'session_finished') {
    return { valid: false, error: 'Last event must be session_finished' };
  }

  // Timestamps should be monotonically non-decreasing
  for (let i = 1; i < inputs.length; i++) {
    if (inputs[i]!.timestamp < inputs[i - 1]!.timestamp) {
      return { valid: false, error: `Timestamps out of order at index ${i}` };
    }
  }

  // Total duration should be reasonable (not exceeding game duration + buffer)
  const maxDuration = durationMs + 2000; // 2 second buffer
  const eventDuration = inputs[inputs.length - 1]!.timestamp - inputs[0]!.timestamp;
  if (eventDuration > maxDuration) {
    return { valid: false, error: `Event duration ${eventDuration}ms exceeds maximum ${maxDuration}ms` };
  }

  // Taps cannot happen before session_started
  const sessionStart = inputs[0]!.timestamp;
  for (const input of inputs) {
    if (input.timestamp < sessionStart) {
      return { valid: false, error: 'Event timestamp before session start' };
    }
  }

  // Validate target IDs are unique
  const targetIds = new Set<string>();
  for (const input of inputs) {
    if (input.type === 'target_spawned') {
      const targetId = (input.data as Record<string, unknown>).targetId as string;
      if (targetIds.has(targetId)) {
        return { valid: false, error: `Duplicate target ID: ${targetId}` };
      }
      targetIds.add(targetId);
    }
  }

  // All hit targets must have been spawned
  const spawnedTargets = new Set<string>();
  for (const input of inputs) {
    if (input.type === 'target_spawned') {
      spawnedTargets.add((input.data as Record<string, unknown>).targetId as string);
    }
  }

  for (const input of inputs) {
    if (input.type === 'target_hit') {
      const targetId = (input.data as Record<string, unknown>).targetId as string;
      if (!spawnedTargets.has(targetId)) {
        return { valid: false, error: `Hit on unspawned target: ${targetId}` };
      }
    }
  }

  return { valid: true };
}
