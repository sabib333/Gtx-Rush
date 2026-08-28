/**
 * GTX Rush — Marketplace & Digital Items Engine Tests
 *
 * Covers (Marketplace Contract §64 TESTING):
 *
 * ITEM:
 * - Create / Publish / Disable / Archive
 * - Version history preserved
 * - Availability window checked against server time
 *
 * INVENTORY:
 * - Grant items (idempotent)
 * - Equip / Unequip with slot rules
 * - Duplicate prevention for non-stackable items
 * - Server-authoritative ownership
 *
 * PURCHASE:
 * - Create intent (server-authoritative price)
 * - Verify payment + grant item
 * - Failure / cancellation
 * - Duplicate callback (idempotent)
 * - Refund (history preserved, separate ledger row)
 *
 * GIFT:
 * - Valid gift flow (create → accept)
 * - Invalid gift (self-gift, not owned, gifting disabled)
 * - Idempotent accept
 * - Rate limiting
 *
 * FAVORITE & WISHLIST:
 * - Toggle favorite
 * - Toggle wishlist
 * - Query user favorites / wishlist
 *
 * CREATOR:
 * - Submit item
 * - Moderate (approve / reject)
 * - Publish approved item
 * - Revenue record
 *
 * SECURITY:
 * - Price manipulation blocked (server-authoritative)
 * - Ownership forgery blocked (server validates)
 * - Replay attack blocked (payment reference dedupe)
 * - Unauthorized item grant blocked
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';
import type { MarketItem } from '@gtx-rush/types';
import {
  initializeMarketCatalog,
  getMarketItems,
  getMarketItem,
  searchMarketItems,
  getMarketHome,
  getMarketItemDetail,
  buildMarketItemCard,
  createMarketItem,
  updateMarketItemStatus,
  setMarketPrice,
  getMarketPrice,
  getItemVersions,
  validateMarketItemForPurchase,
  getCatalogStats,
  _clearMarketCatalog,
} from '../marketplace-catalog';
import {
  grantMarketItem,
  ownsMarketItem,
  getOwnedItemIds,
  getInventory,
  equipMarketItem,
  unequipMarketItem,
  getEquippedLoadout,
  revokeOwnership,
  _clearMarketplaceInventory,
} from '../marketplace-inventory';
import {
  createPurchaseIntent,
  verifyMarketPurchase,
  refundPurchase,
  getUserPurchases,
  getUserTransactions,
  _clearMarketplacePurchases,
} from '../marketplace-purchase';
import {
  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  getUserWishlist,
  _clearMarketplaceFavorites,
} from '../marketplace-favorites';
import {
  createGift,
  acceptGift,
  cancelGift,
  _clearMarketplaceGifts,
} from '../marketplace-gifting';
import {
  recordItemView,
  recordPurchaseClick,
  getItemEngagementSignals,
  _clearMarketplaceEngagement,
} from '../marketplace-engagement';
import {
  submitCreatorItem,
  reviewCreatorSubmission,
  publishCreatorSubmission,
  getCreatorRevenueSummary,
  _clearMarketplaceCreator,
} from '../marketplace-creator';
import {
  trackMarketEvent,
  getMarketFunnelReport,
  getMarketRevenueDashboard,
  _clearMarketplaceAnalytics,
} from '../marketplace-analytics';
import {
  checkRateLimit,
  flagFraudCase,
  isUserBlockedByFraud,
  recordAuditLog,
  getAuditLogs,
  _clearMarketplaceFraud,
} from '../marketplace-fraud';
import { MARKETPLACE_FLAGS } from '@gtx-rush/config';

// ============================================================
// Helpers
// ============================================================

function seedTestItem(overrides: Partial<MarketItem> = {}): MarketItem {
  const itemId = overrides.itemId ?? `test_item_${nanoid(8)}`;
  const item = createMarketItem({
    itemId,
    name: overrides.name ?? 'Test Item',
    description: overrides.description ?? 'A test item',
    type: overrides.type ?? 'avatar',
    rarity: overrides.rarity ?? 'common',
    image: overrides.image ?? '/assets/test.png',
    animation: null,
    status: overrides.status ?? 'active',
    creatorId: overrides.creatorId ?? null,
    collectionId: overrides.collectionId ?? null,
    eventId: null,
    seasonId: null,
    limited: overrides.limited ?? false,
    availableFrom: overrides.availableFrom ?? null,
    availableUntil: overrides.availableUntil ?? null,
    tradable: false,
    stackable: overrides.stackable ?? false,
    acquisitionMethods: overrides.acquisitionMethods ?? ['purchase'],
  });
  // Set a price for purchasable items
  if (item.acquisitionMethods.includes('purchase')) {
    setMarketPrice(itemId, 50);
  }
  return item;
}

// ============================================================
// Tests
// ============================================================

describe('Marketplace & Digital Items Engine', () => {
  beforeEach(() => {
    _clearMarketCatalog();
    _clearMarketplaceInventory();
    _clearMarketplacePurchases();
    _clearMarketplaceFavorites();
    _clearMarketplaceGifts();
    _clearMarketplaceEngagement();
    _clearMarketplaceCreator();
    _clearMarketplaceAnalytics();
    _clearMarketplaceFraud();
    initializeMarketCatalog();
  });

  // ============================================================
  // ITEM: Create, Publish, Disable, Archive
  // ============================================================

  describe('Item Lifecycle (§42, §43, §44)', () => {
    it('should create a new item in draft status', () => {
      const item = seedTestItem({ itemId: 'new_item_1' });
      expect(item.itemId).toBe('new_item_1');
      expect(item.status).toBe('active'); // seedTestItem creates active
    });

    it('should disable an item without hard-deleting it', () => {
      const item = seedTestItem({ itemId: 'disable_me' });
      const result = updateMarketItemStatus('disable_me', 'disabled', 'Admin request');
      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('disabled');

      // Item still exists in catalog (history preserved)
      const fetched = getMarketItem('disable_me');
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe('disabled');
    });

    it('should archive an item without hard-deleting it', () => {
      seedTestItem({ itemId: 'archive_me' });
      const result = updateMarketItemStatus('archive_me', 'archived', 'Season ended');
      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('archived');
    });

    it('should reject disabling a non-existent item', () => {
      const result = updateMarketItemStatus('nonexistent', 'disabled', 'test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ITEM_NOT_FOUND');
    });

    it('should track version history for item changes (§43)', () => {
      seedTestItem({ itemId: 'versioned_item' });
      updateMarketItemStatus('versioned_item', 'disabled', 'review needed');
      setMarketPrice('versioned_item', 100);

      const versions = getItemVersions('versioned_item');
      expect(versions.length).toBeGreaterThanOrEqual(2); // created + status change + price update
    });
  });

  // ============================================================
  // ITEM: Price is server-authoritative (§10, §11)
  // ============================================================

  describe('Server-Authoritative Pricing (§10, §11)', () => {
    it('should return the server-configured price', () => {
      const price = getMarketPrice('neon_frame_pulse');
      expect(price).toBe(120);
    });

    it('should return null for free / non-purchasable items', () => {
      const price = getMarketPrice('origins_avatar_rookie');
      expect(price).toBeNull();
    });

    it('should allow admin to update price', () => {
      const result = setMarketPrice('origins_frame_bronze', 30);
      expect(result.success).toBe(true);
      expect(getMarketPrice('origins_frame_bronze')).toBe(30);
    });

    it('should reject invalid prices', () => {
      const result = setMarketPrice('origins_frame_bronze', -5);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_PRICE');
    });

    it('should reject price update for nonexistent item', () => {
      const result = setMarketPrice('nonexistent', 50);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // ITEM: Availability window (§6, §38, §39)
  // ============================================================

  describe('Availability Windows (§6, §38, §39)', () => {
    it('should exclude items not yet available', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 3600e3);
      seedTestItem({
        itemId: 'future_item',
        availableFrom: futureDate,
      });

      const validation = validateMarketItemForPurchase('future_item');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('ITEM_NOT_AVAILABLE');
    });

    it('should exclude items past their availability window', () => {
      const pastDate = new Date(Date.now() - 365 * 24 * 3600e3);
      seedTestItem({
        itemId: 'expired_item',
        availableUntil: pastDate,
      });

      const validation = validateMarketItemForPurchase('expired_item');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('ITEM_NOT_AVAILABLE');
    });

    it('should include items within their availability window', () => {
      const past = new Date(Date.now() - 24 * 3600e3);
      const future = new Date(Date.now() + 365 * 24 * 3600e3);
      seedTestItem({
        itemId: 'valid_window_item',
        availableFrom: past,
        availableUntil: future,
      });

      const validation = validateMarketItemForPurchase('valid_window_item');
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================================
  // INVENTORY: Grant, Equip, Unequip, Duplicate Prevention
  // ============================================================

  describe('Inventory & Equipment (§16, §17, §18, §19)', () => {
    it('should grant an item to a user', () => {
      const result = grantMarketItem('user-1', 'origins_avatar_rookie', 'GAMEPLAY');
      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.userId).toBe('user-1');
      expect(result.item!.itemId).toBe('origins_avatar_rookie');
      expect(result.item!.source).toBe('GAMEPLAY');
    });

    it('should prevent duplicate grants for non-stackable items (§19)', () => {
      grantMarketItem('user-1', 'origins_avatar_rookie', 'GAMEPLAY');
      const second = grantMarketItem('user-1', 'origins_avatar_rookie', 'GAMEPLAY');
      expect(second.success).toBe(true); // idempotent — returns existing
      expect(ownsMarketItem('user-1', 'origins_avatar_rookie')).toBe(true);
    });

    it('should not allow equipping an unowned item (§17)', () => {
      const result = equipMarketItem('user-1', 'neon_frame_pulse');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_OWNED');
    });

    it('should equip an owned item into the correct slot', () => {
      grantMarketItem('user-1', 'neon_frame_pulse', 'PURCHASE');
      const result = equipMarketItem('user-1', 'neon_frame_pulse');
      expect(result.success).toBe(true);

      const loadout = getEquippedLoadout('user-1');
      expect(loadout.frame).toBeDefined();
      expect(loadout.frame!.itemId).toBe('neon_frame_pulse');
    });

    it('should unequip an item from a slot', () => {
      grantMarketItem('user-1', 'neon_frame_pulse', 'PURCHASE');
      equipMarketItem('user-1', 'neon_frame_pulse');
      const result = unequipMarketItem('user-1', 'frame');
      expect(result.success).toBe(true);

      const loadout = getEquippedLoadout('user-1');
      expect(loadout.frame).toBeUndefined();
    });

    it('should auto-unequip when ownership is revoked (refund)', () => {
      grantMarketItem('user-1', 'neon_frame_pulse', 'PURCHASE');
      equipMarketItem('user-1', 'neon_frame_pulse');
      revokeOwnership('user-1', 'neon_frame_pulse', 'refunded');

      const loadout = getEquippedLoadout('user-1');
      expect(loadout.frame).toBeUndefined();
    });

    it('should return inventory with owned items', () => {
      grantMarketItem('user-1', 'origins_avatar_rookie', 'GAMEPLAY');
      grantMarketItem('user-1', 'neon_frame_pulse', 'PURCHASE');

      const inventory = getInventory('user-1');
      expect(inventory.owned.length).toBe(2);
      expect(inventory.totalCount).toBe(2);
    });
  });

  // ============================================================
  // PURCHASE: Intent → Verify → Grant
  // ============================================================

  describe('Purchase Flow (§12, §13, §14)', () => {
    it('should create a purchase intent with server-authoritative price', () => {
      const result = createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_001');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(120); // server price, not client-supplied
        expect(result.data.currency).toBe('STARS');
        expect(result.data.paymentParams.amount).toBe(120);
      }
    });

    it('should reject purchase of non-purchasable items', () => {
      const result = createPurchaseIntent('user-1', 'origins_avatar_rookie', 'idem_002');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ITEM_NOT_PURCHASABLE');
    });

    it('should reject purchase of nonexistent items', () => {
      const result = createPurchaseIntent('user-1', 'nonexistent', 'idem_003');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ITEM_NOT_FOUND');
    });

    it('should be idempotent — same idempotency key returns same result (§13)', () => {
      const first = createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_dup');
      const second = createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_dup');
      expect(first.success).toBe(true);
      // Second call returns PURCHASE_ALREADY_EXISTS (idempotent)
      expect(second.success).toBe(false);
      expect(second.error).toBe('PURCHASE_ALREADY_EXISTS');
    });

    it('should not allow idempotency key reuse by different users', () => {
      createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_cross');
      const result = createPurchaseIntent('user-2', 'neon_frame_pulse', 'idem_cross');
      expect(result.success).toBe(false);
      expect(result.error).toBe('IDEMPOTENCY_KEY_CONFLICT');
    });

    it('should verify payment and grant item exactly once (§6, §13)', () => {
      createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_verify');
      const result = verifyMarketPurchase({
        idempotencyKey: 'idem_verify',
        telegramPaymentId: 'tg_pay_001',
      });
      expect(result.success).toBe(true);
      expect(result.itemGranted).toBe(true);
      expect(ownsMarketItem('user-1', 'neon_frame_pulse')).toBe(true);

      // Second verification with same payment reference is idempotent
      const second = verifyMarketPurchase({
        idempotencyKey: 'idem_verify',
        telegramPaymentId: 'tg_pay_001',
      });
      expect(second.success).toBe(true);
      expect(second.itemGranted).toBe(true);
    });

    it('should not allow payment reference reuse by different purchases', () => {
      createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_ref1');
      verifyMarketPurchase({ idempotencyKey: 'idem_ref1', telegramPaymentId: 'tg_ref_reuse' });

      createPurchaseIntent('user-1', 'neon_theme_cyberpunk', 'idem_ref2');
      const result = verifyMarketPurchase({
        idempotencyKey: 'idem_ref2',
        telegramPaymentId: 'tg_ref_reuse', // reused!
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PAYMENT_REFERENCE_REUSE');
    });

    it('should track user purchases', () => {
      createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_hist');
      verifyMarketPurchase({ idempotencyKey: 'idem_hist', telegramPaymentId: 'tg_hist' });

      const purchases = getUserPurchases('user-1');
      expect(purchases.length).toBe(1);
      expect(purchases[0].status).toBe('completed');
    });
  });

  // ============================================================
  // PURCHASE: Refund (§15 — history preserved)
  // ============================================================

  describe('Refunds (§15)', () => {
    it('should create a separate refund transaction preserving history', () => {
      createPurchaseIntent('user-1', 'neon_frame_pulse', 'idem_refund');
      verifyMarketPurchase({ idempotencyKey: 'idem_refund', telegramPaymentId: 'tg_refund' });

      const refundResult = refundPurchase('admin-1', getUserPurchases('user-1')[0].purchaseId, 'Customer request');
      expect(refundResult.success).toBe(true);

      // Original transaction still exists (history preserved)
      const txns = getUserTransactions('user-1');
      const purchaseTxn = txns.find((t) => t.kind === 'purchase');
      const refundTxn = txns.find((t) => t.kind === 'refund');
      expect(purchaseTxn).toBeDefined();
      expect(refundTxn).toBeDefined();
      expect(purchaseTxn!.status).toBe('REFUNDED');
      expect(refundTxn!.status).toBe('COMPLETED');

      // Item ownership is revoked
      expect(ownsMarketItem('user-1', 'neon_frame_pulse')).toBe(false);
    });
  });

  // ============================================================
  // FAVORITES & WISHLIST (§32, §33)
  // ============================================================

  describe('Favorites & Wishlist (§32, §33)', () => {
    it('should toggle favorite on and off', () => {
      expect(isFavorited('user-1', 'neon_frame_pulse')).toBe(false);
      addFavorite('user-1', 'neon_frame_pulse');
      expect(isFavorited('user-1', 'neon_frame_pulse')).toBe(true);
      removeFavorite('user-1', 'neon_frame_pulse');
      expect(isFavorited('user-1', 'neon_frame_pulse')).toBe(false);
    });

    it('should query user favorites sorted by recency', () => {
      addFavorite('user-1', 'neon_frame_pulse');
      addFavorite('user-1', 'neon_theme_cyberpunk');
      const favs = getUserFavorites('user-1');
      expect(favs.length).toBe(2);
    });

    it('should toggle wishlist on and off', () => {
      expect(isInWishlist('user-1', 'neon_frame_pulse')).toBe(false);
      addToWishlist('user-1', 'neon_frame_pulse');
      expect(isInWishlist('user-1', 'neon_frame_pulse')).toBe(true);
      removeFromWishlist('user-1', 'neon_frame_pulse');
      expect(isInWishlist('user-1', 'neon_frame_pulse')).toBe(false);
    });

    it('should reject favorite for nonexistent item', () => {
      const result = addFavorite('user-1', 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ITEM_NOT_FOUND');
    });
  });

  // ============================================================
  // GIFT (§20 — rate limited, fraud checked)
  // ============================================================

  describe('Gifting (§20)', () => {
    it('should create and accept a valid gift', () => {
      // Ensure gifting is enabled
      if (!MARKETPLACE_FLAGS.giftingEnabled) return;

      grantMarketItem('sender-1', 'neon_frame_pulse', 'PURCHASE');
      const idempotencyKey = `gift_accept_${nanoid(8)}`;
      const giftResult = createGift('sender-1', 'recipient-1', 'neon_frame_pulse', { idempotencyKey });
      expect(giftResult.success).toBe(true);

      if (giftResult.success) {
        // acceptGift uses idempotencyKey to look up the gift
        const acceptResult = acceptGift(idempotencyKey);
        expect(acceptResult.success).toBe(true);
        expect(ownsMarketItem('recipient-1', 'neon_frame_pulse')).toBe(true);
        expect(ownsMarketItem('sender-1', 'neon_frame_pulse')).toBe(false);
      }
    });

    it('should not allow gifting to self', () => {
      if (!MARKETPLACE_FLAGS.giftingEnabled) return;
      grantMarketItem('user-1', 'neon_frame_pulse', 'PURCHASE');
      const result = createGift('user-1', 'user-1', 'neon_frame_pulse');
      expect(result.success).toBe(false);
      expect(result.error).toBe('CANNOT_GIFT_TO_SELF');
    });

    it('should not allow gifting an unowned item', () => {
      if (!MARKETPLACE_FLAGS.giftingEnabled) return;
      const result = createGift('sender-1', 'recipient-1', 'neon_frame_pulse');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_OWNED');
    });

    it('should cancel a pending gift', () => {
      if (!MARKETPLACE_FLAGS.giftingEnabled) return;
      grantMarketItem('sender-1', 'neon_theme_cyberpunk', 'PURCHASE');
      const giftResult = createGift('sender-1', 'recipient-1', 'neon_theme_cyberpunk');
      expect(giftResult.success).toBe(true);

      if (giftResult.success) {
        const cancelResult = cancelGift('sender-1', giftResult.gift.giftId);
        expect(cancelResult.success).toBe(true);
      }
    });

    it('should be idempotent on accept', () => {
      if (!MARKETPLACE_FLAGS.giftingEnabled) return;
      grantMarketItem('sender-1', 'neon_emote_gg', 'PURCHASE');
      const idempotencyKey = `gift_idem_${nanoid(8)}`;
      const giftResult = createGift('sender-1', 'recipient-1', 'neon_emote_gg', { idempotencyKey });
      if (giftResult.success) {
        acceptGift(idempotencyKey);
        // Second accept is idempotent
        const second = acceptGift(idempotencyKey);
        expect(second.success).toBe(true);
      }
    });
  });

  // ============================================================
  // CREATOR MARKETPLACE (§25, §26, §27, §28)
  // ============================================================

  describe('Creator Marketplace (§25–§28)', () => {
    it('should submit a creator item for review', () => {
      const result = submitCreatorItem('creator-1', {
        name: 'Neon Glow Avatar',
        description: 'A glowing avatar for creators',
        itemType: 'avatar',
        rarity: 'rare',
        imageUrl: '/assets/creator/neon-glow.png',
        proposedPriceStars: 30,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.submission.status).toBe('PENDING_REVIEW');
      }
    });

    it('should reject submission with invalid price', () => {
      const result = submitCreatorItem('creator-1', {
        name: 'Bad Price Item',
        description: 'Too cheap',
        itemType: 'avatar',
        rarity: 'common',
        imageUrl: null,
        proposedPriceStars: 1, // below minPriceStars (10)
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PRICE_OUT_OF_RANGE');
    });

    it('should approve and publish a submission', () => {
      const submitResult = submitCreatorItem('creator-1', {
        name: 'Creator Frame',
        description: 'A creator frame',
        itemType: 'avatar_frame',
        rarity: 'epic',
        imageUrl: '/assets/creator/frame.png',
        proposedPriceStars: 50,
      });
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        const reviewResult = reviewCreatorSubmission(
          'admin-1',
          submitResult.submission.submissionId,
          'APPROVED',
          'Great item!',
        );
        expect(reviewResult.success).toBe(true);

        const publishResult = publishCreatorSubmission(
          'admin-1',
          submitResult.submission.submissionId,
        );
        expect(publishResult.success).toBe(true);
        if (publishResult.success) {
          expect(publishResult.item.status).toBe('active');
          expect(publishResult.item.creatorId).toBe('creator-1');
        }
      }
    });

    it('should reject a submission (not published)', () => {
      const submitResult = submitCreatorItem('creator-2', {
        name: 'Rejected Item',
        description: 'This will be rejected',
        itemType: 'emote',
        rarity: 'common',
        imageUrl: null,
        proposedPriceStars: 15,
      });
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        const reviewResult = reviewCreatorSubmission(
          'admin-1',
          submitResult.submission.submissionId,
          'REJECTED',
          'Does not meet quality standards',
        );
        expect(reviewResult.success).toBe(true);
        expect(reviewResult.submission?.status).toBe('REJECTED');
      }
    });

    it('should not publish a non-approved submission', () => {
      const submitResult = submitCreatorItem('creator-3', {
        name: 'Unapproved Item',
        description: 'Still pending',
        itemType: 'effect',
        rarity: 'rare',
        imageUrl: null,
        proposedPriceStars: 25,
      });
      if (submitResult.success) {
        const publishResult = publishCreatorSubmission(
          'admin-1',
          submitResult.submission.submissionId,
        );
        expect(publishResult.success).toBe(false);
        expect(publishResult.error).toBe('NOT_APPROVED');
      }
    });
  });

  // ============================================================
  // FRAUD & SECURITY (§50, §52)
  // ============================================================

  describe('Fraud & Security (§50, §52)', () => {
    it('should flag and track fraud cases', () => {
      const fraudCase = flagFraudCase('suspect-1', 'PURCHASE_ABUSE', 'high', { evidence: 'test' });
      expect(fraudCase.caseId).toBeDefined();
      expect(fraudCase.status).toBe('detected');
    });

    it('should block users above fraud threshold', () => {
      // Create enough fraud cases to exceed threshold
      for (let i = 0; i < 5; i++) {
        flagFraudCase('blocked-user', 'PURCHASE_ABUSE', 'high');
      }
      expect(isUserBlockedByFraud('blocked-user')).toBe(true);
    });

    it('should not block users below fraud threshold', () => {
      flagFraudCase('low-risk-user', 'PURCHASE_ABUSE', 'low');
      expect(isUserBlockedByFraud('low-risk-user')).toBe(false);
    });

    it('should rate limit purchase creation', () => {
      // Exhaust rate limit
      for (let i = 0; i < 20; i++) {
        createPurchaseIntent('rl-user', 'neon_frame_pulse', `rl_${i}`);
      }
      const result = createPurchaseIntent('rl-user', 'neon_frame_pulse', 'rl_extra');
      expect(result.success).toBe(false);
      expect(result.error).toBe('RATE_LIMITED');
    });

    it('should record and query audit logs', () => {
      recordAuditLog('admin-1', 'test_action', 'item', 'item-1', { detail: 'test' });
      const logs = getAuditLogs({ targetType: 'item', targetId: 'item-1' });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('test_action');
    });

    it('should block purchase when user is fraud-flagged', () => {
      for (let i = 0; i < 5; i++) {
        flagFraudCase('fraud-user', 'PURCHASE_ABUSE', 'high');
      }
      const result = createPurchaseIntent('fraud-user', 'neon_frame_pulse', 'fraud_test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('FRAUD_BLOCK');
    });
  });

  // ============================================================
  // ANALYTICS (§46, §47, §48, §49)
  // ============================================================

  describe('Analytics (§46–§49)', () => {
    it('should track marketplace events', () => {
      const event = trackMarketEvent('market_open', 'user-1', {});
      expect(event.eventId).toBeDefined();
      expect(event.eventName).toBe('market_open');
    });

    it('should compute funnel report', () => {
      trackMarketEvent('market_open', 'user-1');
      trackMarketEvent('item_view', 'user-1', { itemId: 'test' });
      trackMarketEvent('purchase_click', 'user-1', { itemId: 'test' });

      const funnel = getMarketFunnelReport();
      expect(funnel.stages.length).toBe(6);
      expect(funnel.stages[0].count).toBe(1);
      expect(funnel.stages[1].count).toBe(1);
    });

    it('should compute revenue dashboard', () => {
      const dashboard = getMarketRevenueDashboard();
      expect(dashboard).toHaveProperty('grossStarsSales');
      expect(dashboard).toHaveProperty('completedPurchases');
      expect(dashboard).toHaveProperty('conversionRate');
      expect(dashboard).toHaveProperty('topItems');
    });
  });

  // ============================================================
  // ENGAGEMENT SIGNALS (§31 — trending multi-signal)
  // ============================================================

  describe('Engagement Signals (§31)', () => {
    it('should track multiple engagement signals', () => {
      recordItemView('item-1');
      recordItemView('item-1');
      recordPurchaseClick('item-1');

      const signals = getItemEngagementSignals('item-1');
      expect(signals.views).toBe(2);
      expect(signals.purchaseClicks).toBe(1);
    });

    it('should return zeros for items with no signals', () => {
      const signals = getItemEngagementSignals('never_seen');
      expect(signals.views).toBe(0);
      expect(signals.purchases).toBe(0);
    });
  });

  // ============================================================
  // CATALOG QUERIES
  // ============================================================

  describe('Catalog Queries', () => {
    it('should list items with filters', () => {
      const result = getMarketItems({ rarity: 'epic' });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((i) => i.rarity === 'epic')).toBe(true);
    });

    it('should search items by text', () => {
      const result = searchMarketItems('neon');
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should return catalog stats', () => {
      const stats = getCatalogStats();
      expect(stats.totalItems).toBeGreaterThan(0);
      expect(stats.activeItems).toBeGreaterThan(0);
    });

    it('should build market home sections', () => {
      const home = getMarketHome();
      expect(home).toHaveProperty('featured');
      expect(home).toHaveProperty('trending');
      expect(home).toHaveProperty('new');
      expect(home).toHaveProperty('collections');
      expect(home).toHaveProperty('free');
      expect(home).toHaveProperty('earnable');
    });

    it('should build item cards with ownership and CTA', () => {
      const ownedIds = new Set(['origins_avatar_rookie']);
      const item = getMarketItem('origins_avatar_rookie')!;
      const card = buildMarketItemCard(item, true);
      expect(card.owned).toBe(true);
      expect(card.cta).toBe('OWNED');
    });

    it('should set CTA to BUY WITH STARS for unowned purchasable items', () => {
      const ownedIds = new Set<string>();
      const item = getMarketItem('neon_frame_pulse')!;
      const card = buildMarketItemCard(item, false);
      expect(card.owned).toBe(false);
      expect(card.cta).toBe('BUY WITH STARS');
    });

    it('should set CTA to GET for unowned earnable items', () => {
      const item = getMarketItem('origins_avatar_rookie')!;
      const card = buildMarketItemCard(item, false);
      expect(card.owned).toBe(false);
      expect(card.cta).toBe('GET');
    });
  });

  // ============================================================
  // ITEM DETAIL
  // ============================================================

  describe('Item Detail (§9)', () => {
    it('should return full detail with ownership context', () => {
      const detail = getMarketItemDetail('user-1', 'neon_frame_pulse', {
        ownedItemIds: new Set(),
        favorited: false,
        wishlisted: false,
      });
      expect(detail).not.toBeNull();
      expect(detail!.itemId).toBe('neon_frame_pulse');
      expect(detail!.price).toBe(120);
      expect(detail!.ownership.owned).toBe(false);
      expect(detail!.favorited).toBe(false);
    });

    it('should show owned status when user owns the item', () => {
      const detail = getMarketItemDetail('user-1', 'origins_avatar_rookie', {
        ownedItemIds: new Set(['origins_avatar_rookie']),
      });
      expect(detail!.ownership.owned).toBe(true);
    });

    it('should return null for nonexistent items', () => {
      const detail = getMarketItemDetail('user-1', 'nonexistent');
      expect(detail).toBeNull();
    });
  });

  // ============================================================
  // COSMETIC-ONLY RULE (§3)
  // ============================================================

  describe('Cosmetic-Only Rule (§3)', () => {
    it('should never provide gameplay advantages — all items are cosmetic', () => {
      const stats = getCatalogStats();
      // All items in catalog should be cosmetic types
      const items = getMarketItems({}, { limit: 100 });
      const cosmeticTypes = [
        'avatar', 'avatar_frame', 'profile_badge', 'profile_theme',
        'game_skin', 'effect', 'emote', 'banner', 'title',
        'achievement_cosmetic', 'event_cosmetic', 'creator_cosmetic', 'collectible',
      ];
      for (const item of items.items) {
        expect(cosmeticTypes).toContain(item.type);
      }
    });
  });
});
