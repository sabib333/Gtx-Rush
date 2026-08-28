/**
 * GTX Rush — LiveOps Engine v1.0
 *
 * Central orchestrator for all Live Operations:
 * - Season management and transitions
 * - Battle pass integration
 * - Mission management
 * - Event coordination
 * - Community goals
 * - Daily login rewards
 * - Content rotation
 * - LiveOps home feed
 * - Notification coordination
 *
 * All time-based content is controlled through server-side configuration.
 * Never hard-code event dates into frontend code.
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  LiveOpsSeason,
  LiveOpsEvent,
  LiveOpsEventCard,
  CommunityGoal,
  UserDailyLogin,
  LiveOpsUserMission,
  LiveOpsUserMissionWithTemplate,
  LiveOpsMissionTemplate,
  LiveOpsHomeResponse,
  LiveOpsNotification,
  LiveOpsSeasonLevel,
  LiveOpsReward,
  BattlePassProgress,
  SeasonMilestone,
  ContentRotation,
  ContentRotationItem,
  RewardBudget,
  LiveOpsCalendarEntry,
  LiveOpsEventStatus,
} from '@gtx-rush/types';
import {
  DEFAULT_SEASON_LEVELS,
  DEFAULT_BATTLE_PASS_CONFIG,
  DEFAULT_MISSION_CONFIG,
  DEFAULT_EVENT_CONFIG,
  DEFAULT_DAILY_LOGIN_CONFIG,
  DEFAULT_LIVEOPS_CALENDAR,
  DEFAULT_CONTENT_ROTATION_CONFIG,
  DEFAULT_REWARD_BUDGET_CONFIG,
  DEFAULT_SEASON_MILESTONES,
  LIVEOPS_MISSION_TEMPLATES,
  getSeasonLevelXp,
  calculateSeasonLevel,
} from '@gtx-rush/config';
import {
  getBattlePassProgress,
  ownsPremiumPass,
  createBattlePass,
} from './battle-pass-engine';
import {
  getOrCreateProgression,
  awardSeasonXp,
  getLevelDetails,
} from './season-progression-engine';
import { getActiveEvents, getUpcomingEvents } from './event-engine';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const seasons = new Map<string, LiveOpsSeason>();
const liveOpsEvents = new Map<string, LiveOpsEvent>();
const communityGoals = new Map<string, CommunityGoal>();
const dailyLogins = new Map<string, UserDailyLogin>();
const userMissions = new Map<string, LiveOpsUserMission>();
const notifications = new Map<string, LiveOpsNotification[]>();
const milestones = new Map<string, SeasonMilestone[]>();
const contentRotations = new Map<string, ContentRotation>();
const rewardBudgets = new Map<string, RewardBudget>();
const calendarEntries = new Map<string, LiveOpsCalendarEntry>();
const auditLog = new Map<string, Array<{
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  adminId: string;
  timestamp: Date;
}>>();

// Active season cache
let activeSeasonId: string | null = null;

// ============================================================
// Season Management
// ============================================================

/**
 * Create a new LiveOps season.
 *
 * Statuses: DRAFT → SCHEDULED → ACTIVE → ENDS → ENDED → ARCHIVED
 * Only one primary season should normally be ACTIVE.
 */
export function createLiveOpsSeason(params: {
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  theme: string;
  bannerUrl?: string | null;
}): LiveOpsSeason {
  const id = nanoid();

  // Build reward track from default levels
  const rewardTrack = {
    levels: DEFAULT_SEASON_LEVELS.map((level): LiveOpsSeasonLevel => ({
      level: level.level,
      xpRequired: level.xpRequired,
      freeReward: null,
      premiumReward: null,
    })),
    totalLevels: DEFAULT_SEASON_LEVELS.length,
  };

  const season: LiveOpsSeason = {
    id,
    name: params.name,
    description: params.description,
    startTime: params.startTime,
    endTime: params.endTime,
    status: 'draft',
    theme: params.theme,
    bannerUrl: params.bannerUrl ?? null,
    rewardTrack,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  seasons.set(id, season);

  // Initialize milestones
  const seasonMilestones = DEFAULT_SEASON_MILESTONES.map((m): SeasonMilestone => ({
    id: nanoid(),
    seasonId: id,
    level: m.level,
    name: m.name,
    description: m.description,
    reward: m.reward as LiveOpsReward,
    isSecret: false,
  }));
  milestones.set(id, seasonMilestones);

  return season;
}

/**
 * Get the current active season.
 */
export function getActiveSeason(): LiveOpsSeason | null {
  if (activeSeasonId) {
    const season = seasons.get(activeSeasonId);
    if (season && season.status === 'active') return season;
  }

  for (const season of seasons.values()) {
    if (season.status === 'active') {
      activeSeasonId = season.id;
      return season;
    }
  }

  return null;
}

/**
 * Get a season by ID.
 */
export function getLiveOpsSeasonById(id: string): LiveOpsSeason | null {
  return seasons.get(id) ?? null;
}

/**
 * Get all seasons.
 */
export function getAllLiveOpsSeasons(): LiveOpsSeason[] {
  return Array.from(seasons.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Transition season status with audit logging.
 */
export function transitionSeason(
  seasonId: string,
  newStatus: LiveOpsSeason['status'],
  adminId: string = 'system',
): boolean {
  const season = seasons.get(seasonId);
  if (!season) return false;

  const validTransitions: Record<string, string[]> = {
    draft: ['scheduled'],
    scheduled: ['active', 'cancelled'],
    active: ['ending', 'ended'],
    ending: ['ended'],
    ended: ['archived'],
    archived: [],
  };

  const allowed = validTransitions[season.status] ?? [];
  if (!allowed.includes(newStatus)) return false;

  const before = { status: season.status };
  season.status = newStatus;
  season.updatedAt = new Date();

  if (newStatus === 'active') {
    activeSeasonId = seasonId;
  }

  // Handle season end: finalize rewards
  if (newStatus === 'ended') {
    if (activeSeasonId === seasonId) {
      activeSeasonId = null;
    }
  }

  // Audit log
  addAuditEntry(adminId, 'SEASON_STATUS_CHANGED', 'season', seasonId, before, { status: newStatus });

  return true;
}

// ============================================================
// Community Goals
// ============================================================

/**
 * Create a community goal.
 */
export function createCommunityGoal(params: {
  name: string;
  description: string;
  type: string;
  targetValue: number;
  startTime: Date;
  endTime: Date;
  reward: LiveOpsReward;
}): CommunityGoal {
  const id = nanoid();

  const goal: CommunityGoal = {
    id,
    name: params.name,
    description: params.description,
    type: params.type,
    targetValue: params.targetValue,
    currentValue: 0,
    startTime: params.startTime,
    endTime: params.endTime,
    status: 'active',
    reward: params.reward,
    progressPercentage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  communityGoals.set(id, goal);
  return goal;
}

/**
 * Update community goal progress.
 */
export function updateCommunityGoalProgress(goalId: string, increment: number): CommunityGoal | null {
  const goal = communityGoals.get(goalId);
  if (!goal || goal.status !== 'active') return null;

  goal.currentValue += increment;
  goal.progressPercentage = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
  goal.updatedAt = new Date();

  // Check completion
  if (goal.currentValue >= goal.targetValue) {
    goal.status = 'completed';
    goal.progressPercentage = 100;
  }

  return goal;
}

/**
 * Get all active community goals.
 */
export function getActiveCommunityGoals(): CommunityGoal[] {
  return Array.from(communityGoals.values()).filter((g) => g.status === 'active');
}

// ============================================================
// Daily Login
// ============================================================

/**
 * Get or create a user's daily login record.
 */
export function getOrCreateDailyLogin(userId: string): UserDailyLogin {
  const existing = dailyLogins.get(userId);
  if (existing) return existing;

  const login: UserDailyLogin = {
    userId,
    lastLoginDate: '',
    currentDay: 0,
    totalLogins: 0,
    lastRewardClaimedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  dailyLogins.set(userId, login);
  return login;
}

/**
 * Process daily login for a user.
 *
 * Returns the daily login reward if applicable.
 * Lenient mode: missing a day doesn't reset streak.
 * Strict mode: missing a day resets to day 1.
 */
export function processDailyLogin(userId: string, todayDate: string): {
  day: number;
  reward: LiveOpsReward | null;
  isStreakBonus: boolean;
  claimed: boolean;
} {
  const login = getOrCreateDailyLogin(userId);
  const config = DEFAULT_DAILY_LOGIN_CONFIG;

  if (!config.enabled) {
    return { day: 0, reward: null, isStreakBonus: false, claimed: false };
  }

  // Check if already logged in today
  if (login.lastLoginDate === todayDate) {
    return {
      day: login.currentDay,
      reward: null,
      isStreakBonus: false,
      claimed: login.lastRewardClaimedAt !== null,
    };
  }

  // Check consecutive day
  const yesterdayDate = getYesterdayDate(todayDate);
  if (login.lastLoginDate === yesterdayDate) {
    // Consecutive day
    login.currentDay = Math.min(login.currentDay + 1, config.rewards.length);
  } else if (config.resetMode === 'lenient') {
    // Lenient: continue from where we left off (or start fresh)
    login.currentDay = Math.min(login.currentDay + 1, config.rewards.length);
  } else {
    // Strict: reset to day 1
    login.currentDay = 1;
  }

  login.lastLoginDate = todayDate;
  login.totalLogins++;
  login.lastRewardClaimedAt = null;
  login.updatedAt = new Date();

  // Find reward for current day
  const dayReward = config.rewards.find((r) => r.day === login.currentDay);

  return {
    day: login.currentDay,      reward: (dayReward?.reward as LiveOpsReward) ?? null,
    isStreakBonus: dayReward?.isStreakBonus ?? false,
    claimed: false,
  };
}

/**
 * Claim the daily login reward.
 */
export function claimDailyLoginReward(userId: string): {
  success: boolean;
  reward?: LiveOpsReward;
  error?: string;
} {
  const login = dailyLogins.get(userId);
  if (!login) {
    return { success: false, error: 'NO_LOGIN_RECORD' };
  }

  if (login.lastRewardClaimedAt) {
    return { success: false, error: 'ALREADY_CLAIMED' };
  }

  const config = DEFAULT_DAILY_LOGIN_CONFIG;
  const dayReward = config.rewards.find((r) => r.day === login.currentDay);
  if (!dayReward) {
    return { success: false, error: 'NO_REWARD_FOR_DAY' };
  }

  login.lastRewardClaimedAt = new Date();
  login.updatedAt = new Date();

  return { success: true, reward: dayReward.reward as LiveOpsReward };
}

function getYesterdayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// ============================================================
// LiveOps Missions
// ============================================================

/**
 * Get mission templates for a user.
 */
export function getMissionTemplatesForUser(
  category: 'daily' | 'weekly' | 'seasonal',
  userLevel: number,
): LiveOpsMissionTemplate[] {
  return LIVEOPS_MISSION_TEMPLATES
    .filter((t) => t.category === category && userLevel >= t.minLevel)
    .map((t): LiveOpsMissionTemplate => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      type: t.type,
      target: t.target,
      gameId: t.gameId,
      configuration: {},
      rewardConfig: t.reward,
      difficulty: t.difficulty,
      rarity: t.rarity,
      weight: t.weight,
      minLevel: t.minLevel,
      maxLevel: 0,
      seasonId: null,
      eventId: null,
      isActive: true,
      version: 1,
      createdAt: new Date(),
    }));
}

/**
 * Generate missions for a user.
 */
export function generateMissionsForUser(
  userId: string,
  category: 'daily' | 'weekly' | 'seasonal',
  userLevel: number,
): LiveOpsUserMission[] {
  const templates = getMissionTemplatesForUser(category, userLevel);
  const config = DEFAULT_MISSION_CONFIG;

  const count = category === 'daily' ? config.dailyMissionCount
    : category === 'weekly' ? config.weeklyMissionCount
    : config.seasonalMissionCount;

  // Simple weighted selection (avoid duplicates by type)
  const selected: LiveOpsMissionTemplate[] = [];
  const usedTypes = new Set<string>();

  const sorted = [...templates].sort((a, b) => b.weight - a.weight);

  for (const template of sorted) {
    if (selected.length >= count) break;
    if (usedTypes.has(template.type)) continue;
    selected.push(template);
    usedTypes.add(template.type);
  }

  // Create user mission instances
  const userMissionsForCategory: LiveOpsUserMission[] = [];

  for (const template of selected) {
    const missionId = nanoid();
    const userMission: LiveOpsUserMission = {
      id: missionId,
      userId,
      missionTemplateId: template.id,
      category: template.category,
      seasonId: template.seasonId,
      eventId: template.eventId,
      progress: 0,
      target: template.target,
      status: 'active',
      rerollStatus: 'available',
      rerollCount: 0,
      completedAt: null,
      claimedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userMissions.set(missionId, userMission);
    userMissionsForCategory.push(userMission);
  }

  return userMissionsForCategory;
}

/**
 * Process mission progress event.
 */
export function processMissionProgressEvent(params: {
  userId: string;
  eventType: string;
  gameId: string;
  metadata: Record<string, unknown>;
}): LiveOpsUserMission[] {
  const updated: LiveOpsUserMission[] = [];

  for (const mission of userMissions.values()) {
    if (mission.userId !== params.userId || mission.status !== 'active') continue;

    // Check if event matches mission type
    if (!isEventMatchingMission(params.eventType, mission)) continue;

    // Update progress
    mission.progress = Math.min(mission.progress + 1, mission.target);
    mission.updatedAt = new Date();

    if (mission.progress >= mission.target && mission.status === 'active') {
      mission.status = 'completed';
      mission.completedAt = new Date();
    }

    updated.push(mission);
  }

  return updated;
}

function isEventMatchingMission(eventType: string, mission: LiveOpsUserMission): boolean {
  const template = LIVEOPS_MISSION_TEMPLATES.find((t) => t.id === mission.missionTemplateId);
  if (!template) return false;

  const eventMap: Record<string, string[]> = {
    'PLAY_GAME': ['game_completed', 'game_played'],
    'WIN_GAME': ['game_won'],
    'SCORE_THRESHOLD': ['score_recorded'],
    'USE_GAME_MODE': ['game_completed'],
    'JOIN_EVENT': ['event_joined', 'event_completed'],
  };

  return eventMap[template.type]?.includes(eventType) ?? false;
}

/**
 * Claim a mission reward.
 */
export function claimMissionReward(
  userId: string,
  missionId: string,
): {
  success: boolean;
  reward?: LiveOpsReward;
  error?: string;
} {
  const mission = userMissions.get(missionId);
  if (!mission || mission.userId !== userId) {
    return { success: false, error: 'MISSION_NOT_FOUND' };
  }

  // Check already claimed first (prevents CLAIMED → CLAIMED)
  if (mission.status === 'claimed' || mission.claimedAt) {
    return { success: false, error: 'ALREADY_CLAIMED' };
  }

  if (mission.status !== 'completed') {
    return { success: false, error: 'MISSION_NOT_COMPLETED' };
  }

  const template = LIVEOPS_MISSION_TEMPLATES.find((t) => t.id === mission.missionTemplateId);
  if (!template) {
    return { success: false, error: 'TEMPLATE_NOT_FOUND' };
  }

  mission.status = 'claimed';
  mission.claimedAt = new Date();
  mission.updatedAt = new Date();

  return {
    success: true,
    reward: template.reward as unknown as LiveOpsReward,
  };
}

/**
 * Reroll a mission.
 */
export function rerollMission(
  userId: string,
  missionId: string,
): {
  success: boolean;
  previousMissionId: string;
  newMissionId: string | null;
  remainingRerolls: number;
  error?: string;
} {
  if (!DEFAULT_MISSION_CONFIG.rerollsEnabled) {
    return {
      success: false,
      previousMissionId: missionId,
      newMissionId: null,
      remainingRerolls: 0,
      error: 'REROLLS_DISABLED',
    };
  }

  const mission = userMissions.get(missionId);
  if (!mission || mission.userId !== userId) {
    return {
      success: false,
      previousMissionId: missionId,
      newMissionId: null,
      remainingRerolls: 0,
      error: 'MISSION_NOT_FOUND',
    };
  }

  if (mission.status !== 'active') {
    return {
      success: false,
      previousMissionId: missionId,
      newMissionId: null,
      remainingRerolls: 0,
      error: 'MISSION_NOT_ACTIVE',
    };
  }

  // Check total rerolls for this user today (not per-mission)
  const totalUserRerolls = Array.from(userMissions.values())
    .filter((m) => m.userId === userId && m.rerollStatus === 'rerolled')
    .length;

  if (totalUserRerolls >= DEFAULT_MISSION_CONFIG.maxDailyRerolls) {
    return {
      success: false,
      previousMissionId: missionId,
      newMissionId: null,
      remainingRerolls: 0,
      error: 'MAX_REROLLS_REACHED',
    };
  }

  // Lock current mission
  mission.status = 'expired';
  mission.rerollStatus = 'rerolled';
  mission.rerollCount++;
  mission.updatedAt = new Date();

  // Generate a new mission (same category, different template)
  const templates = getMissionTemplatesForUser(mission.category as 'daily' | 'weekly' | 'seasonal', 1);
  const usedTemplateIds = new Set(
    Array.from(userMissions.values())
      .filter((m) => m.userId === userId && m.status !== 'expired' && m.rerollStatus !== 'rerolled')
      .map((m) => m.missionTemplateId),
  );

  const available = templates.filter((t) => !usedTemplateIds.has(t.id));
  if (available.length === 0) {
    return {
      success: false,
      previousMissionId: missionId,
      newMissionId: null,
      remainingRerolls: DEFAULT_MISSION_CONFIG.maxDailyRerolls - mission.rerollCount,
      error: 'NO_MISSIONS_AVAILABLE',
    };
  }

  // Pick a random available template
  const newTemplate = available[Math.floor(Math.random() * available.length)]!;
  const newMissionId = nanoid();

  const newMission: LiveOpsUserMission = {
    id: newMissionId,
    userId,
    missionTemplateId: newTemplate.id,
    category: newTemplate.category,
    seasonId: newTemplate.seasonId,
    eventId: newTemplate.eventId,
    progress: 0,
    target: newTemplate.target,
    status: 'active',
    rerollStatus: 'available',
    rerollCount: 0,
    completedAt: null,
    claimedAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  userMissions.set(newMissionId, newMission);

  return {
    success: true,
    previousMissionId: missionId,
    newMissionId,
    remainingRerolls: DEFAULT_MISSION_CONFIG.maxDailyRerolls - mission.rerollCount,
  };
}

/**
 * Get a user's missions.
 */
export function getUserMissions(userId: string): LiveOpsUserMission[] {
  return Array.from(userMissions.values())
    .filter((m) => m.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get a user's active missions by category.
 */
export function getUserMissionsByCategory(
  userId: string,
  category: 'daily' | 'weekly' | 'seasonal' | 'event' | 'special' | 'community',
): LiveOpsUserMissionWithTemplate[] {
  return Array.from(userMissions.values())
    .filter((m) => m.userId === userId && m.category === category && m.status === 'active')
    .map((m) => {
      const template = LIVEOPS_MISSION_TEMPLATES.find((t) => t.id === m.missionTemplateId);
      return {
        ...m,
        template: template as unknown as import('@gtx-rush/types').LiveOpsMissionTemplate,
      };
    });
}

// ============================================================
// Content Rotation
// ============================================================

/**
 * Create a content rotation.
 */
export function createContentRotation(params: {
  type: import('@gtx-rush/types').ContentRotationType;
  items: Array<{ id: string; name: string; weight: number }>;
}): ContentRotation {
  const id = nanoid();

  const rotation: ContentRotation = {
    id,
    type: params.type,
    items: params.items.map((item): ContentRotationItem => ({
      ...item,
      isActive: true,
      lastShownAt: null,
    })),
    rotationIntervalMs: DEFAULT_CONTENT_ROTATION_CONFIG.rotationIntervalHours * 60 * 60 * 1000,
    lastRotatedAt: new Date(),
    isActive: true,
  };

  contentRotations.set(id, rotation);
  return rotation;
}

/**
 * Get the next content for rotation.
 */
export function getNextRotation(rotationId: string): ContentRotationItem[] {
  const rotation = contentRotations.get(rotationId);
  if (!rotation) return [];

  const now = new Date();
  const timeSinceLastRotation = now.getTime() - rotation.lastRotatedAt.getTime();

  if (timeSinceLastRotation < rotation.rotationIntervalMs) {
    return []; // Not time yet
  }

  // Select items by weight
  const activeItems = rotation.items.filter((i) => i.isActive);
  const cooldownMs = DEFAULT_CONTENT_ROTATION_CONFIG.cooldownHours * 60 * 60 * 1000;

  const selectable = activeItems.filter((item) => {
    if (!item.lastShownAt) return true;
    return now.getTime() - item.lastShownAt.getTime() >= cooldownMs;
  });

  // Weighted random selection
  const selected: ContentRotationItem[] = [];
  const available = [...selectable];

  while (selected.length < DEFAULT_CONTENT_ROTATION_CONFIG.itemsPerRotation && available.length > 0) {
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < available.length; i++) {
      random -= available[i]!.weight;
      if (random <= 0) {
        const item = available.splice(i, 1)[0]!;
        item.lastShownAt = now;
        selected.push(item);
        break;
      }
    }
  }

  rotation.lastRotatedAt = now;
  return selected;
}

// ============================================================
// Reward Budget
// ============================================================

/**
 * Check if reward budget allows distribution.
 */
export function checkRewardBudget(budgetId: string): {
  allowed: boolean;
  reason: string;
} {
  const budget = rewardBudgets.get(budgetId);
  if (!budget) return { allowed: true, reason: 'NO_BUDGET_SET' };

  if (budget.isExhausted) {
    return { allowed: false, reason: 'BUDGET_EXHAUSTED' };
  }

  if (budget.distributedCount >= budget.totalBudget) {
    return { allowed: false, reason: 'TOTAL_BUDGET_REACHED' };
  }

  if (budget.dailyDistributedToday >= budget.dailyCap) {
    return { allowed: false, reason: 'DAILY_CAP_REACHED' };
  }

  return { allowed: true, reason: '' };
}

/**
 * Deduct from reward budget.
 */
export function deductRewardBudget(budgetId: string, count: number = 1): boolean {
  const budget = rewardBudgets.get(budgetId);
  if (!budget) return true; // No budget = no limit

  if (!checkRewardBudget(budgetId).allowed) return false;

  budget.distributedCount += count;
  budget.dailyDistributedToday += count;
  budget.isExhausted = budget.distributedCount >= budget.totalBudget;
  budget.updatedAt = new Date();

  return true;
}

/**
 * Create a reward budget.
 */
export function createRewardBudget(params: {
  name: string;
  totalBudget: number;
  userCap: number;
  dailyCap: number;
}): RewardBudget {
  const id = nanoid();

  const budget: RewardBudget = {
    id,
    name: params.name,
    totalBudget: params.totalBudget,
    distributedCount: 0,
    userCap: params.userCap,
    dailyCap: params.dailyCap,
    dailyDistributedToday: 0,
    isExhausted: false,
    fallbackReward: DEFAULT_REWARD_BUDGET_CONFIG.fallbackReward as LiveOpsReward,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  rewardBudgets.set(id, budget);
  return budget;
}

// ============================================================
// LiveOps Home Feed
// ============================================================

/**
 * Build the LiveOps home feed for a user.
 *
 * Shows: LIVE NOW, UPCOMING, ENDING SOON, missions, battle pass progress
 */
export function getLiveOpsHome(params: {
  userId: string;
  userLevel: number;
  seasonXp: number;
}): LiveOpsHomeResponse {
  const { userId, userLevel, seasonXp } = params;

  // Season info
  const activeSeason = getActiveSeason();
  let seasonInfo: LiveOpsHomeResponse['season'] = null;
  if (activeSeason) {
    const { currentLevel, xpToNextLevel } = getLevelDetails(seasonXp);
    const timeRemaining = activeSeason.endTime.getTime() - Date.now();
    seasonInfo = {
      id: activeSeason.id,
      name: activeSeason.name,
      theme: activeSeason.theme,
      currentLevel,
      xpToNextLevel,
      timeRemaining,
      isPremium: ownsPremiumPass(userId, activeSeason.id),
    };
  }

  // Events: LIVE NOW, UPCOMING, ENDING SOON
  const now = new Date();
  const liveNowEvents: LiveOpsEventCard[] = [];
  const upcomingEvents: LiveOpsEventCard[] = [];
  const endingSoonEvents: LiveOpsEventCard[] = [];

  for (const event of liveOpsEvents.values()) {
    const timeRemaining = event.endTime.getTime() - now.getTime();

    if (event.status === 'active' && timeRemaining > 0) {
      const card: LiveOpsEventCard = {
        id: event.id,
        name: event.name,
        type: event.type,
        timeRemaining,
        reward: event.rewards.participationReward,
        cta: 'Join Event',
        bannerUrl: event.bannerUrl,
      };

      liveNowEvents.push(card);

      if (timeRemaining < DEFAULT_EVENT_CONFIG.endingSoonThresholdMs) {
        endingSoonEvents.push(card);
      }
    }

    if (event.status === 'scheduled') {
      upcomingEvents.push({
        id: event.id,
        name: event.name,
        type: event.type,
        timeRemaining: event.startTime.getTime() - now.getTime(),
        reward: event.rewards.participationReward,
        cta: 'Coming Soon',
        bannerUrl: event.bannerUrl,
      });
    }
  }

  // Missions
  const activeMissions = getUserMissionsByCategory(userId, 'daily');

  // Community goals
  const communityGoalsList = getActiveCommunityGoals();

  // Battle pass progress
  let battlePassProgress: BattlePassProgress | null = null;
  if (activeSeason) {
    battlePassProgress = getBattlePassProgress({
      userId,
      seasonId: activeSeason.id,
      seasonXp,
    });
  }

  // Daily login
  const dailyLogin = getOrCreateDailyLogin(userId);
  const loginConfig = DEFAULT_DAILY_LOGIN_CONFIG;
  const nextReward = loginConfig.rewards.find((r) => r.day === dailyLogin.currentDay + 1);

  return {
    season: seasonInfo,
    liveNow: liveNowEvents,
    upcoming: upcomingEvents,
    endingSoon: endingSoonEvents,
    activeMissions,
    communityGoals: communityGoalsList,
    battlePassProgress,
    dailyLogin: {
      currentDay: dailyLogin.currentDay,
      nextReward: (nextReward?.reward as LiveOpsReward) ?? null,
      claimed: dailyLogin.lastRewardClaimedAt !== null,
    },
  };
}

// ============================================================
// Audit Log
// ============================================================

/**
 * Add an audit entry.
 */
export function addAuditEntry(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown,
): void {
  const log = auditLog.get(targetType) ?? [];
  log.push({
    id: nanoid(),
    action,
    targetType,
    targetId,
    before,
    after,
    adminId,
    timestamp: new Date(),
  });
  auditLog.set(targetType, log);
}

/**
 * Get audit log entries.
 */
export function getAuditLog(
  targetType: string,
  options: { limit?: number; offset?: number } = {},
): Array<{
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  adminId: string;
  timestamp: Date;
}> {
  const { limit = 50, offset = 0 } = options;
  return (auditLog.get(targetType) ?? [])
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(offset, offset + limit);
}

// ============================================================
// Notifications
// ============================================================

/**
 * Create a LiveOps notification for a user.
 */
export function createLiveOpsNotification(params: {
  userId: string;
  type: LiveOpsNotification['type'];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): LiveOpsNotification {
  const notification: LiveOpsNotification = {
    id: nanoid(),
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
    read: false,
    createdAt: new Date(),
  };

  const userNotifs = notifications.get(params.userId) ?? [];
  userNotifs.push(notification);
  notifications.set(params.userId, userNotifs);

  return notification;
}

/**
 * Get user's LiveOps notifications.
 */
export function getUserNotifications(userId: string): LiveOpsNotification[] {
  return notifications.get(userId) ?? [];
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearLiveOpsEngine(): void {
  seasons.clear();
  liveOpsEvents.clear();
  communityGoals.clear();
  dailyLogins.clear();
  userMissions.clear();
  notifications.clear();
  milestones.clear();
  contentRotations.clear();
  rewardBudgets.clear();
  calendarEntries.clear();
  auditLog.clear();
  activeSeasonId = null;
}

export function _getSeasonCount(): number {
  return seasons.size;
}

export function _getCommunityGoalCount(): number {
  return communityGoals.size;
}

export function _getMissionCount(): number {
  return userMissions.size;
}
