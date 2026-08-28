/**
 * GTX Rush — Mission Engine v1.0
 *
 * Configuration-driven mission system that handles:
 * - Mission definition management
 * - Daily/weekly/monthly mission generation
 * - Server-authoritative mission progress
 * - Mission completion and reward claiming
 * - Idempotent operations
 *
 * SECURITY:
 * - All progress updates are server-authoritative
 * - Client cannot send progress events directly
 * - Mission definitions are versioned and immutable
 * - Reward claiming is idempotent
 *
 * Contract: Retention Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  MissionDefinition,
  MissionType,
  MissionFrequency,
  MissionDifficulty,
  MissionStatus,
  MissionProgressEvent,
  MissionEventType,
  UserMission,
  UserMissionWithDefinition,
  MissionConfiguration,
  MissionRewardConfiguration,
} from '@gtx-rush/types';
import {
  DAILY_MISSION_TEMPLATES,
  WEEKLY_MISSION_TEMPLATES,
  MONTHLY_MISSION_TEMPLATES,
  NEW_USER_MISSIONS,
  DAILY_MISSION_GENERATION_CONFIG,
  getTemplatesForLevel,
  getCurrentPeriod,
  REWARD_CONFIG,
} from '@gtx-rush/config';
import type { MissionTemplate } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const missionDefinitions = new Map<string, MissionDefinition>();
const userMissions = new Map<string, UserMission>();

// Index: userId + period → mission IDs
const userMissionsByPeriod = new Map<string, string[]>();

// ============================================================
// Mission Definition Management
// ============================================================

/**
 * Initialize mission definitions from templates.
 * Called once at startup or when templates change.
 */
export function initializeMissionDefinitions(): void {
  const allTemplates = [
    ...DAILY_MISSION_TEMPLATES,
    ...WEEKLY_MISSION_TEMPLATES,
    ...MONTHLY_MISSION_TEMPLATES,
    ...NEW_USER_MISSIONS,
  ];

  for (const template of allTemplates) {
    const definition: MissionDefinition = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      target: template.target,
      gameId: template.gameId,
      configuration: template.configuration,
      rewardConfiguration: template.rewardConfiguration,
      frequency: template.frequency,
      difficulty: template.difficulty,
      status: 'active',
      version: template.version,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    missionDefinitions.set(definition.id, definition);
  }
}

/**
 * Get a mission definition by ID.
 */
export function getMissionDefinition(missionId: string): MissionDefinition | null {
  return missionDefinitions.get(missionId) ?? null;
}

/**
 * Get all active mission definitions for a frequency.
 */
export function getActiveMissionDefinitions(frequency: MissionFrequency): MissionDefinition[] {
  return Array.from(missionDefinitions.values()).filter(
    (d) => d.status === 'active' && d.frequency === frequency,
  );
}

// ============================================================
// Mission Generation
// ============================================================

/**
 * Generate daily missions for a user.
 *
 * Algorithm:
 * 1. Check if user already has missions for today
 * 2. Filter templates by user level
 * 3. Select missions based on weight and variety
 * 4. Create user mission instances
 *
 * SECURITY: Mission generation is server-authoritative.
 * The client cannot request specific missions.
 */
export function generateDailyMissions(userId: string, userLevel: number): UserMissionWithDefinition[] {
  const period = getCurrentPeriod('daily');

  // Check if user already has missions for today
  const existingMissions = getUserMissionsForPeriod(userId, 'daily', period);
  if (existingMissions.length > 0) {
    return existingMissions;
  }

  // Get templates for user level
  let templates = getTemplatesForLevel(userLevel, 'daily');

  // For new users (level 1-2), prioritize new user missions
  if (userLevel <= 2) {
    const newUserTemplates = NEW_USER_MISSIONS.filter(
      (t) => userLevel >= t.minLevel && (t.maxLevel === 0 || userLevel <= t.maxLevel),
    );
    if (newUserTemplates.length > 0) {
      templates = [...newUserTemplates, ...templates.filter((t) => !t.id.startsWith('new_user_'))];
    }
  }

  // Select missions based on weight and variety
  const selectedTemplates = selectMissionTemplates(
    templates,
    DAILY_MISSION_GENERATION_CONFIG.dailyMissionCount,
    DAILY_MISSION_GENERATION_CONFIG,
  );

  // Create user mission instances
  const userMissionsForDay: UserMissionWithDefinition[] = [];

  for (const template of selectedTemplates) {
    const definition = missionDefinitions.get(template.id);
    if (!definition) continue;

    const userMission: UserMission = {
      id: nanoid(),
      userId,
      missionId: template.id,
      period,
      progress: 0,
      target: template.target,
      status: 'active',
      completedAt: null,
      rewardClaimedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userMissions.set(userMission.id, userMission);

    // Update index
    const indexKey = `${userId}:${period}`;
    const existing = userMissionsByPeriod.get(indexKey) ?? [];
    existing.push(userMission.id);
    userMissionsByPeriod.set(indexKey, existing);

    userMissionsForDay.push({
      ...userMission,
      mission: definition,
    });
  }

  return userMissionsForDay;
}

/**
 * Generate weekly missions for a user.
 */
export function generateWeeklyMissions(userId: string, userLevel: number): UserMissionWithDefinition[] {
  const period = getCurrentPeriod('weekly');

  // Check if user already has missions for this week
  const existingMissions = getUserMissionsForPeriod(userId, 'weekly', period);
  if (existingMissions.length > 0) {
    return existingMissions;
  }

  const templates = getTemplatesForLevel(userLevel, 'weekly');
  const selectedTemplates = templates.slice(0, 2); // 2 weekly missions

  const userMissionsForWeek: UserMissionWithDefinition[] = [];

  for (const template of selectedTemplates) {
    const definition = missionDefinitions.get(template.id);
    if (!definition) continue;

    const userMission: UserMission = {
      id: nanoid(),
      userId,
      missionId: template.id,
      period,
      progress: 0,
      target: template.target,
      status: 'active',
      completedAt: null,
      rewardClaimedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userMissions.set(userMission.id, userMission);

    const indexKey = `${userId}:${period}`;
    const existing = userMissionsByPeriod.get(indexKey) ?? [];
    existing.push(userMission.id);
    userMissionsByPeriod.set(indexKey, existing);

    userMissionsForWeek.push({
      ...userMission,
      mission: definition,
    });
  }

  return userMissionsForWeek;
}

/**
 * Select mission templates based on weight and variety constraints.
 */
function selectMissionTemplates(
  templates: MissionTemplate[],
  count: number,
  config: typeof DAILY_MISSION_GENERATION_CONFIG,
): MissionTemplate[] {
  const selected: MissionTemplate[] = [];
  const usedTypes = new Set<MissionType>();
  const usedGames = new Set<string | null>();

  // Sort by weight (descending)
  const sorted = [...templates].sort((a, b) => b.weight - a.weight);

  // First pass: ensure difficulty distribution
  const easyMissions = sorted.filter((t) => t.difficulty === 'easy');
  const mediumMissions = sorted.filter((t) => t.difficulty === 'medium');
  const hardMissions = sorted.filter((t) => t.difficulty === 'hard');

  // Add minimum required missions
  for (let i = 0; i < config.minEasyMissions && i < easyMissions.length && selected.length < count; i++) {
    if (tryAddMission(selected, easyMissions[i]!, usedTypes, usedGames)) {
      // Mission added
    }
  }

  for (let i = 0; i < config.minMediumMissions && i < mediumMissions.length && selected.length < count; i++) {
    if (tryAddMission(selected, mediumMissions[i]!, usedTypes, usedGames)) {
      // Mission added
    }
  }

  for (let i = 0; i < config.minHardMissions && i < hardMissions.length && selected.length < count; i++) {
    if (tryAddMission(selected, hardMissions[i]!, usedTypes, usedGames)) {
      // Mission added
    }
  }

  // Fill remaining slots with weighted random selection
  for (const template of sorted) {
    if (selected.length >= count) break;
    if (selected.find((s) => s.id === template.id)) continue;

    if (tryAddMission(selected, template, usedTypes, usedGames)) {
      // Mission added
    }
  }

  return selected;
}

/**
 * Try to add a mission to the selection.
 * Returns true if added, false if skipped.
 */
function tryAddMission(
  selected: MissionTemplate[],
  template: MissionTemplate,
  usedTypes: Set<MissionType>,
  usedGames: Set<string | null>,
): boolean {
  // Check type variety
  if (usedTypes.has(template.type)) {
    return false;
  }

  // Check game variety if enabled
  if (DAILY_MISSION_GENERATION_CONFIG.ensureGameVariety && usedGames.has(template.gameId)) {
    return false;
  }

  selected.push(template);
  usedTypes.add(template.type);
  usedGames.add(template.gameId);
  return true;
}

// ============================================================
// Mission Progress
// ============================================================

/**
 * Process a mission progress event.
 *
 * SECURITY:
 * - Progress is only updated for active missions
 * - Progress cannot exceed target
 * - Events are processed server-side only
 */
export function processMissionProgress(event: MissionProgressEvent): UserMission[] {
  const updatedMissions: UserMission[] = [];
  const period = getCurrentPeriod('daily');
  const weeklyPeriod = getCurrentPeriod('weekly');

  // Get user's active missions for all frequencies
  const dailyMissions = getUserMissionsForPeriod(event.userId, 'daily', period);
  const weeklyMissions = getUserMissionsForPeriod(event.userId, 'weekly', weeklyPeriod);

  const allActiveMissions = [...dailyMissions, ...weeklyMissions].filter(
    (m) => m.status === 'active',
  );

  for (const userMission of allActiveMissions) {
    const definition = missionDefinitions.get(userMission.missionId);
    if (!definition) continue;

    // Check if this event matches the mission type
    if (!isEventMatchingMission(event, definition)) {
      continue;
    }

    // Update progress
    const progressIncrement = calculateProgressIncrement(event, definition);
    if (progressIncrement <= 0) {
      continue;
    }

    const newProgress = Math.min(userMission.progress + progressIncrement, userMission.target);
    const wasCompleted = userMission.status === 'completed';
    const isNowCompleted = newProgress >= userMission.target;

    userMission.progress = newProgress;
    userMission.updatedAt = new Date();

    if (isNowCompleted && !wasCompleted) {
      userMission.status = 'completed';
      userMission.completedAt = new Date();
    }

    updatedMissions.push(userMission);
  }

  return updatedMissions;
}

/**
 * Check if an event matches a mission definition.
 */
function isEventMatchingMission(
  event: MissionProgressEvent,
  definition: MissionDefinition,
): boolean {
  // Check mission type
  const eventTypeMap: Record<MissionType, MissionEventType[]> = {
    'PLAY_GAME': ['GAME_COMPLETED'],
    'COMPLETE_GAME': ['GAME_COMPLETED'],
    'SCORE_THRESHOLD': ['SCORE_RECORDED'],
    'WIN_CHALLENGE': ['CHALLENGE_WON'],
    'COMPLETE_DAILY_RUSH': ['DAILY_RUSH_COMPLETED'],
    'ACHIEVE_COMBO': ['COMBO_ACHIEVED'],
    'ACHIEVE_ACCURACY': ['ACCURACY_ACHIEVED'],
    'ANSWER_CORRECTLY': ['CORRECT_ANSWER'],
    'SET_PERSONAL_BEST': ['PERSONAL_BEST'],
    'SHARE_RESULT': ['SHARE_RESULT'],
  };

  const matchingEvents = eventTypeMap[definition.type] ?? [];
  if (!matchingEvents.includes(event.eventType)) {
    return false;
  }

  // Check game ID if specified
  if (definition.gameId && event.gameId !== definition.gameId) {
    return false;
  }

  // Check configuration-specific conditions
  const config = definition.configuration;

  if (definition.type === 'SCORE_THRESHOLD' && config.minScore) {
    const score = event.metadata.score ?? 0;
    if (score < config.minScore) {
      return false;
    }
  }

  if (definition.type === 'ACHIEVE_COMBO' && config.comboThreshold) {
    const combo = event.metadata.combo ?? 0;
    if (combo < config.comboThreshold) {
      return false;
    }
  }

  if (definition.type === 'ACHIEVE_ACCURACY' && config.minAccuracy) {
    const accuracy = event.metadata.accuracy ?? 0;
    if (accuracy < config.minAccuracy) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate progress increment based on event and mission type.
 */
function calculateProgressIncrement(
  event: MissionProgressEvent,
  definition: MissionDefinition,
): number {
  switch (definition.type) {
    case 'PLAY_GAME':
    case 'COMPLETE_GAME':
    case 'COMPLETE_DAILY_RUSH':
    case 'WIN_CHALLENGE':
    case 'SET_PERSONAL_BEST':
    case 'SHARE_RESULT':
      return 1; // One completion

    case 'SCORE_THRESHOLD':
      return event.metadata.score ?? 0; // Cumulative score

    case 'ANSWER_CORRECTLY':
      return event.metadata.correctAnswers ?? 1;

    case 'ACHIEVE_COMBO':
      return event.metadata.combo ?? 0;

    case 'ACHIEVE_ACCURACY':
      return event.metadata.accuracy ?? 0;

    default:
      return 0;
  }
}

// ============================================================
// Mission Completion & Reward Claiming
// ============================================================

/**
 * Claim a mission reward.
 *
 * SECURITY:
 * - Reward claiming is idempotent
 * - Duplicate claims are prevented
 * - Reward configuration is server-authoritative
 */
export function claimMissionReward(
  userId: string,
  userMissionId: string,
): {
  success: boolean;
  reward?: MissionRewardConfiguration;
  error?: string;
} {
  const userMission = userMissions.get(userMissionId);

  if (!userMission) {
    return { success: false, error: 'MISSION_NOT_FOUND' };
  }

  if (userMission.userId !== userId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (userMission.status !== 'completed') {
    return { success: false, error: 'MISSION_NOT_COMPLETED' };
  }

  // Idempotent: already claimed
  if (userMission.rewardClaimedAt) {
    return { success: false, error: 'ALREADY_CLAIMED' };
  }

  const definition = missionDefinitions.get(userMission.missionId);
  if (!definition) {
    return { success: false, error: 'MISSION_DEFINITION_NOT_FOUND' };
  }

  // Mark as claimed
  userMission.status = 'claimed';
  userMission.rewardClaimedAt = new Date();
  userMission.updatedAt = new Date();

  return {
    success: true,
    reward: definition.rewardConfiguration,
  };
}

// ============================================================
// Mission Queries
// ============================================================

/**
 * Get user's missions for a specific period.
 */
export function getUserMissionsForPeriod(
  userId: string,
  frequency: MissionFrequency,
  period: string,
): UserMissionWithDefinition[] {
  const indexKey = `${userId}:${period}`;
  const missionIds = userMissionsByPeriod.get(indexKey) ?? [];

  const missions: UserMissionWithDefinition[] = [];
  for (const missionId of missionIds) {
    const userMission = userMissions.get(missionId);
    if (!userMission) continue;

    const definition = missionDefinitions.get(userMission.missionId);
    if (!definition) continue;

    // Filter by frequency
    if (definition.frequency !== frequency) continue;

    missions.push({
      ...userMission,
      mission: definition,
    });
  }

  return missions;
}

/**
 * Get user's daily missions for today.
 */
export function getUserDailyMissions(userId: string): UserMissionWithDefinition[] {
  const period = getCurrentPeriod('daily');
  return getUserMissionsForPeriod(userId, 'daily', period);
}

/**
 * Get user's weekly missions for this week.
 */
export function getUserWeeklyMissions(userId: string): UserMissionWithDefinition[] {
  const period = getCurrentPeriod('weekly');
  return getUserMissionsForPeriod(userId, 'weekly', period);
}

/**
 * Get mission progress for a user.
 */
export function getMissionProgress(
  userId: string,
  userMissionId: string,
): {
  missionId: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardClaimable: boolean;
} | null {
  const userMission = userMissions.get(userMissionId);

  if (!userMission || userMission.userId !== userId) {
    return null;
  }

  return {
    missionId: userMission.missionId,
    progress: userMission.progress,
    target: userMission.target,
    completed: userMission.status === 'completed' || userMission.status === 'claimed',
    rewardClaimable: userMission.status === 'completed',
  };
}

// ============================================================
// Mission Expiration
// ============================================================

/**
 * Expire missions for a given period.
 * Called by scheduled jobs when a period ends.
 */
export function expireMissionsForPeriod(period: string): number {
  let expiredCount = 0;

  for (const userMission of userMissions.values()) {
    if (userMission.period === period && userMission.status === 'active') {
      userMission.status = 'expired';
      userMission.updatedAt = new Date();
      expiredCount++;
    }
  }

  return expiredCount;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllMissions(): void {
  missionDefinitions.clear();
  userMissions.clear();
  userMissionsByPeriod.clear();
}

export function _getMissionDefinitionCount(): number {
  return missionDefinitions.size;
}

export function _getUserMissionCount(userId: string): number {
  return Array.from(userMissions.values()).filter((m) => m.userId === userId).length;
}


