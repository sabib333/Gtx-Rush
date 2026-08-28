/**
 * GTX Rush — Player Preference Engine v1.0
 *
 * Server-authoritative player preference system that handles:
 * - Game preference tracking
 * - Skill estimation
 * - Engagement tracking
 * - Player behavior analysis
 *
 * SECURITY:
 * - All data is server-generated
 * - No client-side profiling
 * - Privacy-respecting data collection
 *
 * Contract: AI Personalization Contract v1.0
 */

import type {
  GameId,
  GamePreference,
  SkillEstimate,
  PlayerPreferenceProfile,
  EngagementLevel,
  SkillBand,
} from '@gtx-rush/types';
import {
  GAME_PREFERENCE_CONFIG,
  SKILL_CONFIG,
  ENGAGEMENT_CONFIG,
  getSkillBand,
  getEngagementLevel,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const playerProfiles = new Map<string, PlayerPreferenceProfile>();
const gamePlayHistory = new Map<string, GamePlayEvent[]>(); // userId → events
const dailyStats = new Map<string, DailyStats>(); // userId:YYYY-MM-DD → stats

// ============================================================
// Types
// ============================================================

interface GamePlayEvent {
  id: string;
  userId: string;
  gameId: GameId;
  score: number;
  completed: boolean;
  duration: number; // seconds
  isPersonalBest: boolean;
  isEventGame: boolean;
  isChallengeGame: boolean;
  timestamp: Date;
}

interface DailyStats {
  userId: string;
  date: string;
  gamesPlayed: number;
  gamesCompleted: number;
  totalScore: number;
  bestScore: number;
  sessionsPlayed: number;
}

// ============================================================
// Profile Management
// ============================================================

/**
 * Get or create player preference profile
 */
export function getPlayerProfile(userId: string): PlayerPreferenceProfile {
  const existing = playerProfiles.get(userId);
  if (existing) return existing;

  // Create new profile
  const profile: PlayerPreferenceProfile = {
    userId,
    primaryGame: null,
    secondaryGame: null,
    gamePreferences: [],
    skillEstimates: [],
    averageSessionLength: 0,
    gamesPerSession: 0,
    preferredPlayTime: null,
    missionCompletionRate: 0,
    eventParticipationRate: 0,
    challengeActivity: 0,
    socialActivity: 0,
    engagementLevel: 'active',
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  playerProfiles.set(userId, profile);
  return profile;
}

/**
 * Update player profile with new gameplay data
 */
export function updatePlayerProfile(
  userId: string,
  event: GamePlayEvent,
): PlayerPreferenceProfile {
  const profile = getPlayerProfile(userId);

  // Update game preferences
  updateGamePreferences(profile, event);

  // Update skill estimates
  updateSkillEstimates(profile, event);

  // Update engagement metrics
  updateEngagementMetrics(profile, event);

  // Update session stats
  updateSessionStats(profile, event);

  // Update timestamp
  profile.lastActive = new Date();
  profile.updatedAt = new Date();

  playerProfiles.set(userId, profile);
  return profile;
}

// ============================================================
// Game Preference Calculation
// ============================================================

function updateGamePreferences(profile: PlayerPreferenceProfile, event: GamePlayEvent): void {
  const existing = profile.gamePreferences.find((p) => p.gameId === event.gameId);

  if (existing) {
    // Update existing preference
    existing.gamesPlayed += 1;
    if (event.completed) existing.gamesCompleted += 1;
    if (event.isPersonalBest) existing.personalBestAttempts += 1;
    if (event.isEventGame) existing.eventParticipation += 1;
    existing.averageScore = calculateNewAverage(existing.averageScore, event.score, existing.gamesPlayed);
    existing.bestScore = Math.max(existing.bestScore, event.score);
    existing.lastPlayed = new Date();

    // Update repeat sessions (approximate)
    if (existing.gamesPlayed > 1) {
      existing.repeatSessions = Math.floor(existing.gamesPlayed / 3);
    }
  } else {
    // Create new preference
    const newPreference: GamePreference = {
      gameId: event.gameId,
      preferenceScore: 0,
      gamesPlayed: 1,
      gamesCompleted: event.completed ? 1 : 0,
      repeatSessions: 0,
      personalBestAttempts: event.isPersonalBest ? 1 : 0,
      eventParticipation: event.isEventGame ? 1 : 0,
      averageScore: event.score,
      bestScore: event.score,
      lastPlayed: new Date(),
    };
    profile.gamePreferences.push(newPreference);
  }

  // Recalculate preference scores
  recalculateAllPreferences(profile);

  // Update primary/secondary games
  updatePrimarySecondaryGames(profile);
}

function recalculateAllPreferences(profile: PlayerPreferenceProfile): void {
  for (const pref of profile.gamePreferences) {
    pref.preferenceScore = calculatePreferenceScore(pref);
  }
}

function calculatePreferenceScore(pref: GamePreference): number {
  const weights = GAME_PREFERENCE_CONFIG.weights;

  // Normalize values to 0-1
  const gamesPlayedNorm = Math.min(pref.gamesPlayed / 50, 1);
  const gamesCompletedNorm = pref.gamesPlayed > 0
    ? pref.gamesCompleted / pref.gamesPlayed
    : 0;
  const repeatSessionsNorm = Math.min(pref.repeatSessions / 20, 1);
  const personalBestNorm = Math.min(pref.personalBestAttempts / 10, 1);
  const eventParticipationNorm = Math.min(pref.eventParticipation / 10, 1);
  const averageScoreNorm = Math.min(pref.averageScore / 10000, 1);

  // Weighted sum
  const score = (
    gamesPlayedNorm * weights.gamesPlayed +
    gamesCompletedNorm * weights.gamesCompleted +
    repeatSessionsNorm * weights.repeatSessions +
    personalBestNorm * weights.personalBestAttempts +
    eventParticipationNorm * weights.eventParticipation +
    averageScoreNorm * weights.averageScore
  ) * GAME_PREFERENCE_CONFIG.maxPreferenceScore;

  return Math.round(Math.min(score, GAME_PREFERENCE_CONFIG.maxPreferenceScore));
}

function updatePrimarySecondaryGames(profile: PlayerPreferenceProfile): void {
  // Sort by preference score
  const sorted = [...profile.gamePreferences].sort((a, b) => b.preferenceScore - a.preferenceScore);

  profile.primaryGame = sorted[0]?.gameId ?? null;
  profile.secondaryGame = sorted[1]?.gameId ?? null;
}

// ============================================================
// Skill Estimation
// ============================================================

function updateSkillEstimates(profile: PlayerPreferenceProfile, event: GamePlayEvent): void {
  const existing = profile.skillEstimates.find((s) => s.gameId === event.gameId);

  if (existing) {
    // Update existing skill estimate
    const performanceScore = calculatePerformanceScore(event);
    const recentWeight = SKILL_CONFIG.recentPerformanceWeight;
    const oldWeight = 1 - recentWeight;

    existing.recentPerformance = performanceScore;
    existing.averagePerformance = (existing.averagePerformance * oldWeight) + (performanceScore * recentWeight);
    existing.gamesPlayed += 1;
    existing.skillScore = calculateSkillScore(existing);
    existing.skillBand = getSkillBand(existing.skillScore);

    // Calculate improvement rate (simplified)
    if (existing.gamesPlayed > 5) {
      const improvement = performanceScore - existing.averagePerformance;
      existing.improvementRate = Math.max(-1, Math.min(1, improvement / 100));
    }

    existing.lastUpdated = new Date();
  } else {
    // Create new skill estimate
    const performanceScore = calculatePerformanceScore(event);
    const newEstimate: SkillEstimate = {
      gameId: event.gameId,
      skillScore: performanceScore,
      skillBand: getSkillBand(performanceScore),
      gamesPlayed: 1,
      averagePerformance: performanceScore,
      recentPerformance: performanceScore,
      improvementRate: 0,
      lastUpdated: new Date(),
    };
    profile.skillEstimates.push(newEstimate);
  }
}

function calculatePerformanceScore(event: GamePlayEvent): number {
  // Simplified performance calculation
  // In production, this would use game-specific metrics
  const baseScore = Math.min(event.score / 100, 100);
  const completionBonus = event.completed ? 10 : 0;
  const personalBestBonus = event.isPersonalBest ? 15 : 0;

  return Math.min(baseScore + completionBonus + personalBestBonus, 100);
}

function calculateSkillScore(estimate: SkillEstimate): number {
  // Weighted average with smoothing
  const smoothing = SKILL_CONFIG.smoothingFactor;
  return Math.round(
    estimate.averagePerformance * (1 - smoothing) + estimate.recentPerformance * smoothing
  );
}

// ============================================================
// Engagement Tracking
// ============================================================

function updateEngagementMetrics(profile: PlayerPreferenceProfile, event: GamePlayEvent): void {
  const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10);
  const dailyKey = `${profile.userId}:${today}`;

  // Update daily stats
  let stats = dailyStats.get(dailyKey);
  if (!stats) {
    stats = {
      userId: profile.userId,
      date: today,
      gamesPlayed: 0,
      gamesCompleted: 0,
      totalScore: 0,
      bestScore: 0,
      sessionsPlayed: 0,
    };
    dailyStats.set(dailyKey, stats);
  }

  if (stats) {
    stats.gamesPlayed += 1;
    if (event.completed) stats.gamesCompleted += 1;
    stats.totalScore += event.score;
    stats.bestScore = Math.max(stats.bestScore, event.score);
  }

  // Calculate engagement level
  const daysSinceLastSession = calculateDaysSinceLastSession(profile.userId);
  const weeklyStats = getWeeklyStats(profile.userId);
  profile.engagementLevel = getEngagementLevel(
    daysSinceLastSession,
    weeklyStats.gamesPerWeek,
    weeklyStats.daysPerWeek,
  );
}

function calculateDaysSinceLastSession(userId: string): number {
  const profile = playerProfiles.get(userId);
  if (!profile) return 999;

  const now = new Date();
  const lastActive = new Date(profile.lastActive);
  const diffTime = Math.abs(now.getTime() - lastActive.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWeeklyStats(userId: string): { gamesPerWeek: number; daysPerWeek: number } {
  const events = gamePlayHistory.get(userId) ?? [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekEvents = events.filter((e) => new Date(e.timestamp) >= weekAgo);
  const uniqueDays = new Set(weekEvents.map((e) => new Date(e.timestamp).toDateString()));

  return {
    gamesPerWeek: weekEvents.length,
    daysPerWeek: uniqueDays.size,
  };
}

// ============================================================
// Session Stats
// ============================================================

function updateSessionStats(profile: PlayerPreferenceProfile, event: GamePlayEvent): void {
  // Update average session length
  if (event.duration > 0) {
    const currentTotal = profile.averageSessionLength * profile.gamesPerSession;
    profile.gamesPerSession += 1;
    profile.averageSessionLength = (currentTotal + event.duration) / profile.gamesPerSession / 60; // Convert to minutes
  }

  // Update activity rates
  const events = gamePlayHistory.get(profile.userId) ?? [];
  const totalGames = events.length;
  if (totalGames > 0) {
    const eventGames = events.filter((e) => e.isEventGame).length;
    const challengeGames = events.filter((e) => e.isChallengeGame).length;
    profile.eventParticipationRate = eventGames / totalGames;
    profile.challengeActivity = challengeGames;
  }
}

// ============================================================
// Utility Functions
// ============================================================

function calculateNewAverage(currentAvg: number, newValue: number, count: number): number {
  if (count <= 1) return newValue;
  return ((currentAvg * (count - 1)) + newValue) / count;
}

// ============================================================
// Public API
// ============================================================

/**
 * Record a game play event
 */
export function recordGamePlay(
  userId: string,
  gameId: GameId,
  score: number,
  completed: boolean,
  duration: number,
  isPersonalBest: boolean,
  isEventGame: boolean,
  isChallengeGame: boolean,
): PlayerPreferenceProfile {
  const event: GamePlayEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    gameId,
    score,
    completed,
    duration,
    isPersonalBest,
    isEventGame,
    isChallengeGame,
    timestamp: new Date(),
  };

  // Add to history
  const events = gamePlayHistory.get(userId) ?? [];
  events.push(event);
  gamePlayHistory.set(userId, events);

  // Update profile
  return updatePlayerProfile(userId, event);
}

/**
 * Get player's preferred game
 */
export function getPreferredGame(userId: string): GameId | null {
  const profile = getPlayerProfile(userId);
  return profile.primaryGame;
}

/**
 * Get player's skill band for a game
 */
export function getPlayerSkillBand(userId: string, gameId: GameId): SkillBand {
  const profile = getPlayerProfile(userId);
  const skill = profile.skillEstimates.find((s) => s.gameId === gameId);
  return skill?.skillBand ?? 'beginner';
}

/**
 * Get player's engagement level
 */
export function getEngagementLevelForUser(userId: string): EngagementLevel {
  const profile = getPlayerProfile(userId);
  return profile.engagementLevel;
}

/**
 * Get player profile summary
 */
export function getPlayerProfileSummary(userId: string): {
  primaryGame: GameId | null;
  engagementLevel: EngagementLevel;
  totalGamesPlayed: number;
  averageScore: number;
} {
  const profile = getPlayerProfile(userId);
  const totalGames = profile.gamePreferences.reduce((sum, p) => sum + p.gamesPlayed, 0);
  const totalScore = profile.gamePreferences.reduce((sum, p) => sum + (p.averageScore * p.gamesPlayed), 0);

  return {
    primaryGame: profile.primaryGame,
    engagementLevel: profile.engagementLevel,
    totalGamesPlayed: totalGames,
    averageScore: totalGames > 0 ? totalScore / totalGames : 0,
  };
}

/**
 * Get skill estimates for user
 */
export function getSkillEstimates(userId: string): SkillEstimate[] {
  const profile = getPlayerProfile(userId);
  return [...profile.skillEstimates];
}

/**
 * Get game preferences for user
 */
export function getGamePreferences(userId: string): GamePreference[] {
  const profile = getPlayerProfile(userId);
  return [...profile.gamePreferences].sort((a, b) => b.preferenceScore - a.preferenceScore);
}

/**
 * Check if user is new (cold start)
 */
export function isNewUser(userId: string): boolean {
  const events = gamePlayHistory.get(userId) ?? [];
  return events.length < GAME_PREFERENCE_CONFIG.minimumGamesForPreference;
}

/**
 * Clear user data (for testing)
 */
export function _clearUserData(userId: string): void {
  playerProfiles.delete(userId);
  gamePlayHistory.delete(userId);
  // Clear daily stats
  for (const key of dailyStats.keys()) {
    if (key.startsWith(userId)) {
      dailyStats.delete(key);
    }
  }
}

/**
 * Clear all data (for testing)
 */
export function _clearAllData(): void {
  playerProfiles.clear();
  gamePlayHistory.clear();
  dailyStats.clear();
}
