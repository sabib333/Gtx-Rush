/**
 * GTX Rush — Reward Inventory Service v1.0
 *
 * Generalized inventory and reward system that handles:
 * - Idempotent reward granting
 * - Reward transaction history
 * - Inventory management
 * - Duplicate prevention
 *
 * SECURITY:
 * - All reward changes occur server-side
 * - Users cannot create items or grant themselves rewards
 * - Reward transactions are immutable
 * - Every reward has a unique transaction with source tracking
 *
 * Contract: Retention Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  RewardItem,
  UserInventoryItem,
  RetentionRewardTransaction as RewardTransaction,
  RetentionRewardSource as RewardSource,
  RewardItemType,
  RewardItemRarity,
  RewardHistoryResponse,
  MissionRewardConfiguration,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const rewardItems = new Map<string, RewardItem>();
const userInventory = new Map<string, UserInventoryItem[]>();
const rewardTransactions = new Map<string, RewardTransaction>();

// ============================================================
// Reward Item Definitions
// ============================================================

/**
 * Initialize reward item definitions.
 * Called once at startup.
 */
export function initializeRewardItems(): void {
  const items: RewardItem[] = [
    // Badges
    {
      id: 'streak_7_days',
      type: 'badge',
      name: '7 Day Streak',
      description: 'Maintained a 7-day streak',
      rarity: 'uncommon',
      iconUrl: '/icons/badges/streak_7.png',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'streak_30_days',
      type: 'badge',
      name: '30 Day Streak',
      description: 'Maintained a 30-day streak',
      rarity: 'rare',
      iconUrl: '/icons/badges/streak_30.png',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'streak_100_days',
      type: 'badge',
      name: '100 Day Streak',
      description: 'Maintained a 100-day streak',
      rarity: 'epic',
      iconUrl: '/icons/badges/streak_100.png',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'streak_365_days',
      type: 'badge',
      name: 'Legendary Streak',
      description: 'Maintained a 365-day streak',
      rarity: 'legendary',
      iconUrl: '/icons/badges/streak_365.png',
      isActive: true,
      createdAt: new Date(),
    },

    // Titles
    {
      id: 'title_legendary_streak',
      type: 'title',
      name: 'Legendary Streak',
      description: 'Awarded for a 100-day streak',
      rarity: 'legendary',
      iconUrl: '/icons/titles/legendary_streak.png',
      isActive: true,
      createdAt: new Date(),
    },

    // Profile Frames
    {
      id: 'frame_bronze',
      type: 'profile_frame',
      name: 'Bronze Frame',
      description: 'A bronze profile frame',
      rarity: 'common',
      iconUrl: '/icons/frames/bronze.png',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'frame_silver',
      type: 'profile_frame',
      name: 'Silver Frame',
      description: 'A silver profile frame',
      rarity: 'uncommon',
      iconUrl: '/icons/frames/silver.png',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 'frame_gold',
      type: 'profile_frame',
      name: 'Gold Frame',
      description: 'A gold profile frame',
      rarity: 'rare',
      iconUrl: '/icons/frames/gold.png',
      isActive: true,
      createdAt: new Date(),
    },
  ];

  for (const item of items) {
    rewardItems.set(item.id, item);
  }
}

/**
 * Get a reward item by ID.
 */
export function getRewardItem(itemId: string): RewardItem | null {
  return rewardItems.get(itemId) ?? null;
}

/**
 * Get all reward items of a specific type.
 */
export function getRewardItemsByType(type: RewardItemType): RewardItem[] {
  return Array.from(rewardItems.values()).filter((item) => item.type === type);
}

// ============================================================
// Reward Granting (Idempotent)
// ============================================================

/**
 * Grant a reward to a user.
 *
 * SECURITY:
 * - Granting is idempotent via idempotency key
 * - Duplicate grants are prevented
 * - All grants are recorded in transaction history
 * - Source is always tracked
 */
export function grantReward(
  userId: string,
  rewardConfig: MissionRewardConfiguration,
  source: RewardSource,
  referenceId: string,
  referenceType: string,
): {
  success: boolean;
  granted: MissionRewardConfiguration;
  idempotencyKey: string;
  error?: string;
} {
  // Generate idempotency key
  const idempotencyKey = `${source}:${referenceId}:${userId}`;

  // Check for duplicate transaction
  const existingTransaction = Array.from(rewardTransactions.values()).find(
    (t) => t.idempotencyKey === idempotencyKey,
  );

  if (existingTransaction) {
    // Idempotent: already granted
    return {
      success: false,
      granted: { xp: 0 },
      idempotencyKey,
      error: 'ALREADY_GRANTED',
    };
  }

  // Grant XP reward
  if (rewardConfig.xp > 0) {
    const xpTransaction: RewardTransaction = {
      id: nanoid(),
      userId,
      source,
      referenceId,
      referenceType,
      rewardType: 'xp',
      rewardValue: rewardConfig.xp,
      idempotencyKey: `${idempotencyKey}:xp`,
      createdAt: new Date(),
    };

    // Check for duplicate XP
    const existingXP = rewardTransactions.get(xpTransaction.idempotencyKey);
    if (!existingXP) {
      rewardTransactions.set(xpTransaction.idempotencyKey, xpTransaction);
    }
  }

  // Grant badge reward
  if (rewardConfig.badgeId) {
    grantInventoryItem(userId, rewardConfig.badgeId, 'badge', source, referenceId);
  }

  // Grant title reward
  if (rewardConfig.titleId) {
    grantInventoryItem(userId, rewardConfig.titleId, 'title', source, referenceId);
  }

  // Grant cosmetic reward
  if (rewardConfig.cosmeticId) {
    grantInventoryItem(userId, rewardConfig.cosmeticId, 'cosmetic', source, referenceId);
  }

  // Grant profile frame reward
  if (rewardConfig.profileFrameId) {
    grantInventoryItem(userId, rewardConfig.profileFrameId, 'profile_frame', source, referenceId);
  }

  return {
    success: true,
    granted: rewardConfig,
    idempotencyKey,
  };
}

/**
 * Grant an item to user inventory.
 * Prevents duplicate items for badge/title types.
 */
function grantInventoryItem(
  userId: string,
  itemId: string,
  itemType: RewardItemType,
  source: RewardSource,
  sourceReferenceId: string,
): void {
  // Initialize user inventory if needed
  if (!userInventory.has(userId)) {
    userInventory.set(userId, []);
  }

  const inventory = userInventory.get(userId)!;

  // Check for duplicate (badges and titles are unique per user)
  if (itemType === 'badge' || itemType === 'title') {
    const existing = inventory.find(
      (item) => item.itemId === itemId && item.itemType === itemType,
    );
    if (existing) {
      return; // Already owned
    }
  }

  // Grant item
  const inventoryItem: UserInventoryItem = {
    id: nanoid(),
    userId,
    itemId,
    itemType,
    source,
    sourceReferenceId,
    metadata: {},
    grantedAt: new Date(),
  };

  inventory.push(inventoryItem);

  // Record transaction
  const transaction: RewardTransaction = {
    id: nanoid(),
    userId,
    source,
    referenceId: sourceReferenceId,
    referenceType: itemType,
    rewardType: itemType,
    rewardValue: itemId,
    idempotencyKey: `inventory:${userId}:${itemId}:${source}:${sourceReferenceId}`,
    createdAt: new Date(),
  };

  rewardTransactions.set(transaction.idempotencyKey, transaction);
}

// ============================================================
// Inventory Queries
// ============================================================

/**
 * Get all items in a user's inventory.
 */
export function getUserInventory(userId: string): UserInventoryItem[] {
  return userInventory.get(userId) ?? [];
}

/**
 * Get user's inventory by item type.
 */
export function getUserInventoryByType(
  userId: string,
  type: RewardItemType,
): UserInventoryItem[] {
  return getUserInventory(userId).filter((item) => item.itemType === type);
}

/**
 * Check if a user has a specific item.
 */
export function userHasItem(userId: string, itemId: string): boolean {
  return getUserInventory(userId).some((item) => item.itemId === itemId);
}

// ============================================================
// Reward History
// ============================================================

/**
 * Get reward transaction history for a user.
 */
export function getRewardHistory(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
    source?: RewardSource;
    rewardType?: RewardItemType;
  } = {},
): RewardHistoryResponse {
  const { cursor, limit = 20, source, rewardType } = options;

  let transactions = Array.from(rewardTransactions.values()).filter(
    (t) => t.userId === userId,
  );

  // Apply filters
  if (source) {
    transactions = transactions.filter((t) => t.source === source);
  }
  if (rewardType) {
    transactions = transactions.filter((t) => t.rewardType === rewardType);
  }

  // Sort by creation date (newest first)
  transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = transactions.findIndex((t) => t.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = transactions.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < transactions.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  return {
    transactions: paginated,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Get total XP earned by a user from all sources.
 */
export function getTotalXpEarned(userId: string): number {
  return Array.from(rewardTransactions.values())
    .filter((t) => t.userId === userId && t.rewardType === 'xp')
    .reduce((sum, t) => sum + (Number(t.rewardValue) || 0), 0);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllRewards(): void {
  rewardItems.clear();
  userInventory.clear();
  rewardTransactions.clear();
}

export function _getRewardItemCount(): number {
  return rewardItems.size;
}

export function _getUserInventoryCount(userId: string): number {
  return getUserInventory(userId).length;
}

export function _getTransactionCount(): number {
  return rewardTransactions.size;
}
