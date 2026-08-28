/**
 * Quiz Rush — Game Engine
 *
 * Complete game engine implementation.
 * Registers with the game engine framework for server-side scoring and validation.
 */

import type { GameInput, GameResult } from '@gtx-rush/types';
import { BaseGame, gameRegistry } from '@gtx-rush/game-engine';
import type { AntiCheatRule } from '@gtx-rush/game-engine';
import { calculateScore } from './scoring';
import { QUIZ_RUSH_ANTI_CHEAT_RULES } from './validation';
import { QUIZ_RUSH_CONFIG, QUIZ_RUSH_VERSION } from './config';

/**
 * Quiz Rush Game
 *
 * A fast competitive knowledge game. Players answer multiple-choice
 * questions as quickly and accurately as possible. Score includes
 * base points, speed bonus, streak bonus, and difficulty bonus.
 */
class QuizRushGame extends BaseGame {
  readonly gameId = 'quiz-rush';

  override calculateScore(inputs: GameInput[]): GameResult {
    return calculateScore(inputs);
  }

  override getAntiCheatRules(): AntiCheatRule[] {
    return QUIZ_RUSH_ANTI_CHEAT_RULES;
  }

  override getConfig(): Record<string, unknown> {
    return {
      ...super.getConfig(),
      ...QUIZ_RUSH_CONFIG,
      version: QUIZ_RUSH_VERSION,
    };
  }
}

// Register the game on import
const game = new QuizRushGame();
gameRegistry.register(game);

export { QuizRushGame };
export { calculateScore, calculateServerScore, validateInputSequence, reconstructEvents, reconstructAnswers } from './scoring';
export { QUIZ_RUSH_CONFIG, QUIZ_RUSH_VERSION } from './config';
export type { GameState, GameMode, Question, PublicQuestion, QuestionDifficulty, QuestionOption, InputEvent, AnswerResult, QuizRushGameResult, AnsweredQuestion } from './config';
export { calculateAnswerScore, calculateStreakMultiplier, calculateSpeedBonus, getDifficultyMultiplier, shuffleArray, toPublicQuestion } from './config';
export { QUIZ_RUSH_ANTI_CHEAT_RULES, runAntiCheat } from './validation';
