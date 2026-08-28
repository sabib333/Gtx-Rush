/**
 * GTX Rush — Marketplace & Digital Items Engine Types
 *
 * Handles:
 * - Digital item catalog (cosmetic-only)
 * - Collections & seasonal availability
 * - Server-authoritative ownership & inventory
 * - Equipment slots
 * - Telegram Stars purchase flow & immutable transaction ledger
 * - Favorites, wishlist, trending
 * - Creator marketplace submissions & revenue ledger
 * - Gifting (rate-limited) & future trading architecture (disabled in MVP)
 *
 * NON-NEGOTIABLE: Marketplace items are cosmetic-only. No pay-to-win.
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

// ============================================================
// Item Types, Rarity, Status
// ============================================================

/** All supported digital item types. Every item has an explicit type. */
export type MarketItemType =
  | 'avatar'
  | 'avatar_frame'
  | 'profile_badge'
  | 'profile_theme'
  | 'game_skin'
  | 'effect'
  | 'emote'
  | 'banner'
  | 'title'
  | 'achievement_cosmetic'
  | 'event_cosmetic'
  | 'creator_cosmetic'
  | 'collectible';

/**
 * Rarity is a presentation/category system only.
 * Rarity NEVER implies monetary or resale value.
 */
export type MarketRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/**
 * Item lifecycle. Owned items are never hard-deleted;
 * DISABLED / ARCHIVED preserve historical ownership.
 */
export type MarketItemStatus = 'draft' | 'active' | 'disabled' | 'archived';

// ============================================================
// Acquisition
// ============================================================

/**
 * How an item can be acquired. Always shown to the user.
 */
export type MarketAcquisitionMethod =
  | 'purchase' // Telegram Stars
  | 'earnable'; // gameplay / achievements / events / missions / creator campaigns

/** Traceable source recorded on every ownership record. */
export type MarketOwnershipSource =
  | 'PURCHASE'
  | 'GAMEPLAY'
  | 'EVENT'
  | 'MISSION'
  | 'ACHIEVEMENT'
  | 'GIFT'
  | 'CREATOR'
  | 'ADMIN_GRANT';

// ============================================================
// Catalog Entities
// ============================================================

export interface MarketItem {
  itemId: string;
  name: string;
  description: string;
  type: MarketItemType;
  rarity: MarketRarity;
  image: string | null;
  /** Animation asset where applicable (secure object storage URL). */
  animation: string | null;
  status: MarketItemStatus;
  /** Set when the item was created by a creator. */
  creatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  // Optional grouping / availability
  collectionId: string | null;
  eventId: string | null;
  seasonId: string | null;

  /** Limited items have real availability windows — never fake scarcity. */
  limited: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;

  /** Trading is disabled in MVP; flag reserved for a future protocol. */
  tradable: boolean;

  /**
   * Duplicate policy: non-stackable items can only be owned once per user.
   */
  stackable: boolean;

  acquisitionMethods: MarketAcquisitionMethod[];
}

/** Server-authoritative price configuration. Never sent from client. */
export interface MarketPrice {
  itemId: string;
  price: number;
  currency: 'STARS';
  status: 'active' | 'inactive';
  startDate: Date | null;
  endDate: Date | null;
}

export interface MarketCollection {
  collectionId: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  status: MarketItemStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  itemIds: string[];
}

// ============================================================
// Ownership & Inventory
// ============================================================

export interface UserMarketItem {
  userItemId: string;
  userId: string;
  itemId: string;
  acquiredAt: Date;
  source: MarketOwnershipSource;
  /** Reference to purchase/mission/event that granted this item. */
  referenceId: string | null;
  status: 'owned' | 'refunded' | 'revoked';
  metadata: Record<string, unknown>;
}

/** Equipment slots with clear rules (one equipped item per slot). */
export type MarketEquipmentSlot =
  | 'avatar'
  | 'frame'
  | 'theme'
  | 'badge'
  | 'effect'
  | 'title';

export interface MarketEquippedLoadout {
  avatar: UserMarketItem | null;
  frame: UserMarketItem | null;
  theme: UserMarketItem | null;
  badge: UserMarketItem | null;
  effect: UserMarketItem | null;
  title: UserMarketItem | null;
}

export interface MarketInventoryResponse {
  owned: UserMarketItem[];
  equippedSlotMap: Record<string, string | undefined>;
  totalCount: number;
}

// ============================================================
// Purchase Flow & Immutable Transaction Ledger
// ============================================================

export interface MarketPurchase {
  purchaseId: string;
  userId: string;
  itemId: string;
  idempotencyKey: string;
  price: number;
  currency: 'STARS';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  telegramPaymentId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Immutable transaction record. Never deleted.
 * REFUNDED is expressed as a separate refund transaction referencing
 * the original — history is always preserved.
 */
export interface MarketTransaction {
  transactionId: string;
  purchaseId: string;
  userId: string;
  itemId: string;
  price: number;
  currency: 'STARS';
  paymentReference: string | null;
  kind: 'purchase' | 'refund' | 'gift_transfer';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  /** Link into the authoritative economy/payment ledger. */
  economyReferenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketPaymentParams {
  currency: 'XTR';
  amount: number; // server-authoritative — never from client
  title: string;
  description: string;
  payload: string; // signed payload containing purchaseId + idempotencyKey
  photoUrl?: string | null;
}

export interface MarketPurchaseIntentResult {
  purchaseId: string;
  transactionId: string;
  price: number;
  currency: 'STARS';
  paymentParams: MarketPaymentParams;
  expiresAt: string;
}

export interface MarketPurchaseVerifyRequest {
  idempotencyKey: string;
  telegramPaymentId: string;
}

export interface MarketPurchaseVerifyResult {
  success: boolean;
  transactionId: string | null;
  itemGranted: boolean;
  error?: string;
}

// ============================================================
// Engagement: Favorites, Wishlist, Trending Signals
// ============================================================

export interface MarketFavorite {
  userId: string;
  itemId: string;
  createdAt: Date;
}

export interface MarketWishlistEntry {
  userId: string;
  itemId: string;
  notifyOnAvailable: boolean;
  createdAt: Date;
}

/** Raw engagement signals used for trending (never purchases alone). */
export interface MarketEngagementSignals {
  views: number;
  purchaseClicks: number;
  purchases: number;
  equips: number;
  favorites: number;
}

// ============================================================
// Creator Marketplace
// ============================================================

export type CreatorSubmissionStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'DISABLED';

export interface CreatorMarketSubmission {
  submissionId: string;
  creatorId: string;
  name: string;
  description: string;
  itemType: MarketItemType;
  rarity: MarketRarity;
  imageUrl: string | null;
  proposedPriceStars: number;
  status: CreatorSubmissionStatus;
  reviewerId: string | null;
  reviewNotes: string | null;
  publishedItemId: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

/**
 * Server-side revenue split. Calculated ONLY from the completed
 * transaction record — never from frontend values.
 */
export interface CreatorRevenueRecord {
  revenueId: string;
  creatorId: string;
  itemId: string;
  transactionId: string;
  grossAmount: number;
  platformShareBps: number;
  platformShare: number;
  creatorShare: number;
  adjustments: number;
  /** Estimates vs finalized values are distinguishable for reporting. */
  status: 'ESTIMATED' | 'FINALIZED' | 'PAID_OUT' | 'ADJUSTED';
  createdAt: Date;
}

export interface CreatorPayoutLedgerEntry {
  payoutEntryId: string;
  creatorId: string;
  grossAmount: number;
  platformShare: number;
  creatorShare: number;
  adjustments: number;
  netPayable: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'HELD';
  createdAt: Date;
}

// ============================================================
// Gifting & Future Trading Architecture
// ============================================================

export interface MarketGift {
  giftId: string;
  senderId: string;
  recipientId: string;
  itemId: string;
  message: string | null;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  sourceOwnershipId: string | null;
  transactionId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Future secondary-market listing architecture.
 * Creation is BLOCKED while tradingEnabled === false (MVP default).
 */
export interface MarketListing {
  listingId: string;
  sellerId: string;
  itemId: string;
  userItemId: string;
  price: number;
  currency: 'STARS';
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'EXPIRED';
  expiresAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Fraud & Audit
// ============================================================

export interface MarketFraudCase {
  caseId: string;
  userId: string;
  flagType:
    | 'PURCHASE_ABUSE'
    | 'REFUND_ABUSE'
    | 'GIFT_ABUSE'
    | 'TRADING_ABUSE'
    | 'AUTOMATED_PURCHASING'
    | 'INVENTORY_ANOMALY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: Record<string, unknown>;
  status: 'detected' | 'reviewing' | 'confirmed' | 'dismissed';
  createdAt: Date;
}

export interface MarketAuditLog {
  auditId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Analytics
// ============================================================

export type MarketFunnelStage =
  | 'market_open'
  | 'item_view'
  | 'purchase_click'
  | 'payment_started'
  | 'purchase_completed'
  | 'item_equipped';

export interface MarketAnalyticsEvent {
  eventId: string;
  eventName: MarketFunnelStage | string;
  userId: string | null;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export interface MarketFunnelReport {
  stages: { stage: MarketFunnelStage; count: number; dropOffPercent: number }[];
}

export interface MarketRevenueDashboard {
  /** Completed, verified Stars volume. Finalized value. */
  grossStarsSales: number;
  completedPurchases: number;
  pendingPurchases: number;
  conversionRate: number; // purchases / item views
  averagePurchaseStars: number;
  topItems: { itemId: string; name: string; sales: number }[];
  topCollections: { collectionId: string; name: string; sales: number }[];
  creatorSales: { creatorId: string; grossStars: number; creatorShareStars: number }[];
}

// ============================================================
// API Response Envelopes
// ============================================================

export interface MarketItemCard {
  itemId: string;
  name: string;
  type: MarketItemType;
  rarity: MarketRarity;
  image: string | null;
  price: number | null;
  currency: 'STARS' | null;
  earnable: boolean;
  owned: boolean;
  cta: 'OWNED' | 'GET' | 'BUY WITH STARS';
}

export interface MarketItemDetail extends MarketItem {
  collectionName: string | null;
  price: number | null;
  currency: 'STARS' | null;
  earnMethod: string | null;
  ownership: {
    owned: boolean;
    acquiredAt: Date | null;
    source: MarketOwnershipSource | null;
  };
  favorited: boolean;
  wishlisted: boolean;
}
