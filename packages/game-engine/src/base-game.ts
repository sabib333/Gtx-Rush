import type { GameInput, GameResult, ScoreValidationResult } from '@gtx-rush/types';
import type { GameEngine, GameSessionData, AntiCheatRule } from './types';
import { ANTI_CHEAT_CONFIG } from '@gtx-rush/config';

/**
 * Base class for all game implementations.
 * Each game must extend this class and implement the abstract methods.
 */
export abstract class BaseGame implements GameEngine {
  abstract readonly gameId: string;

  abstract calculateScore(inputs: GameInput[]): GameResult;

  abstract getAntiCheatRules(): AntiCheatRule[];

  getConfig(): Record<string, unknown> {
    const gameConfig = (ANTI_CHEAT_CONFIG.games as Record<string, Record<string, unknown>>)[
      this.gameId
    ];
    return gameConfig ?? {};
  }

  validateScore(session: GameSessionData): ScoreValidationResult {
    const flags: string[] = [];

    // 1. Check basic session validity
    if (session.status !== 'active') {
      return { valid: false, score: 0, flags: ['SESSION_NOT_ACTIVE'], reason: 'Session is not active' };
    }

    if (session.inputs.length === 0) {
      return { valid: false, score: 0, flags: ['NO_INPUTS'], reason: 'No inputs recorded' };
    }

    // 2. Run global anti-cheat checks
    const globalFlags = this.runGlobalChecks(session);
    flags.push(...globalFlags);

    // 3. Run game-specific anti-cheat checks
    const gameRules = this.getAntiCheatRules();
    for (const rule of gameRules) {
      const result = rule.check(session, session.inputs);
      if (!result.passed && result.flag) {
        flags.push(result.flag);
      }
    }

    // 4. Calculate score from inputs (server-side, ignoring any client claim)
    const result = this.calculateScore(session.inputs);

    // 5. Determine if score should be accepted
    const criticalFlags = flags.filter((f) => this.isCriticalFlag(f));
    const shouldDisqualify = criticalFlags.length > 0;

    if (shouldDisqualify) {
      return {
        valid: false,
        score: 0,
        flags,
        reason: `Disqualified due to: ${criticalFlags.join(', ')}`,
      };
    }

    return {
      valid: true,
      score: result.score,
      flags,
    };
  }

  private runGlobalChecks(session: GameSessionData): string[] {
    const flags: string[] = [];
    const config = ANTI_CHEAT_CONFIG;

    // Check session duration
    const duration = Date.now() - session.startedAt.getTime();
    if (duration > config.maxSessionDurationMs) {
      flags.push('SESSION_DURATION_EXCEEDED');
    }

    // Check input flood
    if (session.inputs.length > 1) {
      const timeSpan =
        session.inputs[session.inputs.length - 1]!.timestamp - session.inputs[0]!.timestamp;
      if (timeSpan > 0) {
        const inputsPerSecond = session.inputs.length / (timeSpan / 1000);
        if (inputsPerSecond > config.maxInputsPerSecond) {
          flags.push('INPUT_FLOOD');
        }
      }
    }

    // Check for replay (duplicate timestamps across all inputs)
    const timestamps = session.inputs.map((i) => i.timestamp);
    const uniqueTimestamps = new Set(timestamps);
    if (uniqueTimestamps.size === 1 && timestamps.length > 3) {
      flags.push('IMPOSSIBLE_TIMING');
    }

    return flags;
  }

  private isCriticalFlag(flag: string): boolean {
    const criticalFlags = [
      'SESSION_DURATION_EXCEEDED',
      'IMPOSSIBLE_TIMING',
      'REPLAY_DETECTION',
      'SESSION_EXPIRED',
      'NO_INPUTS',
    ];
    return criticalFlags.includes(flag);
  }
}
