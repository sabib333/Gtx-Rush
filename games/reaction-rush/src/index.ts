/**
 * Reaction Rush — Game Engine
 *
 * Complete game engine implementation.
 * Registers with the game engine framework for server-side scoring and validation.
 */

import type { GameInput, GameResult } from '@gtx-rush/types';
import { BaseGame, gameRegistry } from '@gtx-rush/game-engine';
import type { AntiCheatRule } from '@gtx-rush/game-engine';
import { calculateScore } from './scoring';
import { REACTION_RUSH_ANTI_CHEAT_RULES } from './validation';
import { REACTION_RUSH_CONFIG, REACTION_RUSH_VERSION } from './config';

/**
 * Reaction Rush Game
 *
 * A fast reaction-time game. Players must tap as soon as the screen changes color.
 * Faster reactions = higher scores. False starts are penalized.
 */
class ReactionRushGame extends BaseGame {
  readonly gameId = 'reaction-rush';

  override calculateScore(inputs: GameInput[]): GameResult {
    return calculateScore(inputs);
  }

  override getAntiCheatRules(): AntiCheatRule[] {
    return REACTION_RUSH_ANTI_CHEAT_RULES;
  }

  override getConfig(): Record<string, unknown> {
    return {
      ...super.getConfig(),
      ...REACTION_RUSH_CONFIG,
      version: REACTION_RUSH_VERSION,
    };
  }
}

// Register the game on import
const game = new ReactionRushGame();
gameRegistry.register(game);

export { ReactionRushGame };
export { calculateScore, calculateServerScore, validateInputSequence, reconstructRounds } from './scoring';
export { REACTION_RUSH_CONFIG, REACTION_RUSH_VERSION } from './config';
export type { GameState, GameMode, GameSession, GameResult as ReactionRushResult, RoundData, InputEvent } from './config';
export { REACTION_RUSH_ANTI_CHEAT_RULES, runAntiCheat } from './validation';
