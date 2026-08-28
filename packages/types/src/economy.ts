/**
 * GTX Rush — Economy, Rewards, Inventory & Virtual Items Engine Types
 *
 * Handles:
 * - Economy service
 * - XP ledger
 * - Level system
 * - Reward transactions
 * - Item catalog
 * - Inventory management
 * - Equipment system
 * - Cosmetic store
 * - Telegram Stars integration
 *
 * Contract: Economy Engine Contract v1.0
 */

// ============================================================
// Economy Asset Types
// ============================================================

export type EconomyAssetType = 'xp' | 'cosmetic_items' | 'badges' | 'titles' | 'profile_frames' | 'team_cosmetics' | 'event_rewards';

export type EconomyItemType =
  | 'profile_frame'
  | 'avatar_effect'
  | 'name_effect'
  | 'badge'
  | 'title'
  | 'team_theme'
  | 'event_cosmetic'
  | 'cosmetic';

export type EconomyItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type EconomyItemStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type EconomyAcquisitionMethod = 'gameplay' | 'mission' | 'event' | 'tournament' | 'challenge' | 'team' | 'referral' | 'achievement' | 'level_up' | 'campaign' | 'purchase' | 'ad_reward';

export type EconomyRewardSource =
  | 'gameplay'
  | 'mission'
  | 'event'
  | 'tournament'
  | 'challenge'
  | 'team'
  | 'referral'
  | 'achievement'
  | 'level_up'
  | 'campaign'
  | 'purchase'
  | 'ad_reward'
  | 'admin_grant'
  | 'reversal';

export type EconomyTransactionStatus = 'pending' | 'completed' | 'rejected' | 'reversed';

export type EconomyEquipmentSlot = 'profile_frame' | 'title' | 'avatar_effect' | 'name_effect';

// ============================================================
// XP & Level System
// ============================================================

export interface EconomyXPTransaction {
  id: string;
  userId: string;
  amount: number;
  source: EconomyXPSource;
  referenceId: string | null;
  referenceType: string | null;
  balanceAfter: number;
  createdAt: Date;
}

export type EconomyXPSource =
  | 'game_completion'
  | 'game_score'
  | 'mission'
  | 'event'
  | 'challenge'
  | 'team'
  | 'referral'
  | 'achievement'
  | 'level_up'
  | 'campaign'
  | 'ad_reward'
  | 'streak_bonus'
  | 'daily_login';

export interface EconomyLevelDefinition {
  level: number;
  xpRequired: number;
  title: string;
  rewards?: EconomyLevelReward[];
}

export interface EconomyLevelReward {
  type: EconomyItemType;
  itemId: string;
  name: string;
}

export interface EconomyXPAwardResult {
  xpAwarded: number;
  newTotal: number;
  level: number;
  levelUp: boolean;
  newLevel?: EconomyLevelDefinition;
}

export interface EconomyLevelProgress {
  currentLevel: number;
  nextLevel: EconomyLevelDefinition | null;
  xpInCurrentLevel: number;
  xpNeeded: number;
  progress: number; // 0-100
}

// ============================================================
// Reward System
// ============================================================

export interface EconomyRewardItem {
  id: string;
  type: EconomyItemType;
  name: string;
  description: string;
  rarity: EconomyItemRarity;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface EconomyRewardTransaction {
  id: string;
  userId: string;
  source: EconomyRewardSource;
  referenceId: string;
  referenceType: string;
  rewardType: string;
  rewardValue: string | number;
  status: EconomyTransactionStatus;
  idempotencyKey: string;
  createdAt: Date;
}

export interface EconomyRewardGrantRequest {
  itemId: string;
  source: EconomyRewardSource;
  referenceId: string;
  referenceType: string;
}

export interface EconomyRewardGrantResult {
  success: boolean;
  transaction?: EconomyRewardTransaction;
  error?: string;
}

export interface EconomyRewardClaimRequest {
  rewardId: string;
}

export interface EconomyRewardClaimResult {
  success: boolean;
  transaction?: EconomyRewardTransaction;
  error?: string;
}

// ============================================================
// Item Catalog
// ============================================================

export interface EconomyCatalogItem {
  id: string;
  type: EconomyItemType;
  name: string;
  description: string;
  rarity: EconomyItemRarity;
  imageUrl: string | null;
  status: EconomyItemStatus;
  acquisitionMethod: EconomyAcquisitionMethod;
  price: number | null; // null = free
  currency: 'stars' | null;
  metadata: Record<string, unknown>;
  version: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EconomyCatalogItemWithOwnership extends EconomyCatalogItem {
  owned: boolean;
  equipped: boolean;
}

export interface EconomyCatalogResponse {
  items: EconomyCatalogItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================================
// Inventory
// ============================================================

export interface EconomyInventoryItem {
  id: string;
  userId: string;
  itemId: string;
  itemType: EconomyItemType;
  quantity: number;
  acquiredAt: Date;
  source: EconomyRewardSource;
  transactionId: string;
  metadata: Record<string, unknown>;
}

export interface EconomyInventoryResponse {
  items: EconomyInventoryItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface EconomyInventoryItemWithDetails extends EconomyInventoryItem {
  item: EconomyCatalogItem | null;
}

// ============================================================
// Equipment
// ============================================================

export interface EconomyEquipmentLoadout {
  profileFrame: EconomyInventoryItemWithDetails | null;
  title: EconomyInventoryItemWithDetails | null;
  avatarEffect: EconomyInventoryItemWithDetails | null;
  nameEffect: EconomyInventoryItemWithDetails | null;
}

export interface EconomyEquipmentChangeRequest {
  slot: EconomyEquipmentSlot;
  itemId: string | null; // null to unequip
}

export interface EconomyEquipmentChangeResult {
  success: boolean;
  loadout?: EconomyEquipmentLoadout;
  error?: string;
}

// ============================================================
// Store
// ============================================================

export interface EconomyStoreSection {
  id: string;
  name: string;
  description: string;
  items: EconomyCatalogItemWithOwnership[];
}

export interface EconomyStoreResponse {
  sections: EconomyStoreSection[];
  featured: EconomyCatalogItemWithOwnership[];
}

export interface EconomyPurchaseIntent {
  id: string;
  userId: string;
  itemId: string;
  amount: number;
  currency: 'stars';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  telegramPaymentId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface EconomyPurchaseIntentRequest {
  itemId: string;
}

export interface EconomyPurchaseIntentResult {
  success: boolean;
  intent?: EconomyPurchaseIntent;
  error?: string;
}

export interface EconomyPurchaseVerifyRequest {
  intentId: string;
  telegramPaymentId: string;
}

export interface EconomyPurchaseVerifyResult {
  success: boolean;
  transaction?: EconomyRewardTransaction;
  error?: string;
}

// ============================================================
// Economy Profile
// ============================================================

export interface EconomyProfile {
  userId: string;
  totalXp: number;
  currentLevel: number;
  levelProgress: EconomyLevelProgress;
  inventoryCount: number;
  equippedItems: EconomyEquipmentLoadout;
  recentTransactions: EconomyRewardTransaction[];
}

// ============================================================
// Economy Analytics
// ============================================================

export interface EconomyAnalytics {
  dailyXpIssued: number;
  dailyRewardsIssued: number;
  dailyItemsAcquired: number;
  topItems: { itemId: string; name: string; acquisitions: number }[];
  purchaseVolume: number;
  anomalyCount: number;
}

export interface UserEconomyStats {
  totalXpEarned: number;
  totalItemsAcquired: number;
  totalPurchases: number;
  totalStarsSpent: number;
  favoriteItemType: EconomyItemType | null;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface EconomyProfileResponse {
  success: boolean;
  data: EconomyProfile;
}

export interface InventoryListResponse {
  success: boolean;
  data: EconomyInventoryResponse;
}

export interface EconomyStoreListResponse {
  success: boolean;
  data: EconomyStoreResponse;
}

export interface EconomyRewardClaimResponse {
  success: boolean;
  data: {
    transaction: EconomyRewardTransaction;
  };
}

export interface EconomyEquipmentChangeResponse {
  success: boolean;
  data: {
    loadout: EconomyEquipmentLoadout;
  };
}

export interface EconomyTransactionHistoryResponse {
  success: boolean;
  data: {
    transactions: EconomyRewardTransaction[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
  };
}
