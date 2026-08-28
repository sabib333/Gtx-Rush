/**
 * GTX Rush — Marketplace API Routes v1.0
 *
 * Player-facing marketplace endpoints (§53):
 *
 *   GET  /market/items              → Browse catalog (paginated, filtered)
 *   GET  /market/items/:id          → Item detail with ownership
 *   GET  /market/collections        → All active collections
 *   GET  /market/collections/:id    → Collection with its items
 *   GET  /market/search             → Full-text search
 *   GET  /market/home               → GTX MARKET home sections
 *
 *   POST /market/purchase           → Create purchase intent (Telegram Stars)
 *   POST /market/purchase/verify    → Verify payment + grant item
 *   GET  /market/purchases          → User purchase history
 *
 *   GET  /inventory                 → User inventory (owned items)
 *   POST /inventory/equip           → Equip item into slot
 *   POST /inventory/unequip         → Unequip slot
 *   GET  /inventory/loadout         → Current equipped loadout
 *
 *   POST /market/favorite           → Toggle favorite
 *   POST /market/wishlist           → Toggle wishlist
 *   GET  /market/favorites          → User favorites
 *   GET  /market/wishlist           → User wishlist
 *
 *   POST /market/gift               → Send a gift
 *   POST /market/gift/accept        → Accept a pending gift
 *   POST /market/gift/cancel        → Cancel a pending gift
 *   GET  /market/gifts              → User gift history
 *
 * SECURITY:
 * - All prices are server-authoritative (§10, §11)
 * - Payment verification is server-side only (§12)
 * - Ownership is never client-authoritative (§16)
 * - Rate limits protect all mutation endpoints (§51)
 * - Fraud gate blocks risky users before purchase creation (§50)
 * - Fake scarcity / fake countdowns are PROHIBITED (§38, §39)
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MARKETPLACE_FLAGS, MARKETPLACE_LIMITS } from '@gtx-rush/config';
import {
  getMarketItems,
  getMarketItem,
  searchMarketItems,
  getAllMarketCollections,
  getCollectionWithItems,
  getMarketHome,
  getMarketItemCards,
  getMarketItemDetail,
  initializeMarketCatalog,
} from '../services/marketplace-catalog';
import {
  createPurchaseIntent,
  verifyMarketPurchase,
  getUserPurchases,
} from '../services/marketplace-purchase';
import {
  getInventory,
  getOwnedItemIds,
  equipMarketItem,
  unequipMarketItem,
  getEquippedLoadout,
} from '../services/marketplace-inventory';
import {
  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  getUserWishlist,
} from '../services/marketplace-favorites';
import {
  createGift,
  acceptGift,
  cancelGift,
  getUserGifts,
} from '../services/marketplace-gifting';
import {
  checkRateLimit,
  recordAuditLog,
} from '../services/marketplace-fraud';
import {
  trackMarketEvent,
} from '../services/marketplace-analytics';

// ============================================================
// Initialization
// ============================================================

initializeMarketCatalog();

// ============================================================
// Auth helper (MVP mock — replace with real JWT verification)
// ============================================================

function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) return 'dev-user-001';
  return 'dev-user-001'; // TODO: verify JWT
}

// ============================================================
// Routes
// ============================================================

export async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // Catalog browsing
  // ----------------------------------------------------------------

  /** GET /market/home — GTX MARKET home sections (§8) */
  app.get('/market/home', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    trackMarketEvent('market_open', userId);

    const home = getMarketHome();
    const ownedIds = getOwnedItemIds(userId);

    // Attach ownership to the home sections
    const enrich = (items: ReturnType<typeof getMarketHome>['featured']) =>
      items.map((item) => ({
        ...item,
        owned: ownedIds.has(item.itemId),
      }));

    return reply.send({
      success: true,
      data: {
        featured: enrich(home.featured),
        trending: enrich(home.trending),
        new: enrich(home.new),
        collections: home.collections,
        free: enrich(home.free),
        earnable: enrich(home.earnable),
        creatorItems: enrich(home.creatorItems),
        myItems: enrich(
          getMarketItems({}, {}).items.filter((i) => ownedIds.has(i.itemId)),
        ),
      },
    });
  });

  /** GET /market/items — Browse catalog (§29, §30) */
  app.get('/market/items', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const query = request.query as Record<string, string>;
    const limit = Math.min(Number(query.limit) || 24, 100);
    const offset = Number(query.offset) || 0;

    const result = getMarketItems(
      {
        type: query.type as never,
        rarity: query.rarity as never,
        collectionId: query.collection,
        creatorId: query.creator,
        acquisition: query.acquisition as never,
        priceFilter: query.price as 'free' | 'stars' | undefined,
        status: query.status as never,
        includeUnavailable: query.includeUnavailable === 'true',
      },
      { limit, offset },
    );

    const ownedIds = getOwnedItemIds(userId);
    const cards = getMarketItemCards(userId, result.items, ownedIds);

    return reply.send({
      success: true,
      data: {
        items: cards,
        total: result.total,
        hasMore: result.hasMore,
        limit,
        offset,
      },
    });
  });

  /** GET /market/items/:id — Item detail (§9) */
  app.get('/market/items/:id', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = request.params as { id: string };
    const ownedIds = getOwnedItemIds(userId);

    trackMarketEvent('item_view', userId, { itemId: id });

    const detail = getMarketItemDetail(userId, id, {
      ownedItemIds: ownedIds,
      favorited: isFavorited(userId, id),
      wishlisted: isInWishlist(userId, id),
    });

    if (!detail) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: 'Item not found' },
      });
    }

    return reply.send({ success: true, data: detail });
  });

  // ----------------------------------------------------------------
  // Collections
  // ----------------------------------------------------------------

  /** GET /market/collections — All active collections (§5) */
  app.get('/market/collections', async (_request, reply) => {
    const collections = getAllMarketCollections();
    return reply.send({ success: true, data: collections });
  });

  /** GET /market/collections/:id — Collection with items */
  app.get('/market/collections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getUserId(request);

    const result = getCollectionWithItems(id);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: 'COLLECTION_NOT_FOUND', message: 'Collection not found' },
      });
    }

    const ownedIds = userId ? getOwnedItemIds(userId) : new Set<string>();
    const cards = getMarketItemCards(userId ?? '', result.items, ownedIds);

    return reply.send({
      success: true,
      data: { collection: result.collection, items: cards },
    });
  });

  // ----------------------------------------------------------------
  // Search
  // ----------------------------------------------------------------

  /** GET /market/search — Full-text search (§29) */
  app.get('/market/search', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const rl = checkRateLimit(userId, 'marketplace_search', MARKETPLACE_LIMITS.maxSearchesPerMinute, 60e3);
    if (!rl.allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many search requests' },
      });
    }

    const query = request.query as Record<string, string>;
    const q = query.q ?? '';
    const limit = Math.min(Number(query.limit) || 24, 100);
    const offset = Number(query.offset) || 0;

    const result = searchMarketItems(
      q,
      {
        type: query.type as never,
        rarity: query.rarity as never,
        collectionId: query.collection,
        creatorId: query.creator,
        priceFilter: query.price as 'free' | 'stars' | undefined,
        acquisition: query.acquisition as never,
      },
      { limit, offset },
    );

    const ownedIds = getOwnedItemIds(userId);
    const cards = getMarketItemCards(userId, result.items, ownedIds);

    return reply.send({
      success: true,
      data: { items: cards, total: result.total },
    });
  });

  // ----------------------------------------------------------------
  // Purchase flow (§12, §13, §14)
  // ----------------------------------------------------------------

  /** POST /market/purchase — Create purchase intent */
  app.post('/market/purchase', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { itemId?: string; idempotencyKey?: string };
    if (!body.itemId || !body.idempotencyKey) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'itemId and idempotencyKey are required' },
      });
    }

    trackMarketEvent('purchase_click', userId, { itemId: body.itemId });

    const result = createPurchaseIntent(userId, body.itemId, body.idempotencyKey);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    trackMarketEvent('payment_started', userId, { itemId: body.itemId, purchaseId: result.data.purchaseId });

    return reply.send({ success: true, data: result.data });
  });

  /** POST /market/purchase/verify — Verify payment + grant item (§12) */
  app.post('/market/purchase/verify', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { idempotencyKey?: string; telegramPaymentId?: string };
    if (!body.idempotencyKey || !body.telegramPaymentId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'idempotencyKey and telegramPaymentId are required' },
      });
    }

    const result = verifyMarketPurchase({
      idempotencyKey: body.idempotencyKey,
      telegramPaymentId: body.telegramPaymentId,
    });

    if (result.success) {
      trackMarketEvent('purchase_completed', userId, { itemId: body.idempotencyKey });
    }

    return reply.send({
      success: result.success,
      data: {
        transactionId: result.transactionId,
        itemGranted: result.itemGranted,
        error: result.error,
      },
    });
  });

  /** GET /market/purchases — User purchase history */
  app.get('/market/purchases', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const limit = Math.min(Number((request.query as Record<string, string>).limit) || 50, 100);
    const purchases = getUserPurchases(userId, limit);

    return reply.send({ success: true, data: { purchases } });
  });

  // ----------------------------------------------------------------
  // Inventory & Equipment (§16, §17, §18)
  // ----------------------------------------------------------------

  /** GET /inventory — User inventory */
  app.get('/inventory', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const inventory = getInventory(userId);
    return reply.send({ success: true, data: inventory });
  });

  /** POST /inventory/equip — Equip item into slot (§17) */
  app.post('/inventory/equip', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { itemId?: string };
    if (!body.itemId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'itemId is required' },
      });
    }

    const result = equipMarketItem(userId, body.itemId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    trackMarketEvent('item_equipped', userId, { itemId: body.itemId });
    recordAuditLog(userId, 'item_equipped', 'user_item', body.itemId, {});

    return reply.send({ success: true, data: { equipped: true } });
  });

  /** POST /inventory/unequip — Unequip slot */
  app.post('/inventory/unequip', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { slot?: string };
    if (!body.slot) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'slot is required' },
      });
    }

    const validSlots = ['avatar', 'frame', 'theme', 'badge', 'effect', 'title'];
    if (!validSlots.includes(body.slot)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_SLOT', message: `slot must be one of: ${validSlots.join(', ')}` },
      });
    }

    const result = unequipMarketItem(userId, body.slot as 'avatar');
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return reply.send({ success: true, data: { unequipped: true } });
  });

  /** GET /inventory/loadout — Current equipped loadout */
  app.get('/inventory/loadout', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const loadout = getEquippedLoadout(userId);
    return reply.send({ success: true, data: { loadout } });
  });

  // ----------------------------------------------------------------
  // Favorites & Wishlist (§32, §33)
  // ----------------------------------------------------------------

  /** POST /market/favorite — Toggle favorite (§32) */
  app.post('/market/favorite', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const rl = checkRateLimit(userId, 'favorite', MARKETPLACE_LIMITS.maxFavoriteActionsPerMinute, 60e3);
    if (!rl.allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many favorite requests' },
      });
    }

    const body = request.body as { itemId?: string };
    if (!body.itemId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'itemId is required' },
      });
    }

    const wasFavorited = isFavorited(userId, body.itemId);
    if (wasFavorited) {
      removeFavorite(userId, body.itemId);
    } else {
      addFavorite(userId, body.itemId);
    }

    return reply.send({
      success: true,
      data: { favorited: !wasFavorited },
    });
  });

  /** POST /market/wishlist — Toggle wishlist (§33) */
  app.post('/market/wishlist', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const rl = checkRateLimit(userId, 'wishlist', MARKETPLACE_LIMITS.maxWishlistActionsPerMinute, 60e3);
    if (!rl.allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many wishlist requests' },
      });
    }

    const body = request.body as { itemId?: string };
    if (!body.itemId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'itemId is required' },
      });
    }

    const wasInWishlist = isInWishlist(userId, body.itemId);
    if (wasInWishlist) {
      removeFromWishlist(userId, body.itemId);
    } else {
      addToWishlist(userId, body.itemId);
    }

    return reply.send({
      success: true,
      data: { wishlisted: !wasInWishlist },
    });
  });

  /** GET /market/favorites — User favorites */
  app.get('/market/favorites', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const favorites = getUserFavorites(userId);
    return reply.send({ success: true, data: { favorites } });
  });

  /** GET /market/wishlist — User wishlist */
  app.get('/market/wishlist', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const wishlist = getUserWishlist(userId);
    return reply.send({ success: true, data: { wishlist } });
  });

  // ----------------------------------------------------------------
  // Gifting (§20 — rate limited, fraud checked, confirmation required)
  // ----------------------------------------------------------------

  /** POST /market/gift — Send a gift */
  app.post('/market/gift', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!MARKETPLACE_FLAGS.giftingEnabled) {
      return reply.status(503).send({
        success: false,
        error: { code: 'GIFTING_DISABLED', message: 'Gifting is currently disabled' },
      });
    }

    const body = request.body as {
      recipientId?: string;
      itemId?: string;
      message?: string;
      idempotencyKey?: string;
    };

    if (!body.recipientId || !body.itemId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'recipientId and itemId are required' },
      });
    }

    const result = createGift(userId, body.recipientId, body.itemId, {
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return reply.send({ success: true, data: { gift: result.gift } });
  });

  /** POST /market/gift/accept — Accept a pending gift */
  app.post('/market/gift/accept', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { giftId?: string };
    if (!body.giftId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'giftId is required' },
      });
    }

    const result = acceptGift(body.giftId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return reply.send({ success: true, data: { gift: result.gift } });
  });

  /** POST /market/gift/cancel — Cancel a pending gift */
  app.post('/market/gift/cancel', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = request.body as { giftId?: string };
    if (!body.giftId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'giftId is required' },
      });
    }

    const result = cancelGift(userId, body.giftId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return reply.send({ success: true, data: { cancelled: true } });
  });

  /** GET /market/gifts — User gift history */
  app.get('/market/gifts', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const gifts = getUserGifts(userId);
    return reply.send({ success: true, data: { gifts } });
  });
}
