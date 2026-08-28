/**
 * GTX Rush — Adaptive Difficulty Service v1.0
 *
 * Server-authoritative adaptive difficulty that handles:
 * - Practice mode difficulty adjustment
 * - Skill-based timing/target changes
 * - Game-specific adaptations
 *
 * SECURITY:
 * - All difficulty adjustments are server-side
 * - Competitive modes remain fixed
 * - No secret competitive rule changes
 *
 * IMPORTANT:
 * - This service only affects PRACTICE MODE
 * - Competitive/leaderboard modes use FIXED rules
 *
 * Contract: AI Personalization Contract v1.0
 */

import type {
  GameId,
  SkillBand,
  DifficultyAdjustment,
} from '@gtx-rush/types';
import {
  ADAPTIVE_DIFFICULTY_CONFIG,
  getDifficultyAdjustment,
} from '@gtx-rush/config';
import { getUserSkillBand } from './skill-estimation';

// ============================================================
// Difficulty Configuration
// ============================================================

export interface AdaptiveDifficultyResult {
  gameId: GameId;
  skillBand: SkillBand;
  adjustment: DifficultyAdjustment | null;
  isCompetitiveMode: boolean;
  config: {
    timingMultiplier: number;
    targetMultiplier: number;
    comboMultiplier: number;
  };
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Get adaptive difficulty configuration for a game
 */
export function getAdaptiveDifficulty(
  userId: string,
  gameId: GameId,
  isCompetitiveMode: boolean,
): AdaptiveDifficultyResult {
  // Competitive modes always use fixed rules
  if (isCompetitiveMode) {
    return {
      gameId,
      skillBand: 'intermediate',
      adjustment: null,
      isCompetitiveMode: true,
      config: {
        timingMultiplier: 1.0,
        targetMultiplier: 1.0,
        comboMultiplier: 1.0,
      },
    };
  }

  // Get player's skill band
  const skillBand = getUserSkillBand(userId, gameId);

  // Get adjustment for skill band
  const adjustment = getDifficultyAdjustment(gameId, skillBand);

  // Return adaptive config
  return {
    gameId,
    skillBand,
    adjustment,
    isCompetitiveMode: false,
    config: adjustment
      ? {
          timingMultiplier: adjustment.timingMultiplier,
          targetMultiplier: adjustment.targetMultiplier,
          comboMultiplier: adjustment.comboMultiplier,
        }
      : {
          timingMultiplier: 1.0,
          targetMultiplier: 1.0,
          comboMultiplier: 1.0,
        },
  };
}

/**
 * Get timing multiplier for a game
 */
export function getTimingMultiplier(
  userId: string,
  gameId: GameId,
  isCompetitiveMode: boolean,
): number {
  const result = getAdaptiveDifficulty(userId, gameId, isCompetitiveMode);
  return result.config.timingMultiplier;
}

/**
 * Get target multiplier for a game
 */
export function getTargetMultiplier(
  userId: string,
  gameId: GameId,
  isCompetitiveMode: boolean,
): number {
  const result = getAdaptiveDifficulty(userId, gameId, isCompetitiveMode);
  return result.config.targetMultiplier;
}

/**
 * Get combo multiplier for a game
 */
export function getComboMultiplier(
  userId: string,
  gameId: GameId,
  isCompetitiveMode: boolean,
): number {
  const result = getAdaptiveDifficulty(userId, gameId, isCompetitiveMode);
  return result.config.comboMultiplier;
}

/**
 * Check if adaptive difficulty is enabled for a game
 */
export function isAdaptiveDifficultyEnabled(gameId: GameId): boolean {
  const config = ADAPTIVE_DIFFICULTY_CONFIG[gameId];
  return config?.enabled ?? false;
}

/**
 * Check if practice mode is enabled for a game
 */
export function isPracticeModeEnabled(gameId: GameId): boolean {
  const config = ADAPTIVE_DIFFICULTY_CONFIG[gameId];
  return config?.practiceMode ?? false;
}

/**
 * Get all difficulty adjustments for a game
 */
export function getAllDifficultyAdjustments(gameId: GameId): DifficultyAdjustment[] {
  const config = ADAPTIVE_DIFFICULTY_CONFIG[gameId];
  return config?.adjustments ?? [];
}

/**
 * Get difficulty description for a skill band
 */
export function getDifficultyDescription(
  gameId: GameId,
  skillBand: SkillBand,
): string {
  const adjustment = getDifficultyAdjustment(gameId, skillBand);
  return adjustment?.description ?? 'Standard difficulty';
}

/**
 * Get recommended difficulty level for a game based on recent performance
 */
export function getRecommendedDifficulty(
  userId: string,
  gameId: GameId,
  recentPerformance: number, // 0-100
): SkillBand {
  if (recentPerformance >= 90) return 'elite';
  if (recentPerformance >= 70) return 'expert';
  if (recentPerformance >= 50) return 'advanced';
  if (recentPerformance >= 30) return 'intermediate';
  return 'beginner';
}

/**
 * Get adaptive difficulty summary for a user
 */
export function getAdaptiveDifficultySummary(userId: string): {
  games: {
    gameId: GameId;
    skillBand: SkillBand;
    practiceEnabled: boolean;
    currentAdjustment: DifficultyAdjustment | null;
  }[];
} {
  const games: GameId[] = ['reaction-rush', 'tap-rush', 'quiz-rush'];

  return {
    games: games.map((gameId) => {
      const skillBand = getUserSkillBand(userId, gameId);
      return {
        gameId,
        skillBand,
        practiceEnabled: isPracticeModeEnabled(gameId),
        currentAdjustment: getDifficultyAdjustment(gameId, skillBand),
      };
    }),
  };
}
