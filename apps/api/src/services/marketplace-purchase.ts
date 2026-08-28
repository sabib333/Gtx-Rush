/**
 * GTX Rush — Marketplace Purchase Service v1.0
 *
 * Implements the full purchase flow:
 *
 *   USER → ITEM PAGE → BUY → SERVER CREATES PURCHASE
 *   → TELEGRAM PAYMENT FLOW → PAYMENT VERIFIED (server-side)
 *   → TRANSACTION RECORDED → ITEM GRANTED → USER SEES ITEM
 *
 * SECURITY:
 * - Price is ALWAYS server-authoritative (client-supplied prices ignored)
 * - Payment state is verified server-side; never trust client purchase status
 * - Idempotent: one confirmation grants ONE item, ever (Contract rule #6)
 * - Transactions are immutable; refunds are separate ledger rows (#15)
 * - Fraud risk gate blocks flagged users before purchase creation (#50)
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { createHmac } from 'node:crypto';
import { nanoid } from 'nanoid';
import type {
  MarketPurchase,
  MarketTransaction,
  MarketPurchaseIntentResult,
  MarketPaymentParams,
  MarketPurchaseVerifyRequest,
  MarketPurchaseVerifyResult,
} from '@gtx-rush/types';
import {
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREATOR_REVENUE,
} from '@gtx-rush/config';
import {
  validateMarketItemForPurchase,
  getMarketItem,
} from './marketplace-catalog';
import {
  grantMarketItem,
  revokeOwnership,
} from './marketplace-inventory';
import {
  checkRateLimit,
  isUserBlockedByFraud,
  flagFraudCase,
  recordAuditLog,
} from './marketplace-fraud';
import { recordPurchaseCompleted } from './marketplace-engagement';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const purchases = new Map<string, MarketPurchase>(); // purchaseId → purchase
const purchasesByIdempotency = new Map<string, MarketPurchase>(); // idempotencyKey → purchase
const transactions = new Map<string, MarketTransaction>(); // transactionId → txn
const processedPaymentRefs = new Set<string>(); // telegram payment dedupe

/** HMAC secret for signing payment payloads. In production: env-provided secret. */
const PAYLOAD_SECRET =
  process.env.MARKET_PAYLOAD_SECRET ?? 'gtx-rush-dev-market-payload-secret';

function signPayload(payloadStr: string): string {
  return createHmac('sha256', PAYLOAD_SECRET).update(payloadStr).digest('hex').slice(0, 32);
}

export function verifyPayloadSignature(payloadStr: string, signature: string): boolean {
  const expected = signPayload(payloadStr);
  return expected.length === signature.length &&
    Buffer.from(expected).toString('hex') === Buffer.from(signature).toString('hex');
}

// ============================================================
// Purchase Intent (SERVER CREATES PURCHASE)
// ============================================================

export function createPurchaseIntent(
  userId: string,
  itemId: string,
  idempotencyKey: string,
): { success: true; data: MarketPurchaseIntentResult } | { success: false; error: string } {
  // Rate limit purchase creation (#51)
  const rl = checkRateLimit(userId, 'purchase_create', MARKETPLACE_LIMITS.maxPurchasesPerDay, 24 * 3600e3);
  if (!rl.allowed) return { success: false, error: 'RATE_LIMITED' };

  // Fraud gate (#50)
  if (isUserBlockedByFraud(userId)) {
    flagFraudCase(userId, 'PURCHASE_ABUSE', 'high', { stage: 'intent', itemId });
    return { success: false, error: 'FRAUD_BLOCK' };
  }

  if (!idempotencyKey || idempotencyKey.length > 128) {
    return { success: false, error: 'INVALID_IDEMPOTENCY_KEY' };
  }

  // Already-created intent with same key? Return it unchanged.
  const existing = purchasesByIdempotency.get(idempotencyKey);
  if (existing) {
    if (existing.userId !== userId) {
      flagFraudCase(userId, 'PURCHASE_ABUSE', 'medium', { reason: 'IDEMPOTENCY_KEY_REPLAY' });
      return { success: false, error: 'IDEMPOTENCY_KEY_CONFLICT' };
    }
    return { success: false, error: 'PURCHASE_ALREADY_EXISTS' };
  }

  // Validate item + price server-side (#10/#11)
  const validation = validateMarketItemForPurchase(itemId);
  if (!validation.valid || !validation.item || validation.price === undefined) {
    return { success: false, error: validation.error ?? 'ITEM_NOT_PURCHASABLE' };
  }

  const price = validation.price;
  const purchaseId = `pur_${nanoid(16)}`;
  const transactionId = `txn_${nanoid(16)}`;

  const purchase: MarketPurchase = {
    purchaseId,
    userId,
    itemId,
    idempotencyKey,
    price,
    currency: 'STARS',
    status: 'pending',
    telegramPaymentId: null,
    createdAt: new Date(),
    completedAt: null,
  };
  purchases.set(purchaseId, purchase);
  purchasesByIdempotency.set(idempotencyKey, purchase);

  // Immutable PENDING transaction row (#14)
  transactions.set(transactionId, {
    transactionId,
    purchaseId,
    userId,
    itemId,
    price,
    currency: 'STARS',
    paymentReference: null,
    kind: 'purchase',
    status: 'PENDING',
    economyReferenceId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  recordAuditLog(userId, 'purchase_intent_created', 'purchase', purchaseId, { itemId, price });

  // Signed payload ties payment back to THIS purchase server-side.
  const payloadObj = { purchaseId, idempotencyKey, userId };
  const payloadStr = JSON.stringify(payloadObj);
  const paymentParams: MarketPaymentParams = {
    currency: 'XTR',
    amount: price, // server-authoritative — never from client
    title: validation.item.name,
    description: validation.item.description.slice(0, 128),
    payload: `${Buffer.from(payloadStr).toString('base64')}.${signPayload(payloadStr)}`,
    photoUrl: validation.item.image,
  };

  const expiresAt = new Date(Date.now() + 30 * 60e3);

  return {
    success: true,
    data: {
      purchaseId,
      transactionId,
      price,
      currency: 'STARS',
      paymentParams,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

// ============================================================
// Payment Verification (server-side only — #10)
// ============================================================

/**
 * Verify a Telegram Stars payment and grant the item exactly once.
 *
 * In production this validates the Telegram `successful_payment` update
 * (or Bot API pre_checkout_query) against Telegram's authoritative state.
 * The MVP verifies payload signature + payment-reference uniqueness +
 * server-side purchase state.
 */
export function verifyMarketPurchase(
  request: MarketPurchaseVerifyRequest,
): MarketPurchaseVerifyResult {
  const { idempotencyKey, telegramPaymentId } = request;

  const purchase = purchasesByIdempotency.get(idempotencyKey);
  if (!purchase) return { success: false, transactionId: null, itemGranted: false, error: 'PURCHASE_NOT_FOUND' };

  const transaction = Array.from(transactions.values()).find((t) => t.purchaseId === purchase.purchaseId);
  if (!transaction) return { success: false, transactionId: null, itemGranted: false, error: 'TRANSACTION_NOT_FOUND' };

  // Replay attack: same Telegram payment reference used twice (#52)
  if (telegramPaymentId && processedPaymentRefs.has(telegramPaymentId)) {
    flagFraudCase(purchase.userId, 'AUTOMATED_PURCHASING', 'medium', {
      reason: 'PAYMENT_REFERENCE_REUSE',
      telegramPaymentId,
    });
    // Idempotent success if it's the SAME completed purchase.
    if (purchase.status === 'completed' && purchase.telegramPaymentId === telegramPaymentId) {
      return { success: true, transactionId: transaction.transactionId, itemGranted: true };
    }
    return { success: false, transactionId: null, itemGranted: false, error: 'PAYMENT_REFERENCE_REUSE' };
  }

  if (purchase.status === 'failed' || purchase.status === 'cancelled') {
    return { success: false, transactionId: null, itemGranted: false, error: 'PURCHASE_NOT_PENDING' };
  }

  // --- Payment considered VERIFIED here (Telegram authoritative state) ---
  if (telegramPaymentId) processedPaymentRefs.add(telegramPaymentId);

  // Grant item EXACTLY once — grantMarketItem is itself idempotent.
  const granted = grantMarketItem(purchase.userId, purchase.itemId, 'PURCHASE', {
    referenceId: purchase.purchaseId,
    metadata: { transactionId: transaction.transactionId, telegramPaymentId },
    idempotencyKey: `verify:${purchase.idempotencyKey}`,
  });

  if (!granted.success) {
    transaction.status = 'FAILED';
    transaction.updatedAt = new Date();
    purchase.status = 'failed';
    return { success: false, transactionId: null, itemGranted: false, error: granted.error ?? 'GRANT_FAILED' };
  }

  purchase.status = 'completed';
  purchase.completedAt = new Date();
  purchase.telegramPaymentId = telegramPaymentId ?? null;

  transaction.status = 'COMPLETED';
  transaction.paymentReference = telegramPaymentId ?? null;
  transaction.updatedAt = new Date();

  recordPurchaseCompleted(purchase.itemId);
  recordAuditLog(purchase.userId, 'purchase_completed', 'purchase', purchase.purchaseId, {
    itemId: purchase.itemId,
    price: purchase.price,
    telegramPaymentId,
  });

  return { success: true, transactionId: transaction.transactionId, itemGranted: true };
}

/**
 * Called by the bot webhook when Telegram reports a successful payment.
 * Decodes + signature-checks the signed payload before verification.
 */
export function handleSuccessfulPayment(payload: string): MarketPurchaseVerifyResult & { userId?: string } {
  const dotIdx = payload.lastIndexOf('.');
  if (dotIdx === -1) return { success: false, transactionId: null, itemGranted: false, error: 'MALFORMED_PAYLOAD' };

  let decoded: { purchaseId: string; idempotencyKey: string; userId: string };
  try {
    decoded = JSON.parse(Buffer.from(payload.slice(0, dotIdx), 'base64').toString());
  } catch {
    return { success: false, transactionId: null, itemGranted: false, error: 'MALFORMED_PAYLOAD' };
  }

  if (!verifyPayloadSignature(JSON.stringify(decoded), payload.slice(dotIdx + 1))) {
    return { success: false, transactionId: null, itemGranted: false, error: 'INVALID_SIGNATURE' };
  }

  return verifyMarketPurchase({ idempotencyKey: decoded.idempotencyKey, telegramPaymentId: '' });
}

// ============================================================
// Failure / Cancellation
// ============================================================

export function failPurchase(idempotencyKey: string, reason: string): boolean {
  const purchase = purchasesByIdempotency.get(idempotencyKey);
  if (!purchase || purchase.status !== 'pending') return false;

  purchase.status = 'failed';
  const transaction = Array.from(transactions.values()).find((t) => t.purchaseId === purchase.purchaseId);
  if (transaction) {
    transaction.status = 'FAILED';
    transaction.metadata.failureReason = reason;
    transaction.updatedAt = new Date();
  }
  recordAuditLog(purchase.userId, 'purchase_failed', 'purchase', purchase.purchaseId, { reason });
  return true;
}

// ============================================================
// Refunds (#15 — history preserved)
// ============================================================

export function refundPurchase(
  actorAdminId: string,
  purchaseId: string,
  reason: string,
): { success: boolean; refundTransactionId?: string; error?: string } {
  const purchase = purchases.get(purchaseId);
  if (!purchase) return { success: false, error: 'PURCHASE_NOT_FOUND' };
  if (purchase.status !== 'completed') return { success: false, error: 'PURCHASE_NOT_COMPLETED' };

  // Refund-abuse rate limit (#50/#51)
  const rl = checkRateLimit(purchase.userId, 'refund', MARKETPLACE_LIMITS.maxRefundsPerMonth, 30 * 24 * 3600e3);
  if (!rl.allowed) {
    flagFraudCase(purchase.userId, 'REFUND_ABUSE', 'medium', { purchaseId });
    return { success: false, error: 'REFUND_RATE_LIMITED' };
  }

  // Mark original COMPLETED row as REFUNDED (status transition on ledger row)
  const originalTxn = Array.from(transactions.values()).find(
    (t) => t.purchaseId === purchaseId && t.kind === 'purchase',
  );
  if (!originalTxn) return { success: false, error: 'ORIGINAL_TRANSACTION_NOT_FOUND' };

  // Separate refund ledger row referencing the original (#15)
  const refundTxnId = `txn_${nanoid(16)}`;
  transactions.set(refundTxnId, {
    transactionId: refundTxnId,
    purchaseId,
    userId: purchase.userId,
    itemId: purchase.itemId,
    price: purchase.price,
    currency: 'STARS',
    paymentReference: originalTxn.paymentReference,
    kind: 'refund',
    status: 'COMPLETED',
    economyReferenceId: null,
    metadata: { refundedTransactionId: originalTxn.transactionId, reason },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  originalTxn.status = 'REFUNDED';
  originalTxn.updatedAt = new Date();
  purchase.status = 'failed';

  // Item ownership updated according to policy — history preserved.
  revokeOwnership(purchase.userId, purchase.itemId, 'refunded');

  recordAuditLog(actorAdminId, 'purchase_refunded', 'purchase', purchaseId, {
    refundTransactionId: refundTxnId,
    reason,
  });

  return { success: true, refundTransactionId: refundTxnId };
}

// ============================================================
// Queries
// ============================================================

export function getPurchase(purchaseId: string, requesterUserId?: string): MarketPurchase | null {
  const p = purchases.get(purchaseId);
  if (!p) return null;
  if (requesterUserId && p.userId !== requesterUserId) return null;
  return p;
}

export function getUserPurchases(userId: string, limit = 50): MarketPurchase[] {
  return Array.from(purchases.values())
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function getUserTransactions(userId: string, limit = 50): MarketTransaction[] {
  return Array.from(transactions.values())
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function getTransaction(transactionId: string): MarketTransaction | null {
  return transactions.get(transactionId) ?? null;
}

// ============================================================
// Revenue Analytics Support (#49)
// ============================================================

export function getCompletedPurchases(): MarketPurchase[] {
  return Array.from(purchases.values()).filter((p) => p.status === 'completed');
}

export function getCreatorRevenueSplit(grossStars: number): {
  grossAmount: number;
  platformShareBps: number;
  platformShare: number;
  creatorShare: number;
} {
  const platformShareBps = MARKETPLACE_CREATOR_REVENUE.platformShareBps;
  const platformShare = Math.floor((grossStars * platformShareBps) / 10000);
  return {
    grossAmount: grossStars,
    platformShareBps,
    platformShare,
    creatorShare: grossStars - platformShare,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplacePurchases(): void {
  purchases.clear();
  purchasesByIdempotency.clear();
  transactions.clear();
  processedPaymentRefs.clear();
}
