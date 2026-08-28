/**
 * GTX Rush — Item Catalog Service v1.0
 *
 * Server-authoritative item catalog that handles:
 * - Item definitions
 * - Catalog queries
 * - Item availability
 * - Price management
 *
 * SECURITY:
 * - All prices are server-authoritative
 * - Items cannot be modified by clients
 * - Catalog is versioned
 *
 * Contract: Economy Engine Contract v1.0
 */

import type {
  EconomyItemType,
  EconomyItemRarity,
  EconomyAcquisitionMethod,
  EconomyItemStatus,
  EconomyCatalogItem,
  EconomyCatalogItemWithOwnership,
} from '@gtx-rush/types';
import {
  ECONOMY_ITEM_CATALOG,
  RARITY_CONFIG,
  ECONOMY_STORE_CONFIG,
  isItemAvailable,
} from '@gtx-rush/config';

// ============================================================
// Catalog Queries
// ============================================================

/**
 * Get all active catalog items
 */
export function getCatalogItems(options: {
  type?: EconomyItemType;
  rarity?: EconomyItemRarity;
  method?: EconomyAcquisitionMethod;
  status?: EconomyItemStatus;
  limit?: number;
  offset?: number;
} = {}): EconomyCatalogItem[] {
  const { type, rarity, method, status = 'active', limit = 50, offset = 0 } = options;

  let items = [...ECONOMY_ITEM_CATALOG];

  // Apply filters
  if (type) {
    items = items.filter((item: EconomyCatalogItem) => item.type === type);
  }
  if (rarity) {
    items = items.filter((item: EconomyCatalogItem) => item.rarity === rarity);
  }
  if (method) {
    items = items.filter((item: EconomyCatalogItem) => item.acquisitionMethod === method);
  }
  if (status) {
    items = items.filter((item: EconomyCatalogItem) => item.status === status);
  }

  // Filter by availability
  items = items.filter(isItemAvailable);

  return items.slice(offset, offset + limit);
}

/**
 * Get a catalog item by ID
 */
export function getCatalogItem(itemId: string): EconomyCatalogItem | null {
  return ECONOMY_ITEM_CATALOG.find((item: EconomyCatalogItem) => item.id === itemId) ?? null;
}

/**
 * Get items by type
 */
export function getItemsByType(type: EconomyItemType): EconomyCatalogItem[] {
  return getCatalogItems({ type });
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(rarity: EconomyItemRarity): EconomyCatalogItem[] {
  return getCatalogItems({ rarity });
}

/**
 * Get items by acquisition method
 */
export function getItemsByMethod(method: EconomyAcquisitionMethod): EconomyCatalogItem[] {
  return getCatalogItems({ method });
}

/**
 * Get purchasable items (have a price)
 */
export function getPurchasableItems(): EconomyCatalogItem[] {
  return getCatalogItems().filter((item: EconomyCatalogItem) => item.price !== null && item.currency !== null);
}

/**
 * Get free items (no price)
 */
export function getFreeItems(): EconomyCatalogItem[] {
  return getCatalogItems().filter((item: EconomyCatalogItem) => item.price === null);
}

/**
 * Get limited-time items
 */
export function getLimitedItems(): EconomyCatalogItem[] {
  return getCatalogItems().filter(
    (item: EconomyCatalogItem) => item.startsAt !== null || item.endsAt !== null
  );
}

// ============================================================
// Store Sections
// ============================================================

/**
 * Get store sections
 */
export function getStoreSections(): { id: string; name: string; description: string; items: EconomyCatalogItem[] }[] {
  return ECONOMY_STORE_CONFIG.sections.map((section: { id: string; name: string; description: string }) => ({
    ...section,
    items: getCatalogItems({ limit: ECONOMY_STORE_CONFIG.maxItemsPerSection }),
  }));
}

/**
 * Get featured items
 */
export function getFeaturedItems(): EconomyCatalogItem[] {
  return getCatalogItems({ limit: 5 });
}

// ============================================================
// Ownership Integration
// ============================================================

/**
 * Get catalog items with ownership info
 */
export function getCatalogWithOwnership(
  userId: string,
  ownedItemIds: Set<string>,
  equippedItemIds: Set<string>,
): EconomyCatalogItemWithOwnership[] {
  return getCatalogItems().map((item: EconomyCatalogItem) => ({
    ...item,
    owned: ownedItemIds.has(item.id),
    equipped: equippedItemIds.has(item.id),
  }));
}

/**
 * Get items a user can acquire
 */
export function getAcquirableItems(userId: string, ownedItemIds: Set<string>): EconomyCatalogItem[] {
  return getCatalogItems().filter((item: EconomyCatalogItem) => !ownedItemIds.has(item.id));
}

// ============================================================
// Item Validation
// ============================================================

/**
 * Validate an item exists and is active
 */
export function validateItem(itemId: string): { valid: boolean; item?: EconomyCatalogItem; error?: string } {
  const item = getCatalogItem(itemId);
  if (!item) {
    return { valid: false, error: 'ITEM_NOT_FOUND' };
  }
  if (item.status !== 'active') {
    return { valid: false, error: 'ITEM_NOT_ACTIVE' };
  }
  if (!isItemAvailable(item)) {
    return { valid: false, error: 'ITEM_NOT_AVAILABLE' };
  }
  return { valid: true, item };
}

/**
 * Validate item purchase
 */
export function validateItemPurchase(
  itemId: string,
  userStars: number,
): { valid: boolean; item?: EconomyCatalogItem; error?: string } {
  const validation = validateItem(itemId);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const item = validation.item!;
  if (item.price === null) {
    return { valid: false, error: 'ITEM_NOT_PURCHASABLE' };
  }
  if (userStars < item.price) {
    return { valid: false, error: 'INSUFFICIENT_STARS' };
  }

  return { valid: true, item };
}

// ============================================================
// Rarity Helpers
// ============================================================

/**
 * Get rarity config
 */
export function getRarityConfig(rarity: EconomyItemRarity) {
  return RARITY_CONFIG[rarity];
}

/**
 * Get all rarities
 */
export function getAllRarities(): EconomyItemRarity[] {
  return Object.keys(RARITY_CONFIG) as EconomyItemRarity[];
}

// ============================================================
// Catalog Stats
// ============================================================

/**
 * Get catalog statistics
 */
export function getCatalogStats(): {
  totalItems: number;
  activeItems: number;
  itemsByType: Record<EconomyItemType, number>;
  itemsByRarity: Record<EconomyItemRarity, number>;
  purchasableItems: number;
  freeItems: number;
} {
  const allItems = ECONOMY_ITEM_CATALOG;
  const activeItems = allItems.filter((item: EconomyCatalogItem) => item.status === 'active');

  const itemsByType: Record<string, number> = {};
  const itemsByRarity: Record<string, number> = {};

  for (const item of activeItems) {
    itemsByType[item.type] = (itemsByType[item.type] ?? 0) + 1;
    itemsByRarity[item.rarity] = (itemsByRarity[item.rarity] ?? 0) + 1;
  }

  return {
    totalItems: allItems.length,
    activeItems: activeItems.length,
    itemsByType: itemsByType as Record<EconomyItemType, number>,
    itemsByRarity: itemsByRarity as Record<EconomyItemRarity, number>,
    purchasableItems: activeItems.filter((i: EconomyCatalogItem) => i.price !== null).length,
    freeItems: activeItems.filter((i: EconomyCatalogItem) => i.price === null).length,
  };
}
