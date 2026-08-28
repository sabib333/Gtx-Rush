/**
 * GTX Rush — Economy, Rewards, Inventory & Virtual Items Engine Config
 *
 * Configuration for XP, levels, rewards, items, inventory,
 * equipment, store, and economy safety.
 *
 * Contract: Economy Engine Contract v1.0
 */

import type {
  EconomyItemType,
  EconomyItemRarity,
  EconomyEquipmentSlot,
  EconomyCatalogItem,
  EconomyAcquisitionMethod,
  EconomyRewardSource,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags
// ============================================================

export const ECONOMY_FLAGS = {
  economy_enabled: true,
  xp_enabled: true,
  levels_enabled: true,
  rewards_enabled: true,
  inventory_enabled: true,
  equipment_enabled: true,
  store_enabled: true,
  stars_enabled: false,
  ad_rewards_enabled: false,
  soft_currency_enabled: false,
} as const;

// ============================================================
// XP Configuration
// ============================================================

export const XP_CONFIG = {
  // Daily XP caps by source
  dailyCaps: {
    game_completion: 500,
    game_score: 200,
    mission: 300,
    event: 400,
    challenge: 250,
    team: 200,
    referral: 100,
    achievement: 150,
    campaign: 200,
    ad_reward: 100,
    streak_bonus: 50,
    daily_login: 25,
  },
  // Streak multipliers
  streakMultipliers: {
    none: 1.0,
    sevenDays: 1.1,
    thirtyDays: 1.25,
  },
  // Anti-farm: minimum time between XP grants from same source
  minimumGrantIntervalMs: 5000,
} as const;

// ============================================================
// Level Configuration
// ============================================================

export const LEVEL_CONFIG = {
  // Level progression curve
  levels: [
    { level: 1, xpRequired: 0, title: 'Newcomer' },
    { level: 2, xpRequired: 100, title: 'Beginner' },
    { level: 3, xpRequired: 300, title: 'Novice' },
    { level: 4, xpRequired: 600, title: 'Apprentice' },
    { level: 5, xpRequired: 1000, title: 'Journeyman' },
    { level: 6, xpRequired: 1500, title: 'Skilled' },
    { level: 7, xpRequired: 2200, title: 'Expert' },
    { level: 8, xpRequired: 3000, title: 'Master' },
    { level: 9, xpRequired: 4000, title: 'Grandmaster' },
    { level: 10, xpRequired: 5500, title: 'Champion' },
    { level: 11, xpRequired: 7500, title: 'Elite' },
    { level: 12, xpRequired: 10000, title: 'Legend' },
    { level: 13, xpRequired: 13000, title: 'Mythic' },
    { level: 14, xpRequired: 17000, title: 'Immortal' },
    { level: 15, xpRequired: 22000, title: 'Divine' },
  ],
  // Level-up reward types
  levelRewards: {
    5: { type: 'profile_frame', itemId: 'frame_bronze', name: 'Bronze Frame' },
    10: { type: 'title', itemId: 'title_champion', name: 'Champion Title' },
    15: { type: 'profile_frame', itemId: 'frame_gold', name: 'Gold Frame' },
  },
} as const;

// ============================================================
// Item Catalog Configuration
// ============================================================

export const ECONOMY_ITEM_CATALOG: EconomyCatalogItem[] = [
  // Profile Frames
  {
    id: 'frame_bronze',
    type: 'profile_frame',
    name: 'Bronze Frame',
    description: 'A classic bronze profile frame',
    rarity: 'common',
    imageUrl: '/images/items/frame_bronze.png',
    status: 'active',
    acquisitionMethod: 'level_up',
    price: null,
    currency: null,
    metadata: { color: '#CD7F32' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'frame_silver',
    type: 'profile_frame',
    name: 'Silver Frame',
    description: 'A shiny silver profile frame',
    rarity: 'rare',
    imageUrl: '/images/items/frame_silver.png',
    status: 'active',
    acquisitionMethod: 'purchase',
    price: 100,
    currency: 'stars',
    metadata: { color: '#C0C0C0' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'frame_gold',
    type: 'profile_frame',
    name: 'Gold Frame',
    description: 'An exclusive gold profile frame',
    rarity: 'legendary',
    imageUrl: '/images/items/frame_gold.png',
    status: 'active',
    acquisitionMethod: 'purchase',
    price: 250,
    currency: 'stars',
    metadata: { color: '#FFD700' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Avatar Effects
  {
    id: 'effect_fire',
    type: 'avatar_effect',
    name: 'Fire Effect',
    description: 'A blazing fire effect around your avatar',
    rarity: 'epic',
    imageUrl: '/images/items/effect_fire.png',
    status: 'active',
    acquisitionMethod: 'event',
    price: 150,
    currency: 'stars',
    metadata: { animation: 'fire' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'effect_lightning',
    type: 'avatar_effect',
    name: 'Lightning Effect',
    description: 'Electric lightning around your avatar',
    rarity: 'rare',
    imageUrl: '/images/items/effect_lightning.png',
    status: 'active',
    acquisitionMethod: 'purchase',
    price: 120,
    currency: 'stars',
    metadata: { animation: 'lightning' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Name Effects
  {
    id: 'name彩虹',
    type: 'name_effect',
    name: 'Rainbow Name',
    description: 'Your name displays in rainbow colors',
    rarity: 'epic',
    imageUrl: '/images/items/name_rainbow.png',
    status: 'active',
    acquisitionMethod: 'achievement',
    price: null,
    currency: null,
    metadata: { effect: 'rainbow' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'name_glow',
    type: 'name_effect',
    name: 'Glowing Name',
    description: 'Your name glows softly',
    rarity: 'rare',
    imageUrl: '/images/items/name_glow.png',
    status: 'active',
    acquisitionMethod: 'purchase',
    price: 80,
    currency: 'stars',
    metadata: { effect: 'glow' },
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Titles
  {
    id: 'title_champion',
    type: 'title',
    name: 'Champion',
    description: 'Awarded to those who reach Level 10',
    rarity: 'epic',
    imageUrl: '/images/items/title_champion.png',
    status: 'active',
    acquisitionMethod: 'level_up',
    price: null,
    currency: null,
    metadata: {},
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'title_legend',
    type: 'title',
    name: 'Legend',
    description: 'Awarded to those who reach Level 15',
    rarity: 'legendary',
    imageUrl: '/images/items/title_legend.png',
    status: 'active',
    acquisitionMethod: 'level_up',
    price: null,
    currency: null,
    metadata: {},
    version: 1,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ============================================================
// Equipment Configuration
// ============================================================

export const EQUIPMENT_CONFIG = {
  slots: {
    profile_frame: { label: 'Profile Frame', maxEquipped: 1 },
    title: { label: 'Title', maxEquipped: 1 },
    avatar_effect: { label: 'Avatar Effect', maxEquipped: 1 },
    name_effect: { label: 'Name Effect', maxEquipped: 1 },
  } as Record<EconomyEquipmentSlot, { label: string; maxEquipped: number }>,
  // Default loadout
  defaultLoadout: {
    profileFrame: null,
    title: null,
    avatarEffect: null,
    nameEffect: null,
  },
} as const;

// ============================================================
// Store Configuration
// ============================================================

export const ECONOMY_STORE_CONFIG = {
  sections: [
    { id: 'featured', name: 'Featured', description: 'Top picks' },
    { id: 'new', name: 'New', description: 'Recently added' },
    { id: 'frames', name: 'Frames', description: 'Profile frames' },
    { id: 'effects', name: 'Effects', description: 'Avatar and name effects' },
    { id: 'titles', name: 'Titles', description: 'Display titles' },
  ],
  maxItemsPerSection: 10,
} as const;

// ============================================================
// Rarity Configuration
// ============================================================

export const RARITY_CONFIG: Record<EconomyItemRarity, {
  label: string;
  color: string;
  dropRate: number;
}> = {
  common: { label: 'Common', color: '#9E9E9E', dropRate: 0.5 },
  rare: { label: 'Rare', color: '#2196F3', dropRate: 0.3 },
  epic: { label: 'Epic', color: '#9C27B0', dropRate: 0.15 },
  legendary: { label: 'Legendary', color: '#FF9800', dropRate: 0.05 },
};

// ============================================================
// Reward Caps Configuration
// ============================================================

export const REWARD_CAPS = {
  // Daily caps
  daily: {
    xp: 1000,
    missions: 5,
    events: 3,
    challenges: 10,
    adRewards: 10,
  },
  // Lifetime caps (null = unlimited)
  lifetime: {
    referralRewards: 100,
    campaignRewards: 50,
  },
} as const;

// ============================================================
// Economy Safety Configuration
// ============================================================

export const ECONOMY_SAFETY = {
  // Maximum XP per transaction
  maxXPPerTransaction: 10000,
  // Maximum items per inventory
  maxInventorySize: 1000,
  // Suspicious activity thresholds
  suspiciousThresholds: {
    xpPerHour: 5000,
    transactionsPerMinute: 10,
    itemsPerHour: 50,
  },
  // Reversal settings
  reversal: {
    enabled: true,
    requireReason: true,
    maxReversalAgeDays: 30,
  },
} as const;

// ============================================================
// Telegram Stars Configuration
// ============================================================

export const ECONOMY_TELEGRAM_STARS_CONFIG = {
  // Minimum purchase amount
  minPurchaseAmount: 10,
  // Maximum purchase amount
  maxPurchaseAmount: 10000,
  // Currency
  currency: 'XTR', // Telegram Stars
  // Payment timeout (seconds)
  paymentTimeoutSeconds: 300,
  // Retry settings
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;

// ============================================================
// Economy Analytics Configuration
// ============================================================

export const ECONOMY_ANALYTICS_CONFIG = {
  // Tracking events
  events: [
    'xp_granted',
    'level_up',
    'item_granted',
    'item_equipped',
    'item_unequipped',
    'reward_claimed',
    'purchase_created',
    'purchase_confirmed',
    'purchase_rejected',
    'reward_reversed',
  ],
  // Aggregation periods
  aggregationPeriods: ['hour', 'day', 'week', 'month'],
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get level from XP total
 */
export function getLevelFromXp(xp: number): number {
  const levels = LEVEL_CONFIG.levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i];
    if (level && xp >= level.xpRequired) {
      return level.level;
    }
  }
  return 1;
}

/**
 * Get XP required for a level
 */
export function getXpForLevel(level: number): number {
  const levelDef = LEVEL_CONFIG.levels.find((l) => l.level === level);
  return levelDef?.xpRequired ?? 0;
}

/**
 * Get level progress
 */
export function getLevelProgress(xp: number): {
  currentLevel: number;
  nextLevel: number | null;
  xpInCurrentLevel: number;
  xpNeeded: number;
  progress: number;
} {
  const currentLevel = getLevelFromXp(xp);
  const currentXp = getXpForLevel(currentLevel);
  const nextLevel = currentLevel + 1;
  const nextXp = getXpForLevel(nextLevel);

  if (nextXp === currentXp) {
    return {
      currentLevel,
      nextLevel: null,
      xpInCurrentLevel: xp - currentXp,
      xpNeeded: 0,
      progress: 100,
    };
  }

  const xpInCurrentLevel = xp - currentXp;
  const xpNeeded = nextXp - currentXp;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  return {
    currentLevel,
    nextLevel,
    xpInCurrentLevel,
    xpNeeded,
    progress,
  };
}

/**
 * Get daily XP cap for a source
 */
export function getDailyXpCap(source: string): number {
  return (XP_CONFIG.dailyCaps as Record<string, number>)[source] ?? 100;
}

/**
 * Validate item exists in catalog
 */
export function isValidCatalogItem(itemId: string): boolean {
  return ECONOMY_ITEM_CATALOG.some((item) => item.id === itemId);
}

/**
 * Get item from catalog
 */
export function getCatalogItem(itemId: string): EconomyCatalogItem | undefined {
  return ECONOMY_ITEM_CATALOG.find((item) => item.id === itemId);
}

/**
 * Get items by type
 */
export function getCatalogItemsByType(type: EconomyItemType): EconomyCatalogItem[] {
  return ECONOMY_ITEM_CATALOG.filter((item) => item.type === type && item.status === 'active');
}

/**
 * Get items by acquisition method
 */
export function getCatalogItemsByMethod(method: EconomyAcquisitionMethod): EconomyCatalogItem[] {
  return ECONOMY_ITEM_CATALOG.filter((item) => item.acquisitionMethod === method && item.status === 'active');
}

/**
 * Check if item is available (not expired)
 */
export function isItemAvailable(item: EconomyCatalogItem): boolean {
  if (item.status !== 'active') return false;
  const now = new Date();
  if (item.startsAt && now < item.startsAt) return false;
  if (item.endsAt && now > item.endsAt) return false;
  return true;
}
