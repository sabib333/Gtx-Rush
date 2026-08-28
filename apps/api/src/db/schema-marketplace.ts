/**
 * GTX Rush — Marketplace & Digital Items Database Schema
 *
 * Drizzle ORM schema definitions for PostgreSQL.
 * Complements the Economy Engine ledger (reuses users, economy
 * transactions, payment records, analytics_events, fraud_flags).
 *
 * DO NOT generate migrations yet — this is the schema definition.
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================
// Enums
// ============================================================

export const marketItemTypeEnum = pgEnum('market_item_type', [
  'avatar',
  'avatar_frame',
  'profile_badge',
  'profile_theme',
  'game_skin',
  'effect',
  'emote',
  'banner',
  'title',
  'achievement_cosmetic',
  'event_cosmetic',
  'creator_cosmetic',
  'collectible',
]);

export const marketRarityEnum = pgEnum('market_rarity', [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
]);

export const marketItemStatusEnum = pgEnum('market_item_status', [
  'draft',
  'active',
  'disabled',
  'archived',
]);

export const marketAcquisitionMethodEnum = pgEnum('market_acquisition_method', [
  'purchase',
  'earnable',
]);

export const marketOwnershipSourceEnum = pgEnum('market_ownership_source', [
  'PURCHASE',
  'GAMEPLAY',
  'EVENT',
  'MISSION',
  'ACHIEVEMENT',
  'GIFT',
  'CREATOR',
  'ADMIN_GRANT',
]);

export const marketOwnershipStatusEnum = pgEnum('market_ownership_status', [
  'owned',
  'refunded',
  'revoked',
]);

export const marketTransactionKindEnum = pgEnum('market_transaction_kind', [
  'purchase',
  'refund',
  'gift_transfer',
]);

export const marketTransactionStatusEnum = pgEnum('market_transaction_status', [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
]);

export const creatorSubmissionStatusEnum = pgEnum('creator_submission_status', [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'DISABLED',
]);

export const creatorRevenueStatusEnum = pgEnum('creator_revenue_status', [
  'ESTIMATED',
  'FINALIZED',
  'PAID_OUT',
  'ADJUSTED',
]);

export const creatorPayoutStatusEnum = pgEnum('creator_payout_status', [
  'PENDING',
  'APPROVED',
  'PAID',
  'HELD',
]);

export const marketGiftStatusEnum = pgEnum('market_gift_status', [
  'PENDING',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
]);

export const marketListingStatusEnum = pgEnum('market_listing_status', [
  'ACTIVE',
  'SOLD',
  'CANCELLED',
  'EXPIRED',
]);

export const marketFraudTypeEnum = pgEnum('market_fraud_type', [
  'PURCHASE_ABUSE',
  'REFUND_ABUSE',
  'GIFT_ABUSE',
  'TRADING_ABUSE',
  'AUTOMATED_PURCHASING',
  'INVENTORY_ANOMALY',
]);

// ============================================================
// Items & Versions
// ============================================================

export const marketItems = pgTable('market_items', {
  itemId: varchar('item_id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  type: marketItemTypeEnum('type').notNull(),
  rarity: marketRarityEnum('rarity').notNull().default('common'),
  image: text('image'),
  animation: text('animation'),
  status: marketItemStatusEnum('status').notNull().default('draft'),
  creatorId: uuid('creator_id'),
  collectionId: varchar('collection_id', { length: 64 }),
  eventId: uuid('event_id'),
  seasonId: varchar('season_id', { length: 64 }),
  limited: boolean('limited').notNull().default(false),
  availableFrom: timestamp('available_from'),
  availableUntil: timestamp('available_until'),
  /** Trading disabled in MVP — reserved for a future protocol. */
  tradable: boolean('tradable').notNull().default(false),
  stackable: boolean('stackable').notNull().default(false),
  acquisitionMethods: jsonb('acquisition_methods')
    .$type<string[]>()
    .notNull()
    .default([]),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_market_items_type_status').on(table.type, table.status),
  index('idx_market_items_rarity').on(table.rarity),
  index('idx_market_items_collection').on(table.collectionId),
  index('idx_market_items_creator').on(table.creatorId),
]);

/** Item versioning: core identity of purchased items is never silently altered. */
export const marketItemVersions = pgTable('market_item_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default({}),
  changeNote: varchar('change_note', { length: 256 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_market_item_versions_item_version').on(table.itemId, table.version),
]);

// ============================================================
// Collections
// ============================================================

export const marketCollections = pgTable('market_collections', {
  collectionId: varchar('collection_id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  description: text('description').default(''),
  image: text('image'),
  status: marketItemStatusEnum('status').notNull().default('active'),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const marketCollectionItems = pgTable('market_collection_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  collectionId: varchar('collection_id', { length: 64 }).notNull(),
  itemId: varchar('item_id', { length: 64 }).notNull(),
}, (table) => [
  uniqueIndex('idx_market_collection_items_pair').on(table.collectionId, table.itemId),
]);

// ============================================================
// Prices (server-authoritative)
// ============================================================

export const marketPrices = pgTable('market_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('STARS'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_market_prices_item_status').on(table.itemId, table.status),
]);

// ============================================================
// Ownership / Inventory
// ============================================================

export const userMarketItems = pgTable('user_market_items', {
  userItemId: uuid('user_item_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  source: marketOwnershipSourceEnum('source').notNull(),
  referenceId: varchar('reference_id', { length: 128 }),
  status: marketOwnershipStatusEnum('status').notNull().default('owned'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  acquiredAt: timestamp('acquired_at').notNull().defaultNow(),
}, (table) => [
  index('idx_user_market_items_user').on(table.userId, table.acquiredAt),
  index('idx_user_market_items_user_item').on(table.userId, table.itemId),
]);

export const inventorySlots = pgTable('inventory_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  slot: varchar('slot', { length: 32 }).notNull(), // avatar | frame | theme | badge | effect | title
  userItemId: uuid('user_item_id'),
  equippedAt: timestamp('equipped_at'),
}, (table) => [
  uniqueIndex('idx_inventory_slots_user_slot').on(table.userId, table.slot),
]);

// ============================================================
// Purchases & Immutable Ledger
// ============================================================

export const marketPurchases = pgTable('market_purchases', {
  purchaseId: varchar('purchase_id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('STARS'),
  status: marketTransactionStatusEnum('status').notNull().default('PENDING'),
  telegramPaymentId: varchar('telegram_payment_id', { length: 128 }),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/**
 * Immutable transaction ledger. Refunds are separate rows referencing
 * the original purchase — rows are never deleted or mutated in place
 * beyond status transitions recorded with updatedAt.
 */
export const marketTransactions = pgTable('market_transactions', {
  transactionId: varchar('transaction_id', { length: 64 }).primaryKey(),
  purchaseId: varchar('purchase_id', { length: 64 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('STARS'),
  kind: marketTransactionKindEnum('kind').notNull().default('purchase'),
  paymentReference: varchar('payment_reference', { length: 128 }),
  status: marketTransactionStatusEnum('status').notNull().default('PENDING'),
  economyReferenceId: uuid('economy_reference_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_market_transactions_user_created').on(table.userId, table.createdAt),
  index('idx_market_transactions_purchase').on(table.purchaseId),
  index('idx_market_transactions_status').on(table.status, table.createdAt),
]);

// ============================================================
// Engagement: Favorites & Wishlist
// ============================================================

export const marketFavorites = pgTable('market_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_market_favorites_user_item').on(table.userId, table.itemId),
]);

export const marketWishlists = pgTable('market_wishlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  notifyOnAvailable: boolean('notify_on_available').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_market_wishlists_user_item').on(table.userId, table.itemId),
]);

/** Engagement signals for trending (views/clicks/equips — never purchases alone). */
export const marketEngagementSignals = pgTable('market_engagement_signals', {
  itemId: varchar('item_id', { length: 64 }).primaryKey(),
  views: integer('views').notNull().default(0),
  purchaseClicks: integer('purchase_clicks').notNull().default(0),
  purchases: integer('purchases').notNull().default(0),
  equips: integer('equips').notNull().default(0),
  favorites: integer('favorites').notNull().default(0),
  lastEventAt: timestamp('last_event_at'),
});

// ============================================================
// Creator Marketplace
// ============================================================

export const creatorItems = pgTable('creator_items', {
  submissionId: uuid('submission_id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').default(''),
  itemType: marketItemTypeEnum('item_type').notNull(),
  rarity: marketRarityEnum('rarity').notNull().default('common'),
  imageUrl: text('image_url'),
  proposedPriceStars: integer('proposed_price_stars').notNull(),
  status: creatorSubmissionStatusEnum('status').notNull().default('DRAFT'),
  reviewerId: uuid('reviewer_id'),
  reviewNotes: text('review_notes'),
  publishedItemId: varchar('published_item_id', { length: 64 }),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export const creatorPayouts = pgTable('creator_payouts', {
  revenueId: uuid('revenue_id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  transactionId: varchar('transaction_id', { length: 64 }).notNull(),
  grossAmount: integer('gross_amount').notNull(),
  platformShareBps: integer('platform_share_bps').notNull(),
  platformShare: integer('platform_share').notNull(),
  creatorShare: integer('creator_share').notNull(),
  adjustments: integer('adjustments').notNull().default(0),
  status: creatorRevenueStatusEnum('status').notNull().default('ESTIMATED'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const creatorPayoutLedger = pgTable('creator_payout_ledger', {
  payoutEntryId: uuid('payout_entry_id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  grossAmount: integer('gross_amount').notNull(),
  platformShare: integer('platform_share').notNull(),
  creatorShare: integer('creator_share').notNull(),
  adjustments: integer('adjustments').notNull().default(0),
  netPayable: integer('net_payable').notNull(),
  status: creatorPayoutStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_creator_payouts_creator').on(table.creatorId, table.createdAt),
]);

// ============================================================
// Gifting & Future Listings
// ============================================================

export const marketGifts = pgTable('market_gifts', {
  giftId: varchar('gift_id', { length: 64 }).primaryKey(),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  recipientId: uuid('recipient_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  message: varchar('message', { length: 256 }),
  status: marketGiftStatusEnum('status').notNull().default('PENDING'),
  sourceOwnershipId: uuid('source_ownership_id'),
  transactionId: varchar('transaction_id', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/** Reserved for a future explicit marketplace protocol. Creation blocked in MVP. */
export const marketListings = pgTable('market_listings', {
  listingId: varchar('listing_id', { length: 64 }).primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  userItemId: uuid('user_item_id').notNull(),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('STARS'),
  status: marketListingStatusEnum('status').notNull().default('ACTIVE'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_market_listings_seller_status').on(table.sellerId, table.status),
]);

// ============================================================
// Fraud & Audit Logs
// ============================================================

export const marketFraudCases = pgTable('market_fraud_cases', {
  caseId: uuid('case_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  flagType: marketFraudTypeEnum('flag_type').notNull(),
  severity: varchar('severity', { length: 16 }).notNull().default('low'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}),
  status: varchar('status', { length: 16 }).notNull().default('detected'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('idx_market_fraud_user_type').on(table.userId, table.flagType),
  index('idx_market_fraud_status').on(table.status, table.createdAt),
]);

export const marketAuditLogs = pgTable('market_audit_logs', {
  auditId: uuid('audit_id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_market_audit_target').on(table.targetType, table.targetId),
  index('idx_market_audit_actor').on(table.actorId, table.createdAt),
]);
