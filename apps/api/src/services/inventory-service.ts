/**
 * GTX Rush — Inventory Service v1.0
 *
 * Server-authoritative inventory system that handles:
 * - Item granting
 * - Inventory queries
 * - Duplicate prevention
 * - Inventory limits
 *
 * SECURITY:
 * - All inventory changes are server-side
 * - Users cannot inject items
 * - Duplicate items prevented for unique types
 * - Every grant is recorded
 *
 * Contract: Economy Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  EconomyItemType,
  EconomyRewardSource,
  EconomyInventoryItem,
  EconomyInventoryItemWithDetails,
  EconomyCatalogItem,
} from '@gtx-rush/types';
import {
  ECONOMY_SAFETY,
  ECONOMY_FLAGS,
  getCatalogItem,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const userInventory = new Map<string, EconomyInventoryItem[]>();
const itemTransactions = new Map<string, EconomyInventoryItem>(); // idempotencyKey → item

// ============================================================
// Item Granting
// ============================================================

/**
 * Grant an item to user inventory
 *
 * SECURITY:
 * - Idempotent via idempotency key
 * - Duplicate prevention for unique items
 * - Inventory size limit
 * - Server-authoritative
 */
export function grantItem(
  userId: string,
  itemId: string,
  itemType: EconomyItemType,
  source: EconomyRewardSource,
  transactionId: string,
  options: {
    quantity?: number;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {},
): { success: boolean; item?: EconomyInventoryItem; error?: string } {
  if (!ECONOMY_FLAGS.inventory_enabled) {
    return { success: false, error: 'INVENTORY_DISABLED' };
  }

  const { quantity = 1, metadata = {}, idempotencyKey } = options;

  // Check idempotency
  const key = idempotencyKey ?? `grant:${userId}:${itemId}:${source}:${transactionId}`;
  const existing = itemTransactions.get(key);
  if (existing) {
    return { success: true, item: existing };
  }

  // Validate item exists in catalog
  const catalogItem = getCatalogItem(itemId);
  if (!catalogItem) {
    return { success: false, error: 'ITEM_NOT_IN_CATALOG' };
  }

  // Check inventory size
  const inventory = userInventory.get(userId) ?? [];
  if (inventory.length >= ECONOMY_SAFETY.maxInventorySize) {
    return { success: false, error: 'INVENTORY_FULL' };
  }

  // Check for duplicate (badges and titles are unique per user)
  if (itemType === 'badge' || itemType === 'title') {
    const existingItem = inventory.find(
      (item) => item.itemId === itemId && item.itemType === itemType,
    );
    if (existingItem) {
      return { success: true, item: existingItem };
    }
  }

  // Create inventory item
  const inventoryItem: EconomyInventoryItem = {
    id: nanoid(),
    userId,
    itemId,
    itemType,
    quantity,
    acquiredAt: new Date(),
    source,
    transactionId,
    metadata,
  };

  // Add to inventory
  inventory.push(inventoryItem);
  userInventory.set(userId, inventory);

  // Record transaction
  itemTransactions.set(key, inventoryItem);

  return { success: true, item: inventoryItem };
}

/**
 * Remove an item from user inventory
 */
export function removeItem(
  userId: string,
  itemId: string,
  reason: string,
): { success: boolean; error?: string } {
  const inventory = userInventory.get(userId) ?? [];
  const itemIndex = inventory.findIndex((item) => item.itemId === itemId);

  if (itemIndex === -1) {
    return { success: false, error: 'ITEM_NOT_FOUND' };
  }

  inventory.splice(itemIndex, 1);
  userInventory.set(userId, inventory);

  return { success: true };
}

// ============================================================
// Inventory Queries
// ============================================================

/**
 * Get all items in user's inventory
 */
export function getUserInventory(userId: string): EconomyInventoryItem[] {
  return userInventory.get(userId) ?? [];
}

/**
 * Get user's inventory by item type
 */
export function getUserInventoryByType(userId: string, type: EconomyItemType): EconomyInventoryItem[] {
  return getUserInventory(userId).filter((item) => item.itemType === type);
}

/**
 * Check if user owns an item
 */
export function userOwnsItem(userId: string, itemId: string): boolean {
  return getUserInventory(userId).some((item) => item.itemId === itemId);
}

/**
 * Get inventory item with details
 */
export function getInventoryItemWithDetails(
  userId: string,
  itemId: string,
): EconomyInventoryItemWithDetails | null {
  const inventory = getUserInventory(userId);
  const item = inventory.find((i) => i.itemId === itemId);
  if (!item) return null;

  return {
    ...item,
    item: getCatalogItem(itemId) ?? null,
  };
}

/**
 * Get inventory with details
 */
export function getInventoryWithDetails(
  userId: string,
  options: {
    type?: EconomyItemType;
    limit?: number;
    offset?: number;
  } = {},
): EconomyInventoryItemWithDetails[] {
  const { type, limit = 50, offset = 0 } = options;

  let inventory = getUserInventory(userId);

  if (type) {
    inventory = inventory.filter((item) => item.itemType === type);
  }

  return inventory
    .slice(offset, offset + limit)
    .map((item) => ({
      ...item,
      item: getCatalogItem(item.itemId) ?? null,
    }));
}

/**
 * Get owned item IDs
 */
export function getOwnedItemIds(userId: string): Set<string> {
  const inventory = getUserInventory(userId);
  return new Set(inventory.map((item) => item.itemId));
}

/**
 * Get inventory count
 */
export function getInventoryCount(userId: string): number {
  return getUserInventory(userId).length;
}

/**
 * Get inventory stats
 */
export function getInventoryStats(userId: string): {
  totalItems: number;
  itemsByType: Record<EconomyItemType, number>;
  itemsBySource: Record<string, number>;
  recentAcquisitions: EconomyInventoryItem[];
} {
  const inventory = getUserInventory(userId);

  const itemsByType: Record<string, number> = {};
  const itemsBySource: Record<string, number> = {};

  for (const item of inventory) {
    itemsByType[item.itemType] = (itemsByType[item.itemType] ?? 0) + 1;
    itemsBySource[item.source] = (itemsBySource[item.source] ?? 0) + 1;
  }

  const recentAcquisitions = [...inventory]
    .sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime())
    .slice(0, 5);

  return {
    totalItems: inventory.length,
    itemsByType: itemsByType as Record<EconomyItemType, number>,
    itemsBySource,
    recentAcquisitions,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllInventory(): void {
  userInventory.clear();
  itemTransactions.clear();
}

export function _getUserInventoryCount(userId: string): number {
  return getUserInventory(userId).length;
}
