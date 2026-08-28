/**
 * GTX Rush — Recommendation Service v1.0
 *
 * Server-authoritative recommendation system that handles:
 * - Home page recommendations
 * - Game recommendations
 * - Event recommendations
 * - Mission recommendations
 * - Social recommendations
 * - Goal recommendations
 *
 * SECURITY:
 * - All recommendation logic is server-side
 * - No revenue-based ranking of core gameplay
 * - Deterministic fallbacks for all recommendations
 *
 * Contract: AI Personalization Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  GameId,
  RecommendationCandidate,
  RecommendationScore,
  HomeRecommendations,
  PersonalBestCoach,
  SmartDailyPlan,
  SmartPlanTask,
  PlayerGoal,
  EngagementLevel,
} from '@gtx-rush/types';
import {
  RECOMMENDATION_CONFIG,
  COLD_START_CONFIG,
} from '@gtx-rush/config';
import {
  getPlayerProfile,
  isNewUser,
  getGamePreferences,
  getPlayerSkillBand,
  getEngagementLevelForUser,
  recordGamePlay,
} from './preference-engine';
import { getUserSkillEstimates } from './skill-estimation';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const recommendationCache = new Map<string, {
  data: HomeRecommendations;
  expiresAt: Date;
}>();

const recommendationEvents = new Map<string, RecommendationEvent[]>(); // userId → events

// ============================================================
// Types
// ============================================================

interface RecommendationEvent {
  recommendationId: string;
  action: 'shown' | 'clicked' | 'completed' | 'dismissed';
  timestamp: Date;
}

// ============================================================
// Home Recommendations
// ============================================================

/**
 * Get personalized home recommendations
 */
export function getHomeRecommendations(userId: string): HomeRecommendations {
  // Check cache
  const cached = recommendationCache.get(userId);
  if (cached && cached.expiresAt > new Date()) {
    return cached.data;
  }

  // Get player profile
  const profile = getPlayerProfile(userId);
  const isNew = isNewUser(userId);

  // Build recommendations
  const candidates = isNew
    ? getColdStartRecommendations(userId)
    : getPersonalizedRecommendations(userId);

  // Add exploration component
  const withExploration = addExplorationComponent(candidates, isNew);

  // Sort by score and limit
  const sorted = withExploration
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMENDATION_CONFIG.maxRecommendations);

  // Build personal best coach
  const personalBestCoach = getPersonalBestCoach(userId);

  // Build smart daily plan
  const smartPlan = getSmartDailyPlan(userId);

  // Build welcome message
  const welcomeMessage = getWelcomeMessage(userId, profile.engagementLevel);

  const result: HomeRecommendations = {
    recommendations: sorted,
    personalBestCoach,
    smartPlan,
    welcomeMessage,
  };

  // Cache result
  recommendationCache.set(userId, {
    data: result,
    expiresAt: new Date(Date.now() + RECOMMENDATION_CONFIG.cacheDurationSeconds * 1000),
  });

  return result;
}

// ============================================================
// Recommendation Generation
// ============================================================

function getPersonalizedRecommendations(userId: string): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];
  const profile = getPlayerProfile(userId);
  const skillEstimates = getUserSkillEstimates(userId);

  // Game recommendations
  candidates.push(...getGameRecommendations(userId, profile.primaryGame));

  // Event recommendations (if available)
  candidates.push(...getEventRecommendations(userId, profile.primaryGame));

  // Mission recommendations
  candidates.push(...getMissionRecommendations(userId, profile.primaryGame));

  // Social recommendations
  candidates.push(...getSocialRecommendations(userId));

  // Goal recommendations
  candidates.push(...getGoalRecommendations(userId));

  return candidates;
}

function getGameRecommendations(userId: string, preferredGame: GameId | null): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];
  const games: GameId[] = ['reaction-rush', 'tap-rush', 'quiz-rush'];

  for (const gameId of games) {
    const skillBand = getPlayerSkillBand(userId, gameId);
    const isPreferred = gameId === preferredGame;

    // Score based on preference and skill
    let score = 0;
    let reason = '';

    if (isPreferred) {
      score = 0.8;
      reason = 'Your most played game';
    } else if (skillBand === 'advanced' || skillBand === 'expert') {
      score = 0.6;
      reason = `You're skilled at ${getGameName(gameId)}`;
    } else {
      score = 0.4;
      reason = `Try ${getGameName(gameId)}`;
    }

    candidates.push({
      id: nanoid(),
      type: 'game',
      title: getGameName(gameId),
      description: `Play ${getGameName(gameId)}`,
      reason,
      gameId,
      eventId: null,
      missionId: null,
      score,
      metadata: { skillBand },
    });
  }

  return candidates;
}

function getEventRecommendations(userId: string, preferredGame: GameId | null): RecommendationCandidate[] {
  // In production, fetch from event engine
  // For now, return sample recommendations
  return [
    {
      id: nanoid(),
      type: 'event',
      title: 'Daily Rush',
      description: 'Today\'s competitive event',
      reason: 'Compete for the top spot',
      gameId: preferredGame ?? 'reaction-rush',
      eventId: 'daily-rush',
      missionId: null,
      score: 0.7,
      metadata: { urgency: 'high' },
    },
  ];
}

function getMissionRecommendations(userId: string, preferredGame: GameId | null): RecommendationCandidate[] {
  // In production, fetch from mission engine
  // For now, return sample recommendations
  return [
    {
      id: nanoid(),
      type: 'mission',
      title: 'Daily Missions',
      description: 'Complete today\'s missions for XP',
      reason: 'Earn bonus XP rewards',
      gameId: null,
      eventId: null,
      missionId: 'daily-missions',
      score: 0.65,
      metadata: {},
    },
  ];
}

function getSocialRecommendations(userId: string): RecommendationCandidate[] {
  // In production, fetch from social engine
  return [
    {
      id: nanoid(),
      type: 'social',
      title: 'Challenge a Friend',
      description: 'Compete with your friends',
      reason: 'Social competition increases fun',
      gameId: null,
      eventId: null,
      missionId: null,
      score: 0.55,
      metadata: {},
    },
  ];
}

function getGoalRecommendations(userId: string): RecommendationCandidate[] {
  // In production, fetch from goal system
  return [
    {
      id: nanoid(),
      type: 'goal',
      title: 'Set a Goal',
      description: 'Track your progress',
      reason: 'Goals help you improve',
      gameId: null,
      eventId: null,
      missionId: null,
      score: 0.5,
      metadata: {},
    },
  ];
}

function getColdStartRecommendations(userId: string): RecommendationCandidate[] {
  return COLD_START_CONFIG.defaultRecommendations.map((rec) => ({
    id: nanoid(),
    type: 'game' as const,
    title: rec.title,
    description: `Try ${rec.title}`,
    reason: rec.reason,
    gameId: rec.gameId,
    eventId: null,
    missionId: null,
    score: 0.6,
    metadata: {},
  }));
}

// ============================================================
// Scoring
// ============================================================

function calculateRecommendationScore(
  candidate: RecommendationCandidate,
  userId: string,
): number {
  const profile = getPlayerProfile(userId);
  const weights = RECOMMENDATION_CONFIG.weights;

  // Calculate individual scores
  const preference = calculatePreferenceScore(candidate, profile.primaryGame);
  const recency = 0.5; // Default
  const difficultyFit = calculateDifficultyFitScore(candidate, userId);
  const socialRelevance = candidate.type === 'social' ? 0.8 : 0.3;
  const eventUrgency = candidate.metadata.urgency === 'high' ? 0.9 : 0.5;
  const goalRelevance = candidate.type === 'goal' ? 0.8 : 0.4;

  // Weighted sum
  return (
    preference * weights.preference +
    recency * weights.recency +
    difficultyFit * weights.difficultyFit +
    socialRelevance * weights.socialRelevance +
    eventUrgency * weights.eventUrgency +
    goalRelevance * weights.goalRelevance
  );
}

function calculatePreferenceScore(candidate: RecommendationCandidate, primaryGame: GameId | null): number {
  if (!candidate.gameId) return 0.5;
  if (candidate.gameId === primaryGame) return 0.9;
  return 0.5;
}

function calculateDifficultyFitScore(candidate: RecommendationCandidate, userId: string): number {
  if (!candidate.gameId) return 0.5;
  const skillBand = getPlayerSkillBand(userId, candidate.gameId);
  // Recommend games that match skill level
  if (skillBand === 'beginner') return 0.8; // Encourage practice
  if (skillBand === 'intermediate') return 0.7;
  if (skillBand === 'advanced') return 0.6;
  if (skillBand === 'expert') return 0.5;
  return 0.4; // Elite players want challenge
}

function addExplorationComponent(
  candidates: RecommendationCandidate[],
  isNewUser: boolean,
): RecommendationCandidate[] {
  const explorationRatio = isNewUser
    ? COLD_START_CONFIG.coldStartExplorationRatio
    : RECOMMENDATION_CONFIG.explorationRatio;

  // Add exploration bonus to some candidates
  return candidates.map((c) => ({
    ...c,
    score: c.score * (1 - explorationRatio) + Math.random() * explorationRatio,
  }));
}

// ============================================================
// Personal Best Coach
// ============================================================

function getPersonalBestCoach(userId: string): PersonalBestCoach | null {
  const profile = getPlayerProfile(userId);
  if (!profile.primaryGame) return null;

  // In production, fetch actual personal best data
  // For now, return sample data
  const currentScore = 9842;
  const previousBest = 9510;
  const isNewBest = currentScore > previousBest;
  const percentImprovement = ((currentScore - previousBest) / previousBest) * 100;

  let message = '';
  if (isNewBest) {
    message = `New personal best! +${Math.round(percentImprovement)}% improvement!`;
  } else {
    const percentAway = ((previousBest - currentScore) / previousBest) * 100;
    message = `You're ${Math.round(percentAway)}% away from your personal best.`;
  }

  return {
    gameId: profile.primaryGame,
    currentScore,
    previousBest,
    isNewBest,
    percentImprovement: Math.round(percentImprovement),
    message,
  };
}

// ============================================================
// Smart Daily Plan
// ============================================================

function getSmartDailyPlan(userId: string): SmartDailyPlan {
  const tasks: SmartPlanTask[] = [];

  // Add tasks based on profile
  tasks.push({
    id: nanoid(),
    type: 'mission',
    title: 'Complete Daily Rush',
    description: 'Compete in today\'s event',
    completed: false,
    estimatedMinutes: 2,
  });

  tasks.push({
    id: nanoid(),
    type: 'mission',
    title: 'Finish 2 missions',
    description: 'Earn XP rewards',
    completed: false,
    estimatedMinutes: 5,
  });

  tasks.push({
    id: nanoid(),
    type: 'challenge',
    title: 'Challenge a friend',
    description: 'Social competition',
    completed: false,
    estimatedMinutes: 3,
  });

  const estimatedTime = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const completedTasks = tasks.filter((t) => t.completed).length;

  return {
    tasks: tasks.slice(0, 5),
    estimatedTimeMinutes: estimatedTime,
    completionPercentage: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
  };
}

// ============================================================
// Welcome Message
// ============================================================

function getWelcomeMessage(userId: string, engagementLevel: EngagementLevel): string {
  switch (engagementLevel) {
    case 'inactive':
      return 'Welcome back! We missed you.';
    case 'returning':
      return 'Good to see you again!';
    case 'active':
      return 'Welcome back!';
    case 'power':
      return 'Welcome back, champion!';
    default:
      return 'Welcome to GTX Rush!';
  }
}

// ============================================================
// Utility Functions
// ============================================================

function getGameName(gameId: GameId): string {
  const names: Record<GameId, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  return names[gameId] ?? gameId;
}

// ============================================================
// Tracking
// ============================================================

/**
 * Track recommendation interaction
 */
export function trackRecommendation(
  userId: string,
  recommendationId: string,
  action: 'shown' | 'clicked' | 'completed' | 'dismissed',
): void {
  const events = recommendationEvents.get(userId) ?? [];
  events.push({
    recommendationId,
    action,
    timestamp: new Date(),
  });
  recommendationEvents.set(userId, events);
}

/**
 * Get recommendation analytics
 */
export function getRecommendationAnalytics(userId: string): {
  totalShown: number;
  totalClicked: number;
  totalCompleted: number;
  totalDismissed: number;
  clickThroughRate: number;
} {
  const events = recommendationEvents.get(userId) ?? [];
  const totalShown = events.filter((e) => e.action === 'shown').length;
  const totalClicked = events.filter((e) => e.action === 'clicked').length;
  const totalCompleted = events.filter((e) => e.action === 'completed').length;
  const totalDismissed = events.filter((e) => e.action === 'dismissed').length;

  return {
    totalShown,
    totalClicked,
    totalCompleted,
    totalDismissed,
    clickThroughRate: totalShown > 0 ? totalClicked / totalShown : 0,
  };
}

/**
 * Clear recommendation cache
 */
export function clearRecommendationCache(userId?: string): void {
  if (userId) {
    recommendationCache.delete(userId);
  } else {
    recommendationCache.clear();
  }
}

/**
 * Clear user recommendation data (for testing)
 */
export function _clearUserRecommendationData(userId: string): void {
  recommendationCache.delete(userId);
  recommendationEvents.delete(userId);
}

/**
 * Clear all recommendation data (for testing)
 */
export function _clearAllRecommendationData(): void {
  recommendationCache.clear();
  recommendationEvents.clear();
}
