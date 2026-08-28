/**
 * GTX Rush — Monetization Types v1.0
 *
 * Type definitions for the Monetization System.
 * Covers products, purchases, ads, inventory, and premium features.
 *
 * Contract: Monetization Contract v1.0
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type ItemType = 'cosmetic' | 'boost' | 'premium_feature' | 'extra_attempt';
export type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type CosmeticCategory = 'avatar_frame' | 'profile_bg' | 'title' | 'effect' | 'emoji_pack' | 'theme' | 'name_effect';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ProductType = 'cosmetic' | 'premium_feature' | 'bundle' | 'subscription';
export type AdType = 'rewarded' | 'interstitial';
export type AdStatus = 'pending' | 'started' | 'completed' | 'failed' | 'expired';
export type RevenueStream = 'ad_revenue' | 'stars_purchase' | 'premium_cosmetic' | 'premium_profile_feature' | 'sponsored_event';
export type InventorySource = 'purchase' | 'season_reward' | 'badge_reward' | 'event_reward' | 'admin_grant' | 'mission_reward' | 'streak_milestone';

// ============================================================
// Product Catalog
// ============================================================

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  category: CosmeticCategory | null;
  priceStars: number;
  rarity: Rarity;
  assetUrl: string;
  previewUrl: string | null;
  metadata: ProductMetadata;
  availability: ProductAvailability;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMetadata {
  /** Visual properties for cosmetics */
  visual?: Record<string, unknown>;
  /** Premium feature flags this product enables */
  features?: string[];
  /** Bundle contents if type is 'bundle' */
  bundleItems?: string[];
  /** Subscription duration in days if type is 'subscription' */
  subscriptionDays?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface ProductAvailability {
  /** When the product becomes available (null = always) */
  startsAt: Date | null;
  /** When the product becomes unavailable (null = always) */
  endsAt: Date | null;
  /** Maximum units available (null = unlimited) */
  maxUnits: number | null;
  /** Units sold so far */
  unitsSold: number;
  /** Minimum user level required */
  minLevel: number;
  /** User segments this product is available to */
  segments: string[];
}

export interface ProductWithOwnership extends Product {
  owned: boolean;
  equipped?: boolean;
}

// ============================================================
// Cosmetics
// ============================================================

export interface Cosmetic {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: CosmeticCategory;
  rarity: Rarity;
  priceStars: number;
  assetUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export interface UserCosmetic {
  id: string;
  userId: string;
  cosmeticId: string;
  isEquipped: boolean;
  purchasedAt: Date;
}

// ============================================================
// Purchases
// ============================================================

export interface Purchase {
  id: string;
  userId: string;
  productId: string;
  productType: ProductType;
  itemType: ItemType;
  itemId: string;
  amountStars: number;
  provider: string;
  providerPaymentId: string | null;
  status: PurchaseStatus;
  idempotencyKey: string;
  metadata: PurchaseMetadata;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface PurchaseMetadata {
  /** Telegram payment information */
  telegramPayment?: TelegramPaymentInfo;
  /** Ad reward information if purchase was via ad */
  adReward?: AdRewardInfo;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface TelegramPaymentInfo {
  /** Telegram payment ID */
  paymentId: string;
  /** Invoice payload */
  invoicePayload: string;
  /** Provider payment charge ID */
  providerPaymentChargeId: string | null;
  /** Telegram payment charge ID */
  telegramPaymentChargeId: string | null;
}

export interface AdRewardInfo {
  /** Ad provider name */
  adProvider: string;
  /** Ad placement */
  placement: string;
  /** Reward type granted */
  rewardType: string;
  /** Reward amount */
  rewardAmount: number;
}

export interface PurchaseInitRequest {
  productId: string;
  idempotencyKey: string;
}

export interface PurchaseInitResponse {
  purchaseId: string;
  paymentParams: TelegramPaymentParams;
  expiresAt: string;
}

export interface TelegramPaymentParams {
  /** Provider token for Telegram payments */
  providerToken: string;
  /** Currency code */
  currency: string;
  /** Price in Stars */
  amount: number;
  /** Product name */
  name: string;
  /** Product description */
  description: string;
  /** Payload for server verification */
  payload: string;
  /** Photo URL */
  photoUrl?: string;
}

export interface PurchaseVerifyRequest {
  telegramPaymentId: string;
  idempotencyKey: string;
}

export interface PurchaseVerifyResponse {
  success: boolean;
  purchase: Purchase;
  itemGranted: boolean;
}

// ============================================================
// Ad System
// ============================================================

export interface AdConfiguration {
  /** Whether ads are enabled */
  enabled: boolean;
  /** Whether rewarded ads are enabled */
  rewardedAdsEnabled: boolean;
  /** Whether interstitial ads are enabled */
  interstitialAdsEnabled: boolean;
  /** Minimum interval between ads (ms) */
  minIntervalMs: number;
  /** Maximum ads per session */
  maxPerSession: number;
  /** Maximum ads per day */
  maxPerDay: number;
  /** Eligible screens for interstitials */
  eligibleScreens: string[];
  /** Ad provider configuration */
  provider: AdProviderConfig;
}

export interface AdProviderConfig {
  /** Provider name (e.g., 'telegram', 'admob') */
  name: string;
  /** Provider-specific config */
  config: Record<string, unknown>;
}

export interface AdRequest {
  userId: string;
  adType: AdType;
  placement: string;
  /** Session ID for frequency tracking */
  sessionId: string;
}

export interface AdResponse {
  /** Ad instance ID */
  adId: string;
  /** Ad type */
  adType: AdType;
  /** Ad placement */
  placement: string;
  /** Whether ad is available */
  available: boolean;
  /** Ad configuration for client */
  adConfig: Record<string, unknown>;
  /** Reward configuration if rewarded ad */
  reward: AdReward | null;
  /** Reason if not available */
  unavailableReason?: string;
}

export interface AdReward {
  /** Reward type */
  type: 'xp' | 'cosmetic_progression' | 'mission_progress';
  /** Reward amount */
  amount: number;
  /** Maximum daily rewards from ads */
  dailyCap: number;
  /** Current daily rewards earned */
  dailyEarned: number;
}

export interface AdCompletion {
  adId: string;
  userId: string;
  adType: AdType;
  placement: string;
  /** Server-side verification token */
  verificationToken: string;
  /** Ad completion timestamp */
  completedAt: Date;
}

export interface AdCompletionResult {
  success: boolean;
  rewardGranted: boolean;
  reward?: AdReward;
  error?: string;
}

// ============================================================
// Inventory
// ============================================================

export interface InventoryItem {
  id: string;
  userId: string;
  itemId: string;
  itemType: ItemType;
  source: InventorySource;
  sourceReferenceId: string | null;
  metadata: Record<string, unknown>;
  acquiredAt: Date;
}

export interface InventoryResponse {
  items: InventoryItem[];
  totalCount: number;
  cosmetics: InventoryItem[];
  premiumFeatures: InventoryItem[];
}

// ============================================================
// Premium Features (GTX Rush Plus)
// ============================================================

export interface PremiumFeature {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Whether this feature is included in premium */
  includedInPremium: boolean;
  /**单独购买价格 (Stars) if available */
  standalonePriceStars: number | null;
  /** Feature category */
  category: string;
  isActive: boolean;
}

export interface UserPremiumStatus {
  /** Whether user has active premium */
  isPremium: boolean;
  /** Premium expiration date */
  expiresAt: Date | null;
  /** Active premium features */
  activeFeatures: string[];
  /** Premium subscription ID */
  subscriptionId: string | null;
}

// ============================================================
// Feature Flags
// ============================================================

export interface MonetizationFeatureFlags {
  adsEnabled: boolean;
  rewardedAdsEnabled: boolean;
  storeEnabled: boolean;
  starsEnabled: boolean;
  premiumEnabled: boolean;
  limitedItemsEnabled: boolean;
}

// ============================================================
// Analytics
// ============================================================

export type MonetizationAnalyticsEvent =
  | 'store_opened'
  | 'product_viewed'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'purchase_refunded'
  | 'ad_requested'
  | 'ad_started'
  | 'ad_completed'
  | 'ad_reward_granted'
  | 'ad_failed'
  | 'premium_viewed'
  | 'premium_started'
  | 'inventory_viewed'
  | 'cosmetic_equipped';

export interface MonetizationAnalyticsData {
  eventName: MonetizationAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// Store API Types
// ============================================================

export interface StoreResponse {
  featured: ProductWithOwnership[];
  categories: StoreCategory[];
  products: ProductWithOwnership[];
}

export interface StoreCategory {
  name: string;
  displayName: string;
  products: ProductWithOwnership[];
}

export interface StoreProductResponse {
  product: ProductWithOwnership;
  relatedProducts: ProductWithOwnership[];
}

export interface InventoryResponse {
  items: InventoryItem[];
  totalCount: number;
  byCategory: Record<string, InventoryItem[]>;
}

export interface PremiumResponse {
  status: UserPremiumStatus;
  features: PremiumFeature[];
  subscriptionPlans: SubscriptionPlan[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceStars: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
}

// ============================================================
// Ad Analytics
// ============================================================

export interface AdMetrics {
  totalRequested: number;
  totalCompleted: number;
  totalFailed: number;
  completionRate: number;
  averageWatchTime: number;
  revenueEstimate: number;
}

// ============================================================
// Revenue Analytics
// ============================================================

export interface RevenueMetrics {
  totalRevenue: number;
  starsRevenue: number;
  adRevenue: number;
  averageRevenuePerUser: number;
  conversionRate: number;
  purchasesByProduct: Record<string, number>;
  dailyRevenue: Array<{
    date: string;
    stars: number;
    ads: number;
    total: number;
  }>;
}
