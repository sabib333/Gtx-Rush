/**
 * GTX Rush — Economy API Routes
 *
 * Endpoints for:
 * - Economy profile
 * - XP and levels
 * - Inventory management
 * - Equipment system
 * - Item catalog
 * - Store
 * - Reward transactions
 *
 * Contract: Economy Engine Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import { ECONOMY_FLAGS } from '@gtx-rush/config';
import {
  getUserXP,
  getUserLevelProgress,
  getUserXPTransactions,
  awardXP,
  getEconomyProfile,
  getUserEconomyStats,
  getRewardTransactions,
  reverseRewardTransaction,
} from '../services/economy-service';
import {
  getCatalogItems,
  getCatalogItem,
  getCatalogWithOwnership,
  getStoreSections,
  getCatalogStats,
} from '../services/item-catalog';
import {
  getUserInventory,
  getUserInventoryByType,
  getInventoryWithDetails,
  getInventoryStats,
  grantItem,
} from '../services/inventory-service';
import {
  equipItem,
  unequipItem,
  getLoadout,
  getEquippedItemIds,
} from '../services/equipment-service';
import {
  trackEconomyEvent,
  getEconomyAnalytics,
} from '../services/economy-analytics';

export async function economyRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Economy Profile
  // ============================================================

  /**
   * GET /economy/profile
   * Get user's economy profile
   */
  app.get('/economy/profile', async (request, reply) => {
    if (!ECONOMY_FLAGS.economy_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'ECONOMY_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const profile = getEconomyProfile(userId);

      // Enrich with inventory and equipment
      const inventoryCount = getUserInventory(userId).length;
      const equippedIds = getEquippedItemIds(userId);
      const loadout = getLoadout(userId);

      // Get equipped item details
      const equippedItems = {
        profileFrame: loadout.profileFrame ?? null,
        title: loadout.title ?? null,
        avatarEffect: loadout.avatarEffect ?? null,
        nameEffect: loadout.nameEffect ?? null,
      };

      return reply.send({
        success: true,
        data: {
          ...profile,
          inventoryCount,
          equippedItems,
        },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get profile');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // XP & Levels
  // ============================================================

  /**
   * GET /economy/xp
   * Get user's XP and level progress
   */
  app.get('/economy/xp', async (request, reply) => {
    if (!ECONOMY_FLAGS.xp_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'XP_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const xp = getUserXP(userId);
      const levelProgress = getUserLevelProgress(userId);

      return reply.send({
        success: true,
        data: {
          xp,
          levelProgress,
        },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get XP');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /economy/xp/transactions
   * Get XP transaction history
   */
  app.get('/economy/xp/transactions', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const limit = parseInt((request.query as Record<string, string>).limit ?? '50');
    const source = (request.query as Record<string, string>).source;

    try {
      const transactions = getUserXPTransactions(userId, {
        limit,
        source: source as any,
      });

      return reply.send({
        success: true,
        data: { transactions },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get XP transactions');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Inventory
  // ============================================================

  /**
   * GET /economy/inventory
   * Get user's inventory
   */
  app.get('/economy/inventory', async (request, reply) => {
    if (!ECONOMY_FLAGS.inventory_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'INVENTORY_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const type = (request.query as Record<string, string>).type;
    const limit = parseInt((request.query as Record<string, string>).limit ?? '50');
    const offset = parseInt((request.query as Record<string, string>).offset ?? '0');

    try {
      const items = getInventoryWithDetails(userId, {
        type: type as any,
        limit,
        offset,
      });

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            nextCursor: items.length === limit ? String(offset + limit) : null,
            hasMore: items.length === limit,
          },
        },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get inventory');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /economy/inventory/stats
   * Get inventory statistics
   */
  app.get('/economy/inventory/stats', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const stats = getInventoryStats(userId);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get inventory stats');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Equipment
  // ============================================================

  /**
   * GET /economy/equipment
   * Get user's equipment loadout
   */
  app.get('/economy/equipment', async (request, reply) => {
    if (!ECONOMY_FLAGS.equipment_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'EQUIPMENT_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const loadout = getLoadout(userId);

      return reply.send({
        success: true,
        data: { loadout },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get equipment');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /economy/equipment/equip
   * Equip an item
   */
  app.post('/economy/equipment/equip', async (request, reply) => {
    if (!ECONOMY_FLAGS.equipment_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'EQUIPMENT_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      slot?: string;
      itemId?: string;
    };

    if (!body.slot || !body.itemId) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'slot and itemId are required',
      });
    }

    try {
      const result = equipItem(userId, body.slot as any, body.itemId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      trackEconomyEvent(userId, 'item_equipped', { slot: body.slot, itemId: body.itemId });

      return reply.send({
        success: true,
        data: { loadout: result.loadout },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to equip item');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /economy/equipment/unequip
   * Unequip an item
   */
  app.post('/economy/equipment/unequip', async (request, reply) => {
    if (!ECONOMY_FLAGS.equipment_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'EQUIPMENT_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      slot?: string;
    };

    if (!body.slot) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'slot is required',
      });
    }

    try {
      const result = unequipItem(userId, body.slot as any);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      trackEconomyEvent(userId, 'item_unequipped', { slot: body.slot });

      return reply.send({
        success: true,
        data: { loadout: result.loadout },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to unequip item');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Item Catalog
  // ============================================================

  /**
   * GET /economy/catalog
   * Get item catalog
   */
  app.get('/economy/catalog', async (request, reply) => {
    const query = request.query as Record<string, string>;

    try {
      const items = getCatalogItems({
        type: query.type as any,
        rarity: query.rarity as any,
        method: query.method as any,
        limit: parseInt(query.limit ?? '50'),
        offset: parseInt(query.offset ?? '0'),
      });

      return reply.send({
        success: true,
        data: { items },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get catalog');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /economy/catalog/:itemId
   * Get catalog item details
   */
  app.get('/economy/catalog/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };

    try {
      const item = getCatalogItem(itemId);
      if (!item) {
        return reply.status(404).send({
          success: false,
          error: 'ITEM_NOT_FOUND',
        });
      }

      return reply.send({
        success: true,
        data: { item },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get catalog item');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /economy/catalog/stats
   * Get catalog statistics
   */
  app.get('/economy/catalog/stats', async (request, reply) => {
    try {
      const stats = getCatalogStats();

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get catalog stats');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Store
  // ============================================================

  /**
   * GET /economy/store
   * Get store sections
   */
  app.get('/economy/store', async (request, reply) => {
    if (!ECONOMY_FLAGS.store_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'STORE_DISABLED',
      });
    }

    try {
      const sections = getStoreSections();

      return reply.send({
        success: true,
        data: { sections },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get store');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Transactions
  // ============================================================

  /**
   * GET /economy/transactions
   * Get reward transaction history
   */
  app.get('/economy/transactions', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const limit = parseInt((request.query as Record<string, string>).limit ?? '50');
    const source = (request.query as Record<string, string>).source;

    try {
      const transactions = getRewardTransactions(userId, {
        limit,
        source: source as any,
      });

      return reply.send({
        success: true,
        data: { transactions },
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get transactions');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Analytics
  // ============================================================

  /**
   * GET /economy/analytics
   * Get economy analytics (admin only)
   */
  app.get('/economy/analytics', async (request, reply) => {
    try {
      const analytics = getEconomyAnalytics();

      return reply.send({
        success: true,
        data: analytics,
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get analytics');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /economy/stats
   * Get user economy stats
   */
  app.get('/economy/stats', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const stats = getUserEconomyStats(userId);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      app.log.error('[Economy] Failed to get stats');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });
}
