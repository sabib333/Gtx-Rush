/**
 * GTX Rush — Custom Challenge Engine v1.0
 *
 * Server-authoritative custom challenge system that handles:
 * - Challenge creation
 * - Challenge publishing
 * - Challenge versioning
 * - Challenge stats
 * - Challenge visibility
 *
 * SECURITY:
 * - All content is server-validated
 * - No arbitrary code execution
 * - Competitive scores use existing validation
 *
 * Contract: Creator Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  GameId,
  CustomChallenge,
  CustomChallengeRules,
  CustomChallengeConfig,
  ChallengeDifficulty,
  ChallengeVisibility,
  CustomChallengeStatus,
  ChallengeStats,
  ContentQuality,
  ModerationStatus,
  CreateChallengeRequest,
  UpdateChallengeRequest,
  ChallengeVersion,
} from '@gtx-rush/types';
import {
  CHALLENGE_CONFIG,
  GAME_CONFIG_LIMITS,
  CREATOR_FLAGS,
  isTitleValid,
  isDescriptionValid,
  generateChallengeDeepLink,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const challenges = new Map<string, CustomChallenge>();
const creatorChallenges = new Map<string, Set<string>>(); // creatorId → Set of challengeIds
const gameChallenges = new Map<string, Set<string>>(); // gameId → Set of challengeIds
const challengeVersions = new Map<string, ChallengeVersion[]>(); // challengeId → versions

// ============================================================
// Challenge Creation
// ============================================================

/**
 * Create a new custom challenge
 */
export function createChallenge(
  creatorId: string,
  request: CreateChallengeRequest,
): { success: boolean; challenge?: CustomChallenge; error?: string } {
  if (!CREATOR_FLAGS.custom_challenges_enabled) {
    return { success: false, error: 'CUSTOM_CHALLENGES_DISABLED' };
  }

  // Validate title
  const titleValidation = isTitleValid(request.title);
  if (!titleValidation.valid) {
    return { success: false, error: titleValidation.error };
  }

  // Validate description
  if (request.description) {
    const descValidation = isDescriptionValid(request.description);
    if (!descValidation.valid) {
      return { success: false, error: descValidation.error };
    }
  }

  // Validate game-specific config
  const configValidation = validateGameConfig(request.gameId, request.config);
  if (!configValidation.valid) {
    return { success: false, error: configValidation.error };
  }

  // Validate rules
  const rulesValidation = validateRules(request.rules);
  if (!rulesValidation.valid) {
    return { success: false, error: rulesValidation.error };
  }

  // Check creator limits
  const creatorChallengeCount = creatorChallenges.get(creatorId)?.size ?? 0;
  if (creatorChallengeCount >= CHALLENGE_CONFIG.maxPublishedChallenges) {
    return { success: false, error: 'MAX_CHALLENGES_REACHED' };
  }

  // Create challenge
  const challengeId = nanoid();
  const now = new Date();

  const challenge: CustomChallenge = {
    id: challengeId,
    creatorId,
    gameId: request.gameId,
    title: request.title,
    description: request.description ?? '',
    rules: request.rules,
    difficulty: request.difficulty,
    config: request.config,
    visibility: request.visibility ?? 'private',
    status: 'draft',
    version: 1,
    qualityScore: 'normal',
    moderationStatus: 'pending',
    stats: {
      totalPlays: 0,
      uniquePlayers: 0,
      completions: 0,
      completionRate: 0,
      averageScore: 0,
      bestScore: 0,
      shares: 0,
      reactions: 0,
      reports: 0,
      trendingScore: 0,
      lastPlayedAt: null,
    },
    createdAt: now,
    publishedAt: null,
    updatedAt: now,
    archivedAt: null,
  };

  // Store challenge
  challenges.set(challengeId, challenge);

  // Update indices
  const creatorSet = creatorChallenges.get(creatorId) ?? new Set();
  creatorSet.add(challengeId);
  creatorChallenges.set(creatorId, creatorSet);

  const gameSet = gameChallenges.get(request.gameId) ?? new Set();
  gameSet.add(challengeId);
  gameChallenges.set(request.gameId, gameSet);

  // Store initial version
  challengeVersions.set(challengeId, [{
    id: nanoid(),
    challengeId,
    version: 1,
    rules: request.rules,
    config: request.config,
    title: request.title,
    description: request.description ?? '',
    createdAt: now,
  }]);

  return { success: true, challenge };
}

/**
 * Update an existing challenge
 */
export function updateChallenge(
  challengeId: string,
  creatorId: string,
  request: UpdateChallengeRequest,
): { success: boolean; challenge?: CustomChallenge; error?: string } {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { success: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  if (challenge.creatorId !== creatorId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  // Validate title if provided
  if (request.title) {
    const titleValidation = isTitleValid(request.title);
    if (!titleValidation.valid) {
      return { success: false, error: titleValidation.error };
    }
  }

  // Validate description if provided
  if (request.description) {
    const descValidation = isDescriptionValid(request.description);
    if (!descValidation.valid) {
      return { success: false, error: descValidation.error };
    }
  }

  // Validate game config if provided
  if (request.config) {
    const configValidation = validateGameConfig(challenge.gameId, request.config);
    if (!configValidation.valid) {
      return { success: false, error: configValidation.error };
    }
  }

  // Check if challenge has competitive results
  if (challenge.stats.totalPlays > 0) {
    // Create new version instead of modifying
    const newVersion = challenge.version + 1;
    const versions = challengeVersions.get(challengeId) ?? [];
    versions.push({
      id: nanoid(),
      challengeId,
      version: newVersion,
      rules: request.rules ?? challenge.rules,
      config: request.config ?? challenge.config,
      title: request.title ?? challenge.title,
      description: request.description ?? challenge.description,
      createdAt: new Date(),
    });
    challengeVersions.set(challengeId, versions);
    challenge.version = newVersion;
  }

  // Apply updates
  if (request.title !== undefined) challenge.title = request.title;
  if (request.description !== undefined) challenge.description = request.description;
  if (request.difficulty !== undefined) challenge.difficulty = request.difficulty;
  if (request.rules !== undefined) challenge.rules = request.rules;
  if (request.config !== undefined) challenge.config = request.config;
  if (request.visibility !== undefined) challenge.visibility = request.visibility;

  challenge.updatedAt = new Date();

  return { success: true, challenge };
}

/**
 * Publish a challenge
 */
export function publishChallenge(
  challengeId: string,
  creatorId: string,
): { success: boolean; challenge?: CustomChallenge; error?: string } {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { success: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  if (challenge.creatorId !== creatorId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (challenge.status !== 'draft' && challenge.status !== 'paused') {
    return { success: false, error: 'INVALID_STATUS' };
  }

  // Auto-approve based on creator level (simplified)
  challenge.moderationStatus = 'approved';
  challenge.status = 'published';
  challenge.publishedAt = new Date();
  challenge.updatedAt = new Date();

  return { success: true, challenge };
}

/**
 * Archive a challenge
 */
export function archiveChallenge(
  challengeId: string,
  creatorId: string,
): { success: boolean; error?: string } {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { success: false, error: 'CHALLENGE_NOT_FOUND' };
  }

  if (challenge.creatorId !== creatorId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  challenge.status = 'archived';
  challenge.archivedAt = new Date();
  challenge.updatedAt = new Date();

  return { success: true };
}

/**
 * Get a challenge by ID
 */
export function getChallenge(challengeId: string): CustomChallenge | null {
  return challenges.get(challengeId) ?? null;
}

/**
 * Get challenges by creator
 */
export function getCreatorChallenges(
  creatorId: string,
  options: { status?: CustomChallengeStatus; limit?: number; offset?: number } = {},
): CustomChallenge[] {
  const { status, limit = 20, offset = 0 } = options;
  const challengeIds = creatorChallenges.get(creatorId) ?? new Set();

  let challengesList = Array.from(challengeIds)
    .map((id) => challenges.get(id))
    .filter((c): c is CustomChallenge => c !== undefined);

  if (status) {
    challengesList = challengesList.filter((c) => c.status === status);
  }

  return challengesList
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(offset, offset + limit);
}

/**
 * Get challenges by game
 */
export function getGameChallenges(
  gameId: GameId,
  options: { limit?: number; offset?: number } = {},
): CustomChallenge[] {
  const { limit = 20, offset = 0 } = options;
  const challengeIds = gameChallenges.get(gameId) ?? new Set();

  return Array.from(challengeIds)
    .map((id) => challenges.get(id))
    .filter((c): c is CustomChallenge => c !== undefined && c.status === 'published')
    .sort((a, b) => b.stats.trendingScore - a.stats.trendingScore)
    .slice(offset, offset + limit);
}

/**
 * Record a play on a challenge
 */
export function recordChallengePlay(
  challengeId: string,
  userId: string,
  score: number,
  completed: boolean,
): void {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.stats.totalPlays += 1;
  challenge.stats.uniquePlayers += 1; // Simplified - production would check duplicates
  if (completed) challenge.stats.completions += 1;
  challenge.stats.completionRate = challenge.stats.completions / challenge.stats.totalPlays;
  challenge.stats.averageScore = (challenge.stats.averageScore * (challenge.stats.totalPlays - 1) + score) / challenge.stats.totalPlays;
  challenge.stats.bestScore = Math.max(challenge.stats.bestScore, score);
  challenge.stats.lastPlayedAt = new Date();
  challenge.updatedAt = new Date();
}

/**
 * Record a share
 */
export function recordChallengeShare(challengeId: string): void {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.stats.shares += 1;
  challenge.updatedAt = new Date();
}

/**
 * Record a reaction
 */
export function recordChallengeReaction(challengeId: string, increment: boolean): void {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.stats.reactions += increment ? 1 : -1;
  challenge.updatedAt = new Date();
}

/**
 * Record a report
 */
export function recordChallengeReport(challengeId: string): void {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenge.stats.reports += 1;
  challenge.updatedAt = new Date();
}

/**
 * Get challenge deep link
 */
export function getChallengeDeepLink(challengeId: string): string {
  return generateChallengeDeepLink(challengeId);
}

/**
 * Get challenge versions
 */
export function getChallengeVersions(challengeId: string) {
  return challengeVersions.get(challengeId) ?? [];
}

// ============================================================
// Validation Helpers
// ============================================================

function validateGameConfig(
  gameId: GameId,
  config: CustomChallengeConfig,
): { valid: boolean; error?: string } {
  const limits = GAME_CONFIG_LIMITS[gameId];
  if (!limits) {
    return { valid: false, error: 'UNSUPPORTED_GAME' };
  }

  if (gameId === 'reaction-rush' && config.reaction) {
    const r = config.reaction;
    const l = limits.reaction!;
    if (r.rounds < l.minRounds || r.rounds > l.maxRounds) {
      return { valid: false, error: `Rounds must be between ${l.minRounds} and ${l.maxRounds}` };
    }
    if (r.timeWindow < l.minTimeWindow || r.timeWindow > l.maxTimeWindow) {
      return { valid: false, error: `Time window must be between ${l.minTimeWindow} and ${l.maxTimeWindow}ms` };
    }
    if (r.difficulty < l.minDifficulty || r.difficulty > l.maxDifficulty) {
      return { valid: false, error: `Difficulty must be between ${l.minDifficulty} and ${l.maxDifficulty}` };
    }
  }

  if (gameId === 'tap-rush' && config.tap) {
    const t = config.tap;
    const l = limits.tap!;
    if (t.duration < l.minDuration || t.duration > l.maxDuration) {
      return { valid: false, error: `Duration must be between ${l.minDuration} and ${l.maxDuration}s` };
    }
    if (t.targetCount < l.minTargetCount || t.targetCount > l.maxTargetCount) {
      return { valid: false, error: `Target count must be between ${l.minTargetCount} and ${l.maxTargetCount}` };
    }
    if (t.difficulty < l.minDifficulty || t.difficulty > l.maxDifficulty) {
      return { valid: false, error: `Difficulty must be between ${l.minDifficulty} and ${l.maxDifficulty}` };
    }
  }

  if (gameId === 'quiz-rush' && config.quiz) {
    const q = config.quiz;
    const l = limits.quiz!;
    if (q.questionCount < l.minQuestionCount || q.questionCount > l.maxQuestionCount) {
      return { valid: false, error: `Question count must be between ${l.minQuestionCount} and ${l.maxQuestionCount}` };
    }
    if (q.timePerQuestion < l.minTimePerQuestion || q.timePerQuestion > l.maxTimePerQuestion) {
      return { valid: false, error: `Time per question must be between ${l.minTimePerQuestion} and ${l.maxTimePerQuestion}s` };
    }
    if (q.difficulty < l.minDifficulty || q.difficulty > l.maxDifficulty) {
      return { valid: false, error: `Difficulty must be between ${l.minDifficulty} and ${l.maxDifficulty}` };
    }
  }

  return { valid: true };
}

function validateRules(rules: CustomChallengeRules): { valid: boolean; error?: string } {
  if (rules.goalValue <= 0) {
    return { valid: false, error: 'Goal value must be positive' };
  }
  if (rules.timeLimit !== null && rules.timeLimit <= 0) {
    return { valid: false, error: 'Time limit must be positive' };
  }
  if (rules.roundLimit !== null && rules.roundLimit <= 0) {
    return { valid: false, error: 'Round limit must be positive' };
  }
  if (rules.allowedRetries < 0 || rules.allowedRetries > 10) {
    return { valid: false, error: 'Allowed retries must be between 0 and 10' };
  }
  return { valid: true };
}

/**
 * Clear all data (for testing)
 */
export function _clearAllChallenges(): void {
  challenges.clear();
  creatorChallenges.clear();
  gameChallenges.clear();
  challengeVersions.clear();
}
