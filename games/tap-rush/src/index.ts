/**
 * Tap Rush — Game Engine
 *
 * Complete game engine implementation.
 * Registers with the game engine framework for server-side scoring and validation.
 */

import type { GameInput, GameResult } from '@gtx-rush/types';
import { BaseGame, gameRegistry } from '@gtx-rush/game-engine';
import type { AntiCheatRule } from '@gtx-rush/game-engine';
import { calculateScore } from './scoring';
import { TAP_RUSH_ANTI_CHEAT_RULES } from './validation';
import { TAP_RUSH_CONFIG, TAP_RUSH_VERSION } from './config';

/**
 * Tap Rush Game
 *
 * A timed competitive tapping game. Players tap targets as fast
 * and accurately as possible within 15 seconds. Combo system
 * rewards consecutive hits. Bonus targets award extra points.
 */
class TapRushGame extends BaseGame {
  readonly gameId = 'tap-rush';

  override calculateScore(inputs: GameInput[]): GameResult {
    return calculateScore(inputs);
  }

  override getAntiCheatRules(): AntiCheatRule[] {
    return TAP_RUSH_ANTI_CHEAT_RULES;
  }

  override getConfig(): Record<string, unknown> {
    return {
      ...super.getConfig(),
      ...TAP_RUSH_CONFIG,
      version: TAP_RUSH_VERSION,
    };
  }
}

// Register the game on import
const game = new TapRushGame();
gameRegistry.register(game);

export { TapRushGame };
export { calculateScore, calculateServerScore, validateInputSequence, reconstructEvents, reconstructTargets } from './scoring';
export { TAP_RUSH_CONFIG, TAP_RUSH_VERSION } from './config';
export type { GameState, GameMode, Target, TargetType, InputEvent, TapRushSession, ComboState, TapRushGameResult } from './config';
export { calculateGameResult, calculateComboMultiplier, generateTargetPosition, isTapOnTarget, getNextSpawnDelay, shouldSpawnBonusTarget } from './config';
export { TAP_RUSH_ANTI_CHEAT_RULES, runAntiCheat } from './validation';
