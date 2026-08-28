/**
 * GTX Rush — Goal System Service v1.0
 *
 * Server-authoritative goal system that handles:
 * - Player goal creation
 * - Goal progress tracking
 * - Goal completion
 * - System-suggested goals
 *
 * SECURITY:
 * - All goal progress is server-authoritative
 * - No client manipulation of goal state
 *
 * Contract: AI Personalization Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  PlayerGoal,
  GoalProgress,
  GoalType,
  GoalStatus,
} from '@gtx-rush/types';
import { GOAL_CONFIG } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const playerGoals = new Map<string, PlayerGoal[]>(); // userId → goals

// ============================================================
// Goal Management
// ============================================================

/**
 * Create a new player goal
 */
export function createGoal(
  userId: string,
  type: GoalType,
  target: number,
  title?: string,
  description?: string,
  source: 'system' | 'user' = 'user',
): PlayerGoal | null {
  const goals = playerGoals.get(userId) ?? [];

  // Check maximum active goals
  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length >= GOAL_CONFIG.maxActiveGoals) {
    return null;
  }

  // Check if similar goal already exists
  const existingSimilar = goals.find(
    (g) => g.type === type && g.status === 'active' && g.target === target
  );
  if (existingSimilar) {
    return null;
  }

  // Generate title if not provided
  const finalTitle = title ?? generateGoalTitle(type, target);
  const finalDescription = description ?? generateGoalDescription(type, target);

  const goal: PlayerGoal = {
    id: nanoid(),
    userId,
    type,
    title: finalTitle,
    description: finalDescription,
    target,
    current: 0,
    status: 'active',
    source,
    createdAt: new Date(),
    completedAt: null,
  };

  goals.push(goal);
  playerGoals.set(userId, goals);

  return goal;
}

/**
 * Update goal progress
 */
export function updateGoalProgress(
  userId: string,
  goalId: string,
  increment: number,
): GoalProgress | null {
  const goals = playerGoals.get(userId) ?? [];
  const goal = goals.find((g) => g.id === goalId && g.status === 'active');

  if (!goal) return null;

  // Update progress
  goal.current = Math.min(goal.current + increment, goal.target);

  // Check completion
  if (goal.current >= goal.target) {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  return calculateGoalProgress(goal);
}

/**
 * Get all goals for a user
 */
export function getPlayerGoals(userId: string): PlayerGoal[] {
  return playerGoals.get(userId) ?? [];
}

/**
 * Get active goals for a user
 */
export function getActiveGoals(userId: string): PlayerGoal[] {
  const goals = playerGoals.get(userId) ?? [];
  return goals.filter((g) => g.status === 'active');
}

/**
 * Get completed goals for a user
 */
export function getCompletedGoals(userId: string): PlayerGoal[] {
  const goals = playerGoals.get(userId) ?? [];
  return goals.filter((g) => g.status === 'completed');
}

/**
 * Get goal progress
 */
export function getGoalProgress(userId: string, goalId: string): GoalProgress | null {
  const goals = playerGoals.get(userId) ?? [];
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return null;
  return calculateGoalProgress(goal);
}

/**
 * Get all goal progress for a user
 */
export function getAllGoalProgress(userId: string): GoalProgress[] {
  const goals = playerGoals.get(userId) ?? [];
  return goals.map((g) => calculateGoalProgress(g));
}

/**
 * Abandon a goal
 */
export function abandonGoal(userId: string, goalId: string): boolean {
  const goals = playerGoals.get(userId) ?? [];
  const goal = goals.find((g) => g.id === goalId && g.status === 'active');

  if (!goal) return false;

  goal.status = 'abandoned';
  return true;
}

/**
 * Generate system-suggested goals
 */
export function generateSystemGoals(userId: string): PlayerGoal[] {
  const goals: PlayerGoal[] = [];
  const activeGoals = getActiveGoals(userId);

  // Don't generate too many suggestions
  if (activeGoals.length >= GOAL_CONFIG.maxActiveGoals) {
    return goals;
  }

  // Generate goals based on type
  const types: GoalType[] = ['play_games', 'maintain_streak', 'win_challenges'];

  for (const type of types) {
    if (activeGoals.length + goals.length >= GOAL_CONFIG.maxActiveGoals) break;

    const template = GOAL_CONFIG.templates[type];
    if (!template) continue;

    // Pick a reasonable target
    const target = template.targets[0];
    const goal = createGoal(userId, type, target, undefined, undefined, 'system');
    if (goal) {
      goals.push(goal);
    }
  }

  return goals;
}

/**
 * Check and update goals based on activity
 */
export function processGoalActivity(
  userId: string,
  activityType: 'game_played' | 'game_completed' | 'challenge_won' | 'mission_completed' | 'streak_maintained',
  count: number = 1,
): GoalProgress[] {
  const goals = getActiveGoals(userId);
  const updated: GoalProgress[] = [];

  for (const goal of goals) {
    let shouldUpdate = false;

    switch (goal.type) {
      case 'play_games':
        if (activityType === 'game_played' || activityType === 'game_completed') {
          shouldUpdate = true;
        }
        break;
      case 'complete_missions':
        if (activityType === 'mission_completed') {
          shouldUpdate = true;
        }
        break;
      case 'win_challenges':
        if (activityType === 'challenge_won') {
          shouldUpdate = true;
        }
        break;
      case 'maintain_streak':
        if (activityType === 'streak_maintained') {
          shouldUpdate = true;
        }
        break;
    }

    if (shouldUpdate) {
      const progress = updateGoalProgress(userId, goal.id, count);
      if (progress) {
        updated.push(progress);
      }
    }
  }

  return updated;
}

// ============================================================
// Helper Functions
// ============================================================

function calculateGoalProgress(goal: PlayerGoal): GoalProgress {
  const percentage = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
  const remaining = Math.max(0, goal.target - goal.current);

  return {
    goalId: goal.id,
    current: goal.current,
    target: goal.target,
    percentage: Math.min(percentage, 100),
    remaining,
    isComplete: goal.current >= goal.target,
  };
}

function generateGoalTitle(type: GoalType, target: number): string {
  const templates = GOAL_CONFIG.templates[type];
  if (!templates) return `Complete goal: ${type}`;

  const titleTemplate = templates.titles[0];
  return titleTemplate.replace('{target}', String(target));
}

function generateGoalDescription(type: GoalType, target: number): string {
  const descriptions: Record<GoalType, string> = {
    reach_rank: `Reach rank #${target}`,
    get_personal_best: `Set ${target} new personal best scores`,
    maintain_streak: `Keep a ${target}-day streak`,
    win_challenges: `Win ${target} challenges`,
    complete_missions: `Complete ${target} missions`,
    play_games: `Play ${target} games`,
    join_events: `Join ${target} events`,
  };

  return descriptions[type] ?? `Complete ${target} ${type}`;
}

/**
 * Clear user goals (for testing)
 */
export function _clearUserGoals(userId: string): void {
  playerGoals.delete(userId);
}

/**
 * Clear all goals (for testing)
 */
export function _clearAllGoals(): void {
  playerGoals.clear();
}
