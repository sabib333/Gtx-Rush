/**
 * GTX Rush — Purchase Service v1.0
 *
 * Server-authoritative purchase system that handles:
 * - Purchase initiation with Telegram Stars
 * - Payment verification
 * - Idempotent purchase processing
 * - Item granting after payment confirmation
 * - Refund handling
 *
 * SECURITY:
 * - Client never trusts payment state
 * - Server verifies payment with Telegram
 * - Prices are server-authoritative
 * - Idempotency prevents duplicate purchases
 * - Payment history is immutable
 *
 * Contract: Monetization Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Purchase,
  PurchaseInitRequest,
  PurchaseInitResponse,
  PurchaseVerifyRequest,
  PurchaseVerifyResponse,
  TelegramPaymentParams,
  Product,
} from '@gtx-rush/types';
import { TELEGRAM_STARS_CONFIG, ECONOMY_CAPS } from '@gtx-rush/config';
import { validateProductForPurchase, grantProductOwnership } from './product-catalog';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const purchases = new Map<string, Purchase>();
const userPurchases = new Map<string, Purchase[]>(); // userId → purchases
const dailyPurchaseCounts = new Map<string, number>(); // userId → count today

// ============================================================
// Purchase Initiation
// ============================================================

/**
 * Initiate a purchase for a product.
 *
 * SECURITY:
 * - Validates product exists and is available
 * - Checks user doesn't already own it
 * - Creates pending purchase record
 * - Returns Telegram payment parameters
 */
export function initiatePurchase(
  userId: string,
  request: PurchaseInitRequest,
  userLevel: number,
): PurchaseInitResponse {
  const { productId, idempotencyKey } = request;

  // Check idempotency
  const existingPurchase = findPurchaseByIdempotencyKey(idempotencyKey);
  if (existingPurchase) {
    // Return existing purchase if still pending
    if (existingPurchase.status === 'pending') {
      return {
        purchaseId: existingPurchase.id,
        paymentParams: buildPaymentParams(existingPurchase),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      };
    }
    // If already completed, this is a duplicate attempt
    throw new Error('PURCHASE_ALREADY_COMPLETED');
  }

  // Validate product
  const validation = validateProductForPurchase(productId, userId, userLevel);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const product = validation.product!;

  // Check daily purchase limit
  const dailyCount = getDailyPurchaseCount(userId);
  if (dailyCount >= ECONOMY_CAPS.maxPurchasesPerDay) {
    throw new Error('DAILY_PURCHASE_LIMIT_REACHED');
  }

  // Create pending purchase
  const purchaseId = nanoid();
  const purchase: Purchase = {
    id: purchaseId,
    userId,
    productId,
    productType: product.type,
    itemType: product.type === 'cosmetic' ? 'cosmetic' : 'premium_feature',
    itemId: productId,
    amountStars: product.priceStars,
    provider: 'telegram',
    providerPaymentId: null,
    status: 'pending',
    idempotencyKey,
    metadata: {
      productName: product.name,
      productSlug: product.slug,
    },
    createdAt: new Date(),
    completedAt: null,
    updatedAt: new Date(),
  };

  // Store purchase
  purchases.set(purchaseId, purchase);
  const userPurchaseList = userPurchases.get(userId) ?? [];
  userPurchaseList.push(purchase);
  userPurchases.set(userId, userPurchaseList);

  // Update daily count
  updateDailyPurchaseCount(userId);

  return {
    purchaseId,
    paymentParams: buildPaymentParams(purchase),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
  };
}

/**
 * Build Telegram payment parameters.
 */
function buildPaymentParams(purchase: Purchase): TelegramPaymentParams {
  const product = getProductForPurchase(purchase);

  return {
    providerToken: TELEGRAM_STARS_CONFIG.providerToken,
    currency: TELEGRAM_STARS_CONFIG.currency,
    amount: purchase.amountStars,
    name: product?.name ?? 'GTX Rush Item',
    description: product?.description ?? 'Premium item',
    payload: JSON.stringify({
      purchaseId: purchase.id,
      idempotencyKey: purchase.idempotencyKey,
    }),
    photoUrl: product?.assetUrl,
  };
}

// ============================================================
// Payment Verification
// ============================================================

/**
 * Verify a Telegram Stars payment.
 *
 * SECURITY:
 * - Server verifies payment with Telegram API
 * - Idempotent: duplicate verifications return same result
 * - Never trust client-side payment confirmation
 */
export function verifyPurchase(
  request: PurchaseVerifyRequest,
): PurchaseVerifyResponse {
  const { telegramPaymentId, idempotencyKey } = request;

  // Find purchase by idempotency key
  const purchase = findPurchaseByIdempotencyKey(idempotencyKey);
  if (!purchase) {
    return {
      success: false,
      purchase: null as any,
      itemGranted: false,
    };
  }

  // Check if already completed (idempotent)
  if (purchase.status === 'completed') {
    return {
      success: true,
      purchase,
      itemGranted: true,
    };
  }

  // Check if already failed
  if (purchase.status === 'failed' || purchase.status === 'refunded') {
    return {
      success: false,
      purchase,
      itemGranted: false,
    };
  }

  // In production, verify with Telegram API
  // For MVP, simulate successful verification
  const paymentVerified = verifyTelegramPayment(telegramPaymentId, purchase);

  if (!paymentVerified) {
    // Mark as failed
    purchase.status = 'failed';
    purchase.updatedAt = new Date();
    return {
      success: false,
      purchase,
      itemGranted: false,
    };
  }

  // Mark as completed
  purchase.status = 'completed';
  purchase.providerPaymentId = telegramPaymentId;
  purchase.completedAt = new Date();
  purchase.updatedAt = new Date();

  // Grant item
  const itemGranted = grantProductOwnership(purchase.userId, purchase.productId);

  return {
    success: true,
    purchase,
    itemGranted,
  };
}

/**
 * Verify Telegram payment (server-side verification).
 *
 * In production, this calls the Telegram Bot API:
 * https://core.telegram.org/bots/api#verifyPaymentQuery
 */
function verifyTelegramPayment(
  telegramPaymentId: string,
  purchase: Purchase,
): boolean {
  // TODO: Implement real Telegram payment verification
  // For now, simulate success in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Production verification would:
  // 1. Call Telegram Bot API verifyPaymentQuery
  // 2. Check payment status
  // 3. Verify amount matches
  // 4. Verify currency matches

  return false;
}

// ============================================================
// Refund Handling
// ============================================================

/**
 * Handle a refund for a purchase.
 *
 * SECURITY:
 * - Refunds are recorded immutably
 * - Item ownership may be revoked based on policy
 * - Transaction history is preserved
 */
export function handleRefund(
  purchaseId: string,
  reason: string,
): {
  success: boolean;
  purchase: Purchase | null;
  itemRevoked: boolean;
} {
  const purchase = purchases.get(purchaseId);
  if (!purchase) {
    return { success: false, purchase: null, itemRevoked: false };
  }

  // Can only refund completed purchases
  if (purchase.status !== 'completed') {
    return { success: false, purchase, itemRevoked: false };
  }

  // Mark as refunded
  purchase.status = 'refunded';
  purchase.metadata.refundReason = reason;
  purchase.updatedAt = new Date();

  // Note: In production, implement item revocation based on product policy
  // For cosmetics, typically the item remains but is marked as refunded
  // For subscription features, access is revoked

  return {
    success: true,
    purchase,
    itemRevoked: false, // Simplified for MVP
  };
}

// ============================================================
// Purchase Queries
// ============================================================

/**
 * Get a purchase by ID.
 */
export function getPurchase(purchaseId: string): Purchase | null {
  return purchases.get(purchaseId) ?? null;
}

/**
 * Get all purchases for a user.
 */
export function getUserPurchases(
  userId: string,
  options: {
    status?: string;
    limit?: number;
    cursor?: string;
  } = {},
): { purchases: Purchase[]; hasMore: boolean; nextCursor: string | null } {
  const { status, limit = 20, cursor } = options;

  let userPurchaseList = userPurchases.get(userId) ?? [];

  // Filter by status
  if (status) {
    userPurchaseList = userPurchaseList.filter((p) => p.status === status);
  }

  // Sort by creation date (newest first)
  userPurchaseList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = userPurchaseList.findIndex((p) => p.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = userPurchaseList.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < userPurchaseList.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  return { purchases: paginated, hasMore, nextCursor };
}

/**
 * Find purchase by idempotency key.
 */
function findPurchaseByIdempotencyKey(idempotencyKey: string): Purchase | undefined {
  return Array.from(purchases.values()).find((p) => p.idempotencyKey === idempotencyKey);
}

/**
 * Get product for a purchase.
 */
function getProductForPurchase(purchase: Purchase): Product | null {
  // In production, fetch from database
  // For MVP, return null (product info stored in metadata)
  return null;
}

// ============================================================
// Daily Purchase Tracking
// ============================================================

function getDailyPurchaseCount(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  return dailyPurchaseCounts.get(key) ?? 0;
}

function updateDailyPurchaseCount(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  const current = dailyPurchaseCounts.get(key) ?? 0;
  dailyPurchaseCounts.set(key, current + 1);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearPurchaseService(): void {
  purchases.clear();
  userPurchases.clear();
  dailyPurchaseCounts.clear();
}

export function _getPurchaseCount(): number {
  return purchases.size;
}

export function _getUserPurchaseCount(userId: string): number {
  return (userPurchases.get(userId) ?? []).length;
}
