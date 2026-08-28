/**
 * GTX Rush — Marketplace Gifting Service v1.0
 *
 * GIFT FLOW:
 *   Sender → Ownership validation → Gift transaction → Recipient receives
 *
 * SECURITY:
 * - Rate limits (max gifts/day per sender)
 * - Fraud checks (risk score gate + abuse flagging)
 * - Idempotent: a gift completes exactly once
 * - Sender loses ownership; recipient gains it atomically in-memory
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { nanoid } from 'nanoid';
import type { MarketGift } from '@gtx-rush/types';
import { MARKETPLACE_FLAGS, MARKETPLACE_LIMITS } from '@gtx-rush/config';
import { getMarketItem } from './marketplace-catalog';
import {
  getOwnedRecord,
  grantMarketItem,
  revokeOwnership,
} from './marketplace-inventory';
import {
  checkRateLimit,
  isUserBlockedByFraud,
  flagFraudCase,
  recordAuditLog,
} from './marketplace-fraud';

// ============================================================
// In-memory store (production: PostgreSQL via Drizzle ORM)
// ============================================================

const gifts = new Map<string, MarketGift>();
const giftIndex = new Map<string, string>(); // idempotencyKey → giftId

// ============================================================
// Create Gift
// ============================================================

export function createGift(
  senderId: string,
  recipientId: string,
  itemId: string,
  options: {
    message?: string;
    idempotencyKey?: string;
  } = {},
): { success: true; gift: MarketGift } | { success: false; error: string } {
  if (!MARKETPLACE_FLAGS.giftingEnabled) return { success: false, error: 'GIFTING_DISABLED' };
  if (senderId === recipientId) return { success: false, error: 'CANNOT_GIFT_TO_SELF' };

  // Idempotency
  const idempotencyKey = options.idempotencyKey ?? `gift:${nanoid(12)}`;
  const existingGiftId = giftIndex.get(idempotencyKey);
  if (existingGiftId) {
    const existing = gifts.get(existingGiftId);
    if (existing) return { success: true, gift: existing };
  }

  // Rate limit (#51)
  const rl = checkRateLimit(senderId, 'gift', MARKETPLACE_LIMITS.maxGiftsPerDay, 24 * 3600e3);
  if (!rl.allowed) return { success: false, error: 'RATE_LIMITED' };

  // Fraud gate (#50)
  if (isUserBlockedByFraud(senderId)) {
    flagFraudCase(senderId, 'GIFT_ABUSE', 'high', { stage: 'create', itemId });
    return { success: false, error: 'FRAUD_BLOCK' };
  }

  // Validate item + ownership server-side
  if (!getMarketItem(itemId)) return { success: false, error: 'ITEM_NOT_FOUND' };

  const ownershipRecord = getOwnedRecord(senderId, itemId);
  if (!ownershipRecord) return { success: false, error: 'NOT_OWNED' };

  const gift: MarketGift = {
    giftId: `gift_${nanoid(16)}`,
    senderId,
    recipientId,
    itemId,
    message: options.message?.slice(0, 256) ?? null,
    status: 'PENDING',
    sourceOwnershipId: ownershipRecord.userItemId,
    transactionId: null,
    createdAt: new Date(),
    completedAt: null,
  };
  gifts.set(gift.giftId, gift);
  giftIndex.set(idempotencyKey, gift.giftId);

  recordAuditLog(senderId, 'gift_created', 'gift', gift.giftId, { recipientId, itemId });
  return { success: true, gift };
}

// ============================================================
// Accept Gift (confirmation step)
// ============================================================

export function acceptGift(
  idempotencyKey: string,
): { success: boolean; gift?: MarketGift; error?: string } {
  const giftId = giftIndex.get(idempotencyKey);
  const gift = giftId ? gifts.get(giftId) : undefined;
  if (!gift) return { success: false, error: 'GIFT_NOT_FOUND' };

  // Idempotent completion — ONE transfer only (#6)
  if (gift.status === 'COMPLETED') return { success: true, gift };

  if (gift.status !== 'PENDING') return { success: false, error: 'GIFT_NOT_PENDING' };

  // Sender must still own the item at acceptance time.
  const owned = getOwnedRecord(gift.senderId, gift.itemId);
  if (!owned || owned.userItemId !== gift.sourceOwnershipId) {
    gift.status = 'CANCELLED';
    return { success: false, gift, error: 'SENDER_NO_LONGER_OWNS_ITEM' };
  }

  // Transfer: revoke from sender, grant to recipient (source=GIFT).
  revokeOwnership(gift.senderId, gift.itemId, 'revoked');
  const granted = grantMarketItem(gift.recipientId, gift.itemId, 'GIFT', {
    referenceId: gift.giftId,
    metadata: { fromSender: gift.senderId },
    idempotencyKey: `gift_grant:${gift.giftId}`,
  });

  if (!granted.success) {
    // Roll back the revocation by re-granting to the original owner.
    grantMarketItem(gift.senderId, gift.itemId, 'PURCHASE', {
      referenceId: gift.giftId,
      metadata: { restoredAfterFailedGift: true },
      idempotencyKey: `gift_restore:${gift.giftId}`,
    });
    return { success: false, gift, error: granted.error ?? 'GRANT_FAILED' };
  }

  gift.status = 'COMPLETED';
  gift.completedAt = new Date();

  recordAuditLog(gift.senderId, 'gift_completed', 'gift', gift.giftId, {
    recipientId: gift.recipientId,
    itemId: gift.itemId,
  });

  return { success: true, gift };
}

export function cancelGift(
  senderId: string,
  giftId: string,
): { success: boolean; error?: 'NOT_FOUND' | 'NOT_PENDING' | 'NOT_SENDER' } {
  const gift = gifts.get(giftId);
  if (!gift) return { success: false, error: 'NOT_FOUND' };
  if (gift.senderId !== senderId) return { success: false, error: 'NOT_SENDER' };
  if (gift.status !== 'PENDING') return { success: false, error: 'NOT_PENDING' };

  gift.status = 'CANCELLED';
  recordAuditLog(senderId, 'gift_cancelled', 'gift', giftId, {});
  return { success: true };
}

// ============================================================
// Queries
// ============================================================

export function getGift(giftId: string): MarketGift | null {
  return gifts.get(giftId) ?? null;
}

export function getUserGifts(userId: string): MarketGift[] {
  return Array.from(gifts.values())
    .filter((g) => g.senderId === userId || g.recipientId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Expire stale pending gifts (called by scheduler). */
export function expireStaleGifts(maxAgeMs = 7 * 24 * 3600e3): number {
  let expired = 0;
  for (const gift of gifts.values()) {
    if (gift.status === 'PENDING' && Date.now() - gift.createdAt.getTime() > maxAgeMs) {
      gift.status = 'EXPIRED';
      expired += 1;
    }
  }
  return expired;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceGifts(): void {
  gifts.clear();
  giftIndex.clear();
}
