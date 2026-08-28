/**
 * GTX Rush — LiveOps Configuration v1.0
 *
 * Central configuration for the Live Operations Engine.
 * All values are configurable and version-controlled.
 * Never hard-code event dates — use server-side configuration.
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

// ============================================================
// Season Configuration
// ============================================================

export interface SeasonLevelConfig {
  level: number;
  xpRequired: number;
}

/** Default XP curve for season levels. Exponential but avoids extreme grinding. */
export const DEFAULT_SEASON_LEVELS: SeasonLevelConfig[] = generateSeasonLevels(50);

function generateSeasonLevels(maxLevel: number): SeasonLevelConfig[] {
  const levels: SeasonLevelConfig[] = [];
  for (let i = 1; i <= maxLevel; i++) {
    // XP scales as: 100, 200, 350, 550, 800, 1100, ...
    // Using quadratic formula: xpRequired = 50 * level + 50 * level^1.3
    const xpRequired = Math.round(50 * i + 50 * Math.pow(i, 1.3));
    levels.push({ level: i, xpRequired });
  }
  return levels;
}

/** Get XP required for a given season level. */
export function getSeasonLevelXp(level: number): number {
  if (level < 1) return 0;
  if (level > DEFAULT_SEASON_LEVELS.length) {
    // Beyond max level, scale linearly
    const lastLevel = DEFAULT_SEASON_LEVELS[DEFAULT_SEASON_LEVELS.length - 1]!;
    return lastLevel.xpRequired + (level - lastLevel.level) * 2000;
  }
  return DEFAULT_SEASON_LEVELS[level - 1]!.xpRequired;
}

/** Calculate season level from total XP. */
export function calculateSeasonLevel(totalXp: number): { level: number; xpInCurrentLevel: number; xpToNextLevel: number } {
  let remainingXp = totalXp;
  let level = 1;

  for (const levelConfig of DEFAULT_SEASON_LEVELS) {
    if (remainingXp < levelConfig.xpRequired) {
      return {
        level: level - 1 || 1,
        xpInCurrentLevel: remainingXp,
        xpToNextLevel: levelConfig.xpRequired - remainingXp,
      };
    }
    remainingXp -= levelConfig.xpRequired;
    level = levelConfig.level + 1;
  }

  // Past max level
  return {
    level: DEFAULT_SEASON_LEVELS.length,
    xpInCurrentLevel: remainingXp,
    xpToNextLevel: 2000, // Linear scaling beyond max
  };
}

// ============================================================
// Battle Pass Configuration
// ============================================================

export interface BattlePassConfig {
  /** Price in Telegram Stars */
  defaultPriceStars: number;
  /** Whether premium pass is currently enabled */
  premiumEnabled: boolean;
  /** Whether auto-claim is enabled */
  autoClaimEnabled: boolean;
  /** Maximum level for the pass */
  maxLevel: number;
}

export const DEFAULT_BATTLE_PASS_CONFIG: BattlePassConfig = {
  defaultPriceStars: 500, // ~$5 equivalent
  premiumEnabled: true,
  autoClaimEnabled: false,
  maxLevel: 50,
};

/** Free track rewards per level (cosmetics, XP, badges) */
export const FREE_TRACK_REWARDS: Array<{
  level: number;
  reward: { type: string; value: string | number; name: string; description: string; rarity: string; itemId: string | null };
}> = [
  { level: 1, reward: { type: 'xp', value: 100, name: 'Season Kickoff', description: '100 Season XP', rarity: 'common', itemId: null } },
  { level: 3, reward: { type: 'badge', value: 'season_3', name: 'Getting Started', description: 'Beginner badge', rarity: 'common', itemId: 'season_3_badge' } },
  { level: 5, reward: { type: 'xp', value: 250, name: 'XP Boost', description: '250 Season XP', rarity: 'common', itemId: null } },
  { level: 7, reward: { type: 'profile_frame', value: 'frame_bronze', name: 'Bronze Frame', description: 'Bronze profile frame', rarity: 'common', itemId: 'frame_bronze' } },
  { level: 10, reward: { type: 'xp', value: 500, name: 'Level 10 XP', description: '500 Season XP', rarity: 'uncommon', itemId: null } },
  { level: 12, reward: { type: 'badge', value: 'season_12', name: 'Rising Star', description: 'Intermediate badge', rarity: 'uncommon', itemId: 'season_12_badge' } },
  { level: 15, reward: { type: 'xp', value: 750, name: 'XP Jackpot', description: '750 Season XP', rarity: 'rare', itemId: null } },
  { level: 18, reward: { type: 'profile_bg', value: 'bg_sunset', name: 'Sunset Background', description: 'Sunset profile background', rarity: 'rare', itemId: 'bg_sunset' } },
  { level: 20, reward: { type: 'xp', value: 1000, name: 'Level 20 XP', description: '1000 Season XP', rarity: 'rare', itemId: null } },
  { level: 25, reward: { type: 'badge', value: 'season_25', name: 'Seasoned Player', description: 'Advanced badge', rarity: 'epic', itemId: 'season_25_badge' } },
  { level: 30, reward: { type: 'xp', value: 1500, name: 'XP Mountain', description: '1500 Season XP', rarity: 'epic', itemId: null } },
  { level: 35, reward: { type: 'profile_frame', value: 'frame_silver', name: 'Silver Frame', description: 'Silver profile frame', rarity: 'epic', itemId: 'frame_silver' } },
  { level: 40, reward: { type: 'xp', value: 2000, name: 'XP Summit', description: '2000 Season XP', rarity: 'legendary', itemId: null } },
  { level: 45, reward: { type: 'badge', value: 'season_45', name: 'Elite Player', description: 'Elite badge', rarity: 'legendary', itemId: 'season_45_badge' } },
  { level: 50, reward: { type: 'title', value: 'season_champion', name: 'Season Champion', description: 'Exclusive season champion title', rarity: 'legendary', itemId: 'title_season_champion' } },
];

/** Premium track rewards per level (cosmetics, exclusive items) */
export const PREMIUM_TRACK_REWARDS: Array<{
  level: number;
  reward: { type: string; value: string | number; name: string; description: string; rarity: string; itemId: string | null };
}> = [
  { level: 1, reward: { type: 'emote', value: 'emote_fireworks', name: 'Fireworks Emote', description: 'Celebration emote', rarity: 'rare', itemId: 'emote_fireworks' } },
  { level: 3, reward: { type: 'xp', value: 200, name: 'Premium XP Boost', description: '200 Season XP', rarity: 'common', itemId: null } },
  { level: 5, reward: { type: 'profile_frame', value: 'frame_premium_5', name: 'Premium Frame I', description: 'Premium profile frame', rarity: 'rare', itemId: 'frame_premium_5' } },
  { level: 7, reward: { type: 'cosmetic', value: 'theme_neon', name: 'Neon Theme', description: 'Neon profile theme', rarity: 'rare', itemId: 'theme_neon' } },
  { level: 10, reward: { type: 'xp', value: 500, name: 'Premium XP', description: '500 Season XP', rarity: 'uncommon', itemId: null } },
  { level: 12, reward: { type: 'emote', value: 'emote_victory', name: 'Victory Dance', description: 'Victory celebration emote', rarity: 'epic', itemId: 'emote_victory' } },
  { level: 15, reward: { type: 'profile_frame', value: 'frame_premium_15', name: 'Premium Frame II', description: 'Premium profile frame', rarity: 'epic', itemId: 'frame_premium_15' } },
  { level: 18, reward: { type: 'cosmetic', value: 'theme_galaxy', name: 'Galaxy Theme', description: 'Galaxy profile theme', rarity: 'epic', itemId: 'theme_galaxy' } },
  { level: 20, reward: { type: 'xp', value: 1000, name: 'Premium XP Jackpot', description: '1000 Season XP', rarity: 'rare', itemId: null } },
  { level: 25, reward: { type: 'profile_frame', value: 'frame_premium_25', name: 'Premium Frame III', description: 'Premium profile frame', rarity: 'legendary', itemId: 'frame_premium_25' } },
  { level: 30, reward: { type: 'cosmetic', value: 'theme_fire', name: 'Fire Theme', description: 'Fire profile theme', rarity: 'legendary', itemId: 'theme_fire' } },
  { level: 35, reward: { type: 'emote', value: 'emote_crown', name: 'Crown Drop', description: 'Crown drop emote', rarity: 'legendary', itemId: 'emote_crown' } },
  { level: 40, reward: { type: 'xp', value: 2000, name: 'Premium XP Summit', description: '2000 Season XP', rarity: 'legendary', itemId: null } },
  { level: 45, reward: { type: 'cosmetic', value: 'theme_diamond', name: 'Diamond Theme', description: 'Diamond profile theme', rarity: 'legendary', itemId: 'theme_diamond' } },
  { level: 50, reward: { type: 'profile_frame', value: 'frame_premium_50', name: 'Ultimate Frame', description: 'Ultimate premium frame', rarity: 'legendary', itemId: 'frame_premium_50' } },
];

// ============================================================
// Mission Configuration
// ============================================================

export interface LiveOpsMissionConfig {
  /** Number of daily missions per user */
  dailyMissionCount: number;
  /** Number of weekly missions per user */
  weeklyMissionCount: number;
  /** Number of seasonal missions per user */
  seasonalMissionCount: number;
  /** Maximum rerolls per day */
  maxDailyRerolls: number;
  /** Whether rerolls are enabled */
  rerollsEnabled: boolean;
  /** Minimum easy missions per day */
  minEasyMissions: number;
  /** Minimum medium missions per day */
  minMediumMissions: number;
  /** Ensure game variety */
  ensureGameVariety: boolean;
}

export const DEFAULT_MISSION_CONFIG: LiveOpsMissionConfig = {
  dailyMissionCount: 3,
  weeklyMissionCount: 2,
  seasonalMissionCount: 5,
  maxDailyRerolls: 1,
  rerollsEnabled: true,
  minEasyMissions: 1,
  minMediumMissions: 1,
  ensureGameVariety: true,
};

/** Default mission templates for the LiveOps system */
export const LIVEOPS_MISSION_TEMPLATES = [
  // Daily missions
  { id: 'lo_daily_play_1', name: 'Play a Game', description: 'Complete 1 game', category: 'daily' as const, type: 'PLAY_GAME', target: 1, gameId: null, difficulty: 'easy' as const, rarity: 'common' as const, weight: 10, minLevel: 1, reward: { seasonXp: 25, accountXp: 50, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_play_3', name: 'Play 3 Games', description: 'Complete 3 games', category: 'daily' as const, type: 'PLAY_GAME', target: 3, gameId: null, difficulty: 'medium' as const, rarity: 'common' as const, weight: 8, minLevel: 1, reward: { seasonXp: 50, accountXp: 100, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_score_5k', name: 'Score 5,000+', description: 'Score 5,000+ in a single game', category: 'daily' as const, type: 'SCORE_THRESHOLD', target: 5000, gameId: null, difficulty: 'medium' as const, rarity: 'common' as const, weight: 7, minLevel: 3, reward: { seasonXp: 75, accountXp: 150, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_win_1', name: 'Win a Game', description: 'Win 1 game', category: 'daily' as const, type: 'WIN_GAME', target: 1, gameId: null, difficulty: 'hard' as const, rarity: 'rare' as const, weight: 5, minLevel: 5, reward: { seasonXp: 100, accountXp: 250, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_quiz', name: 'Complete Quiz Rush', description: 'Complete 1 Quiz Rush game', category: 'daily' as const, type: 'USE_GAME_MODE', target: 1, gameId: 'quiz-rush', difficulty: 'easy' as const, rarity: 'common' as const, weight: 8, minLevel: 1, reward: { seasonXp: 30, accountXp: 75, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_reaction', name: 'Play Reaction Rush', description: 'Complete 1 Reaction Rush game', category: 'daily' as const, type: 'USE_GAME_MODE', target: 1, gameId: 'reaction-rush', difficulty: 'easy' as const, rarity: 'common' as const, weight: 8, minLevel: 1, reward: { seasonXp: 30, accountXp: 75, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_tap', name: 'Play Tap Rush', description: 'Complete 1 Tap Rush game', category: 'daily' as const, type: 'USE_GAME_MODE', target: 1, gameId: 'tap-rush', difficulty: 'easy' as const, rarity: 'common' as const, weight: 8, minLevel: 1, reward: { seasonXp: 30, accountXp: 75, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_daily_score_10k', name: 'Score 10,000+', description: 'Score 10,000+ in a single game', category: 'daily' as const, type: 'SCORE_THRESHOLD', target: 10000, gameId: null, difficulty: 'hard' as const, rarity: 'rare' as const, weight: 5, minLevel: 5, reward: { seasonXp: 125, accountXp: 300, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },

  // Weekly missions
  { id: 'lo_weekly_play_20', name: 'Play 20 Games', description: 'Complete 20 games this week', category: 'weekly' as const, type: 'PLAY_GAME', target: 20, gameId: null, difficulty: 'medium' as const, rarity: 'common' as const, weight: 10, minLevel: 1, reward: { seasonXp: 200, accountXp: 500, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_weekly_win_5', name: 'Win 5 Games', description: 'Win 5 games this week', category: 'weekly' as const, type: 'WIN_GAME', target: 5, gameId: null, difficulty: 'hard' as const, rarity: 'rare' as const, weight: 6, minLevel: 5, reward: { seasonXp: 300, accountXp: 750, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_weekly_score_100k', name: 'Score 100,000 Total', description: 'Score 100,000 total points this week', category: 'weekly' as const, type: 'SCORE_THRESHOLD', target: 100000, gameId: null, difficulty: 'hard' as const, rarity: 'rare' as const, weight: 5, minLevel: 5, reward: { seasonXp: 350, accountXp: 800, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_weekly_event_3', name: 'Complete 3 Events', description: 'Complete 3 events this week', category: 'weekly' as const, type: 'JOIN_EVENT', target: 3, gameId: null, difficulty: 'medium' as const, rarity: 'uncommon' as const, weight: 7, minLevel: 3, reward: { seasonXp: 250, accountXp: 600, badgeId: null, titleId: null, cosmeticId: null, eventTicket: 2 } },

  // Seasonal missions
  { id: 'lo_seasonal_play_100', name: 'Play 100 Games', description: 'Play 100 games this season', category: 'seasonal' as const, type: 'PLAY_GAME', target: 100, gameId: null, difficulty: 'hard' as const, rarity: 'epic' as const, weight: 10, minLevel: 1, reward: { seasonXp: 1000, accountXp: 2000, badgeId: 'seasonal_player', titleId: null, cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_seasonal_win_20', name: 'Win 20 Games', description: 'Win 20 games this season', category: 'seasonal' as const, type: 'WIN_GAME', target: 20, gameId: null, difficulty: 'hard' as const, rarity: 'epic' as const, weight: 7, minLevel: 5, reward: { seasonXp: 1500, accountXp: 3000, badgeId: 'seasonal_winner', titleId: 'seasonal_champion', cosmeticId: null, eventTicket: 0 } },
  { id: 'lo_seasonal_event_10', name: 'Complete 10 Events', description: 'Complete 10 events this season', category: 'seasonal' as const, type: 'JOIN_EVENT', target: 10, gameId: null, difficulty: 'hard' as const, rarity: 'legendary' as const, weight: 5, minLevel: 5, reward: { seasonXp: 2000, accountXp: 5000, badgeId: 'seasonal_eventer', titleId: null, cosmeticId: 'frame_seasonal_legendary', eventTicket: 5 } },
];

// ============================================================
// Event Configuration
// ============================================================

export interface LiveOpsEventConfig {
  /** Default event duration in ms */
  defaultDurationMs: number;
  /** Weekend event start day (0=Sunday, 5=Friday) */
  weekendStartDay: number;
  /** Weekend event duration in ms */
  weekendDurationMs: number;
  /** Default max participants per event */
  defaultMaxParticipants: number | null;
  /** Event ending soon threshold in ms */
  endingSoonThresholdMs: number;
}

export const DEFAULT_EVENT_CONFIG: LiveOpsEventConfig = {
  defaultDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  weekendStartDay: 5, // Friday
  weekendDurationMs: 3 * 24 * 60 * 60 * 1000, // 3 days
  defaultMaxParticipants: null,
  endingSoonThresholdMs: 60 * 60 * 1000, // 1 hour
};

// ============================================================
// Daily Login Configuration
// ============================================================

export const DEFAULT_DAILY_LOGIN_CONFIG = {
  enabled: true,
  resetMode: 'lenient' as const,
  streakBonus: true,
  rewards: [
    { day: 1, reward: { type: 'xp', value: 50, name: 'Day 1 Login', description: '50 XP', rarity: 'common' as const, itemId: null }, isStreakBonus: false, streakRequired: 0 },
    { day: 2, reward: { type: 'xp', value: 75, name: 'Day 2 Login', description: '75 XP', rarity: 'common' as const, itemId: null }, isStreakBonus: false, streakRequired: 0 },
    { day: 3, reward: { type: 'xp', value: 100, name: 'Day 3 Login', description: '100 XP', rarity: 'common' as const, itemId: null }, isStreakBonus: false, streakRequired: 0 },
    { day: 4, reward: { type: 'badge', value: 'login_4', name: 'Loyal Player', description: 'Login badge', rarity: 'uncommon' as const, itemId: 'login_4_badge' }, isStreakBonus: false, streakRequired: 0 },
    { day: 5, reward: { type: 'xp', value: 200, name: 'Day 5 Login', description: '200 XP', rarity: 'uncommon' as const, itemId: null }, isStreakBonus: false, streakRequired: 0 },
    { day: 6, reward: { type: 'cosmetic', value: 'emote_wave', name: 'Wave Emote', description: 'Friendly wave emote', rarity: 'rare' as const, itemId: 'emote_wave' }, isStreakBonus: false, streakRequired: 0 },
    { day: 7, reward: { type: 'xp', value: 500, name: 'Day 7 Login Bonus', description: '500 XP + Badge', rarity: 'epic' as const, itemId: null }, isStreakBonus: true, streakRequired: 7 },
  ],
};

// ============================================================
// Content Rotation Configuration
// ============================================================

export interface ContentRotationConfig {
  /** Rotation interval in hours */
  rotationIntervalHours: number;
  /** Number of items to show per rotation */
  itemsPerRotation: number;
  /** Minimum time between showing the same item */
  cooldownHours: number;
}

export const DEFAULT_CONTENT_ROTATION_CONFIG: ContentRotationConfig = {
  rotationIntervalHours: 24,
  itemsPerRotation: 3,
  cooldownHours: 48,
};

// ============================================================
// Season Milestones
// ============================================================

export const DEFAULT_SEASON_MILESTONES = [
  { level: 10, name: 'Rising Star', description: 'Reach Level 10', reward: { type: 'badge', value: 'milestone_10', name: 'Rising Star Badge', description: 'Level 10 milestone badge', rarity: 'uncommon' as const, itemId: 'milestone_10_badge' } },
  { level: 25, name: 'Seasoned Player', description: 'Reach Level 25', reward: { type: 'profile_frame', value: 'frame_milestone_25', name: 'Milestone Frame', description: 'Level 25 milestone frame', rarity: 'epic' as const, itemId: 'frame_milestone_25' } },
  { level: 50, name: 'Season Legend', description: 'Reach Level 50', reward: { type: 'title', value: 'title_season_legend', name: 'Season Legend Title', description: 'Level 50 exclusive title', rarity: 'legendary' as const, itemId: 'title_season_legend' } },
];

// ============================================================
// LiveOps Calendar Defaults
// ============================================================

export const DEFAULT_LIVEOPS_CALENDAR = [
  { dayOfWeek: 'monday' as const, title: 'Mission Monday', description: 'Fresh daily missions refresh', type: 'mission_refresh', isActive: true },
  { dayOfWeek: 'tuesday' as const, title: 'Challenge Tuesday', description: 'Special challenges available', type: 'challenge', isActive: true },
  { dayOfWeek: 'wednesday' as const, title: 'Creator Wednesday', description: 'Creator challenges and events', type: 'creator_event', isActive: true },
  { dayOfWeek: 'thursday' as const, title: 'Throwback Thursday', description: 'Classic games and events return', type: 'throwback', isActive: true },
  { dayOfWeek: 'friday' as const, title: 'Weekend Rush', description: 'Weekend event begins', type: 'weekend_event', isActive: true },
  { dayOfWeek: 'saturday' as const, title: 'Saturday Showdown', description: 'Special tournament event', type: 'tournament', isActive: true },
  { dayOfWeek: 'sunday' as const, title: 'Weekly Reset', description: 'Weekly missions and events reset', type: 'weekly_reset', isActive: true },
];

// ============================================================
// Reward Budget Defaults
// ============================================================

export const DEFAULT_REWARD_BUDGET_CONFIG = {
  globalDailyBudget: 100000,
  perUserDailyCap: 5000,
  perEventBudget: 50000,
  fallbackReward: { type: 'xp', value: 10, name: 'Fallback', description: '10 XP', rarity: 'common' as const, itemId: null },
};

// ============================================================
// Fraud Integration Config
// ============================================================

export const LIVEOPS_FRAUD_CONFIG = {
  /** Maximum score multiplier before flagging */
  maxScoreMultiplier: 2.0,
  /** Maximum games per hour before flagging */
  maxGamesPerHour: 30,
  /** Maximum events joined per day */
  maxEventsPerDay: 50,
  /** Maximum mission claims per hour */
  maxMissionClaimsPerHour: 20,
  /** Check for impossible scores */
  impossibleScoreThreshold: 1000000,
};

// ============================================================
// Season Transition Config
// ============================================================

export const SEASON_TRANSITION_CONFIG = {
  /** Hours before season end to show warning */
  warningHours: [168, 72, 48, 24, 12, 6, 1], // 7 days, 3 days, 2 days, 1 day, 12h, 6h, 1h
  /** What resets on season change */
  resetsOnTransition: ['seasonXp', 'seasonLevel', 'seasonMissions'],
  /** What does NOT reset */
  preservedOnTransition: ['account', 'inventory', 'ownedCosmetics', 'lifetimeStats', 'achievements', 'badges', 'titles'],
};
