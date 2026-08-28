/**
 * GTX Rush — Skill Estimation Service v1.0
 *
 * Server-authoritative skill estimation that handles:
 * - Per-game skill scoring
 * - Skill band classification
 * - Performance tracking
 * - Improvement rate calculation
 *
 * SECURITY:
 * - All calculations are server-side
 * - No client manipulation of skill scores
 *
 * Contract: AI Personalization Contract v1.0
 */

import type {
  GameId,
  SkillEstimate,
  SkillBand,
} from '@gtx-rush/types';
import {
  SKILL_CONFIG,
  getSkillBand,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const skillEstimates = new Map<string, SkillEstimate[]>(); // userId → estimates
const performanceHistory = new Map<string, PerformanceEntry[]>(); // userId:gameId → history

// ============================================================
// Types
// ============================================================

interface PerformanceEntry {
  score: number;
  completed: boolean;
  duration: number;
  isEvent: boolean;
  isChallenge: boolean;
  timestamp: Date;
}

// ============================================================
// Skill Estimation
// ============================================================

/**
 * Get or create skill estimate for a game
 */
export function getOrCreateSkillEstimate(
  userId: string,
  gameId: GameId,
): SkillEstimate {
  const estimates = skillEstimates.get(userId) ?? [];
  const existing = estimates.find((e) => e.gameId === gameId);

  if (existing) return existing;

  // Create new estimate
  const newEstimate: SkillEstimate = {
    gameId,
    skillScore: 50, // Start at 50 (intermediate)
    skillBand: 'intermediate',
    gamesPlayed: 0,
    averagePerformance: 50,
    recentPerformance: 50,
    improvementRate: 0,
    lastUpdated: new Date(),
  };

  estimates.push(newEstimate);
  skillEstimates.set(userId, estimates);

  return newEstimate;
}

/**
 * Update skill estimate based on game performance
 */
export function updateSkillEstimate(
  userId: string,
  gameId: GameId,
  score: number,
  completed: boolean,
  duration: number,
  isEvent: boolean,
  isChallenge: boolean,
): SkillEstimate {
  const estimate = getOrCreateSkillEstimate(userId, gameId);

  // Record performance
  const historyKey = `${userId}:${gameId}`;
  const history = performanceHistory.get(historyKey) ?? [];
  history.push({
    score,
    completed,
    duration,
    isEvent,
    isChallenge,
    timestamp: new Date(),
  });
  performanceHistory.set(historyKey, history);

  // Calculate performance score
  const performanceScore = calculateGamePerformance(score, completed, duration, isEvent, isChallenge);

  // Update estimate with smoothing
  const recentWeight = SKILL_CONFIG.recentPerformanceWeight;
  const oldWeight = 1 - recentWeight;

  estimate.recentPerformance = performanceScore;
  estimate.averagePerformance = (estimate.averagePerformance * oldWeight) + (performanceScore * recentWeight);
  estimate.gamesPlayed += 1;

  // Calculate new skill score
  const smoothing = SKILL_CONFIG.smoothingFactor;
  const newSkillScore = Math.round(
    estimate.averagePerformance * (1 - smoothing) + estimate.recentPerformance * smoothing
  );

  // Update improvement rate
  if (estimate.gamesPlayed > 3) {
    const recentGames = history.slice(-5);
    const oldGames = history.slice(-10, -5);
    if (oldGames.length > 0 && recentGames.length > 0) {
      const recentAvg = recentGames.reduce((sum, g) => sum + calculateGamePerformance(g.score, g.completed, g.duration, g.isEvent, g.isChallenge), 0) / recentGames.length;
      const oldAvg = oldGames.reduce((sum, g) => sum + calculateGamePerformance(g.score, g.completed, g.duration, g.isEvent, g.isChallenge), 0) / oldGames.length;
      estimate.improvementRate = Math.max(-1, Math.min(1, (recentAvg - oldAvg) / 50));
    }
  }

  estimate.skillScore = Math.max(0, Math.min(100, newSkillScore));
  estimate.skillBand = getSkillBand(estimate.skillScore);
  estimate.lastUpdated = new Date();

  return estimate;
}

/**
 * Calculate game-specific performance score
 */
function calculateGamePerformance(
  score: number,
  completed: boolean,
  duration: number,
  isEvent: boolean,
  isChallenge: boolean,
): number {
  // Base score normalization (simplified)
  const baseScore = Math.min(score / 100, 80);

  // Completion bonus
  const completionBonus = completed ? 10 : 0;

  // Mode bonuses
  const eventBonus = isEvent ? 5 : 0;
  const challengeBonus = isChallenge ? 5 : 0;

  return Math.min(baseScore + completionBonus + eventBonus + challengeBonus, 100);
}

/**
 * Get all skill estimates for a user
 */
export function getUserSkillEstimates(userId: string): SkillEstimate[] {
  return skillEstimates.get(userId) ?? [];
}

/**
 * Get skill estimate for a specific game
 */
export function getSkillEstimate(userId: string, gameId: GameId): SkillEstimate | null {
  const estimates = skillEstimates.get(userId) ?? [];
  return estimates.find((e) => e.gameId === gameId) ?? null;
}

/**
 * Get skill band for a game
 */
export function getUserSkillBand(userId: string, gameId: GameId): SkillBand {
  const estimate = getSkillEstimate(userId, gameId);
  return estimate?.skillBand ?? 'beginner';
}

/**
 * Get skill score for a game
 */
export function getUserSkillScore(userId: string, gameId: GameId): number {
  const estimate = getSkillEstimate(userId, gameId);
  return estimate?.skillScore ?? 50;
}

/**
 * Check if user has enough data for reliable skill estimate
 */
export function hasReliableSkillEstimate(userId: string, gameId: GameId): boolean {
  const estimate = getSkillEstimate(userId, gameId);
  return (estimate?.gamesPlayed ?? 0) >= SKILL_CONFIG.minimumGamesForSkill;
}

/**
 * Get performance history for a game
 */
export function getPerformanceHistory(
  userId: string,
  gameId: GameId,
  limit: number = 20,
): PerformanceEntry[] {
  const historyKey = `${userId}:${gameId}`;
  const history = performanceHistory.get(historyKey) ?? [];
  return history.slice(-limit);
}

/**
 * Get improvement trend for a game
 */
export function getImprovementTrend(
  userId: string,
  gameId: GameId,
): { improving: boolean; trend: number } {
  const history = getPerformanceHistory(userId, gameId, 10);
  if (history.length < 5) {
    return { improving: false, trend: 0 };
  }

  const recentHalf = history.slice(-Math.floor(history.length / 2));
  const oldHalf = history.slice(0, Math.floor(history.length / 2));

  const recentAvg = recentHalf.reduce((sum, h) => sum + h.score, 0) / recentHalf.length;
  const oldAvg = oldHalf.reduce((sum, h) => sum + h.score, 0) / oldHalf.length;

  const trend = ((recentAvg - oldAvg) / oldAvg) * 100;
  return {
    improving: trend > 2,
    trend: Math.round(trend),
  };
}

/**
 * Get skill summary for all games
 */
export function getSkillSummary(userId: string): {
  overall: number;
  games: { gameId: GameId; skill: number; band: SkillBand }[];
} {
  const estimates = getUserSkillEstimates(userId);

  const games = (['reaction-rush', 'tap-rush', 'quiz-rush'] as GameId[]).map((gameId) => {
    const estimate = estimates.find((e) => e.gameId === gameId);
    return {
      gameId,
      skill: estimate?.skillScore ?? 50,
      band: estimate?.skillBand ?? 'beginner',
    };
  });

  const overall = Math.round(games.reduce((sum, g) => sum + g.skill, 0) / games.length);

  return { overall, games };
}

/**
 * Clear user skill data (for testing)
 */
export function _clearUserSkillData(userId: string): void {
  skillEstimates.delete(userId);
  for (const key of performanceHistory.keys()) {
    if (key.startsWith(userId)) {
      performanceHistory.delete(key);
    }
  }
}

/**
 * Clear all skill data (for testing)
 */
export function _clearAllSkillData(): void {
  skillEstimates.clear();
  performanceHistory.clear();
}
