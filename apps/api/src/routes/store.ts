/**
 * Store — API Routes v1.0
 *
 * Handles:
 * - GET  /api/store                → Get store data
 * - GET  /api/store/products/:id   → Get product details
 * - POST /api/store/purchases/create → Initiate purchase
 * - POST /api/store/purchases/verify → Verify payment
 * - GET  /api/store/purchases/:id  → Get purchase status
 * - GET  /api/inventory            → Get user inventory
 * - POST /api/inventory/equip      → Equip cosmetic
 * - POST /api/ads/reward/claim     → Claim ad reward
 * - GET  /api/premium              → Get premium status
 *
 * SECURITY:
 * - All prices are server-authoritative
 * - Payment verification is server-side
 * - Ad rewards are server-controlled
 * - Inventory changes are server-side
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getStoreResponse,
  getProductWithOwnership,
  equipProduct,
  unequipProduct,
  getUserOwnedProducts,
  initializeProductCatalog,
} from '../services/product-catalog';
import {
  initiatePurchase,
  verifyPurchase,
  getPurchase,
  getUserPurchases,
} from '../services/purchase-service';
import {
  requestRewardedAd,
  completeRewardedAd,
  shouldShowInterstitial,
  checkAdAvailability,
  getAdConfiguration,
} from '../services/ad-service';
import {
  trackStoreOpened,
  trackProductViewed,
  trackPurchaseStarted,
  trackPurchaseCompleted,
  trackPurchaseFailed,
  trackAdRequested,
  trackAdCompleted,
  trackAdRewardGranted,
  trackInventoryViewed,
  trackCosmeticEquipped,
} from '../services/monetization-analytics';
import { generalRateLimit } from '../middleware/rate-limiter';

// ============================================================
// Initialization
// ============================================================

// Initialize product catalog on module load
initializeProductCatalog();

// ============================================================
// Mock auth helper (replace with real JWT verification)
// ============================================================

function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  // TODO: Verify JWT and extract real user ID
  return 'dev-user-001';
}

// ============================================================
// Routes
// ============================================================

export async function storeRoutes(app: FastifyInstance) {
  // Apply rate limiting to all store routes
  await app.addHook('onRequest', generalRateLimit);

  /**
   * GET /api/store
   *
   * Get the store data with featured products and categories.
   */
  app.get('/store', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const userLevel = 1; // Would be fetched from user record
    const storeData = getStoreResponse(userId, userLevel);

    // Track analytics
    trackStoreOpened(userId, 'main');

    return {
      success: true,
      data: storeData,
    };
  });

  /**
   * GET /api/store/products/:id
   *
   * Get a specific product with ownership info.
   */
  app.get('/store/products/:id', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: productId } = request.params as { id: string };

    const productData = getProductWithOwnership(productId, userId);
    if (!productData) {
      return reply.status(404).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    // Track analytics
    trackProductViewed(
      userId,
      productId,
      productData.product.name,
      productData.product.type,
      productData.product.priceStars,
    );

    return {
      success: true,
      data: productData,
    };
  });

  /**
   * POST /api/store/purchases/create
   *
   * Initiate a purchase for a product.
   * Returns Telegram payment parameters.
   */
  app.post('/store/purchases/create', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { productId, idempotencyKey } = request.body as {
      productId: string;
      idempotencyKey: string;
    };

    if (!productId || !idempotencyKey) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'productId and idempotencyKey are required' },
      });
    }

    const userLevel = 1; // Would be fetched from user record

    try {
      const result = initiatePurchase(userId, { productId, idempotencyKey }, userLevel);

      // Track analytics
      trackPurchaseStarted(userId, productId, '', 0); // Product name/price would be fetched

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      trackPurchaseFailed(userId, productId, errorMessage);

      return reply.status(400).send({
        success: false,
        error: { code: errorMessage, message: errorMessage },
      });
    }
  });

  /**
   * POST /api/store/purchases/verify
   *
   * Verify a Telegram Stars payment.
   * Server-side verification only.
   */
  app.post('/store/purchases/verify', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { telegramPaymentId, idempotencyKey } = request.body as {
      telegramPaymentId: string;
      idempotencyKey: string;
    };

    if (!telegramPaymentId || !idempotencyKey) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'telegramPaymentId and idempotencyKey are required' },
      });
    }

    const result = verifyPurchase({ telegramPaymentId, idempotencyKey });

    if (result.success && result.purchase) {
      const productName = typeof result.purchase.metadata.productName === 'string'
        ? result.purchase.metadata.productName
        : '';
      trackPurchaseCompleted(
        userId,
        result.purchase.productId,
        productName,
        result.purchase.amountStars,
        result.purchase.id,
      );
    }

    return {
      success: result.success,
      data: {
        purchase: {
          id: result.purchase.id,
          status: result.purchase.status,
          completedAt: result.purchase.completedAt?.toISOString(),
        },
        itemGranted: result.itemGranted,
      },
    };
  });

  /**
   * GET /api/store/purchases/:id
   *
   * Get purchase status.
   */
  app.get('/store/purchases/:id', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: purchaseId } = request.params as { id: string };

    const purchase = getPurchase(purchaseId);
    if (!purchase || purchase.userId !== userId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' },
      });
    }

    return {
      success: true,
      data: {
        id: purchase.id,
        status: purchase.status,
        amountStars: purchase.amountStars,
        createdAt: purchase.createdAt.toISOString(),
        completedAt: purchase.completedAt?.toISOString(),
      },
    };
  });

  /**
   * GET /api/inventory
   *
   * Get user's inventory of owned items.
   */
  app.get('/inventory', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const ownedProducts = getUserOwnedProducts(userId);

    trackInventoryViewed(userId, ownedProducts.length);

    return {
      success: true,
      data: {
        items: ownedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          category: p.category,
          rarity: p.rarity,
          assetUrl: p.assetUrl,
        })),
        totalCount: ownedProducts.length,
      },
    };
  });

  /**
   * POST /api/inventory/equip
   *
   * Equip a cosmetic item.
   */
  app.post('/inventory/equip', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { productId } = request.body as { productId: string };

    if (!productId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'productId is required' },
      });
    }

    const success = equipProduct(userId, productId);

    if (success) {
      trackCosmeticEquipped(userId, productId, '', '');
    }

    return {
      success,
      data: { equipped: success },
    };
  });

  /**
   * POST /api/ads/reward/claim
   *
   * Claim a reward for watching a rewarded ad.
   * Server verifies ad completion before granting reward.
   */
  app.post('/ads/reward/claim', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { adId, placement, verificationToken } = request.body as {
      adId: string;
      placement: string;
      verificationToken: string;
    };

    if (!adId || !placement || !verificationToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'adId, placement, and verificationToken are required' },
      });
    }

    const result = completeRewardedAd(userId, adId, placement, verificationToken);

    if (result.success && result.rewardGranted) {
      trackAdRewardGranted(userId, adId, result.reward?.type ?? '', result.reward?.amount ?? 0);
    }

    return {
      success: result.success,
      data: {
        rewardGranted: result.rewardGranted,
        reward: result.reward,
        error: result.error,
      },
    };
  });

  /**
   * POST /api/ads/request
   *
   * Request a rewarded ad.
   * Checks availability and returns ad configuration.
   */
  app.post('/ads/request', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { placement, sessionId } = request.body as {
      placement: string;
      sessionId: string;
    };

    if (!placement || !sessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'placement and sessionId are required' },
      });
    }

    trackAdRequested(userId, 'rewarded', placement);

    const adResponse = requestRewardedAd(userId, placement, sessionId);

    return {
      success: true,
      data: adResponse,
    };
  });

  /**
   * GET /api/premium
   *
   * Get premium status and features.
   */
  app.get('/premium', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // For MVP, premium is not yet enabled
    return {
      success: true,
      data: {
        status: {
          isPremium: false,
          expiresAt: null,
          activeFeatures: [],
          subscriptionId: null,
        },
        features: [],
        subscriptionPlans: [],
      },
    };
  });
}
