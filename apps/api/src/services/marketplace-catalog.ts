/**
 * GTX Rush — Marketplace Catalog Service v1.0
 *
 * Handles:
 * - Digital item catalog (13 item types, 5 rarities)
 * - Collections & seasonal availability windows
 * - Marketplace home sections (GTX MARKET)
 * - Search, filters, pagination
 * - Item detail with ownership status
 * - Trending (multi-signal, never purchases alone)
 *
 * SECURITY:
 * - Prices are server-authoritative (never from client)
 * - Availability is computed against SERVER time only
 * - No fake scarcity: limited windows are real, from config/DB
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import type {
  MarketItem,
  MarketCollection,
  MarketItemType,
  MarketRarity,
  MarketAcquisitionMethod,
  MarketItemStatus,
  MarketItemCard,
  MarketItemDetail,
} from '@gtx-rush/types';
import {
  MARKETPLACE_ITEM_CATALOG,
  MARKETPLACE_PRICES,
  MARKETPLACE_COLLECTIONS,
  MARKETPLACE_STORE_CONFIG,
  isMarketItemAvailable,
} from '@gtx-rush/config';
import { getItemEngagementSignals } from './marketplace-engagement';

// ============================================================
// Runtime Catalog (seeded from config; admins mutate via service)
// ============================================================

const catalog = new Map<string, MarketItem>();
const collections = new Map<string, MarketCollection>();

export function initializeMarketCatalog(): void {
  for (const item of MARKETPLACE_ITEM_CATALOG) {
    catalog.set(item.itemId, { ...item });
  }
  for (const col of MARKETPLACE_COLLECTIONS) {
    collections.set(col.collectionId, { ...col });
  }
}

// ============================================================
// Price Helpers (server-authoritative)
// ============================================================

/**
 * Get the current server-authoritative price for an item.
 * Returns null when the item is free / not purchasable.
 */
export function getMarketPrice(itemId: string): number | null {
  const price = MARKETPLACE_PRICES[itemId];
  return typeof price === 'number' ? price : null;
}

export function setMarketPrice(
  itemId: string,
  price: number,
): { success: boolean; error?: string } {
  if (!catalog.has(itemId)) return { success: false, error: 'ITEM_NOT_FOUND' };
  if (!Number.isInteger(price) || price < 0) {
    return { success: false, error: 'INVALID_PRICE' };
  }
  // Config object holds authoritative prices in MVP.
  (MARKETPLACE_PRICES as Record<string, number>)[itemId] = price;
  recordItemVersion(itemId, 'price_update', { price });
  return { success: true };
}

// ============================================================
// Catalog Queries
// ============================================================

export interface MarketCatalogFilters {
  type?: MarketItemType;
  rarity?: MarketRarity;
  collectionId?: string;
  creatorId?: string;
  acquisition?: MarketAcquisitionMethod;
  priceFilter?: 'free' | 'stars';
  status?: MarketItemStatus;
  includeUnavailable?: boolean;
}

function matchesFilters(item: MarketItem, filters: MarketCatalogFilters): boolean {
  if (filters.type && item.type !== filters.type) return false;
  if (filters.rarity && item.rarity !== filters.rarity) return false;
  if (filters.collectionId && item.collectionId !== filters.collectionId) return false;
  if (filters.creatorId && item.creatorId !== filters.creatorId) return false;
  if (filters.acquisition && !item.acquisitionMethods.includes(filters.acquisition)) return false;

  const price = getMarketPrice(item.itemId);
  if (filters.priceFilter === 'free' && price !== null) return false;
  if (filters.priceFilter === 'stars' && price === null) return false;

  const status = filters.status ?? 'active';
  if (item.status !== status) return false;

  // Availability window check against server time (expired items are
  // excluded unless explicitly requested — history stays queryable).
  if (!filters.includeUnavailable && !isMarketItemAvailable(item)) return false;

  return true;
}

export function getMarketItems(
  filters: MarketCatalogFilters = {},
  pagination: { limit?: number; offset?: number } = {},
): { items: MarketItem[]; total: number; hasMore: boolean } {
  const { limit = MARKETPLACE_STORE_CONFIG.pageSize, offset = 0 } = pagination;

  const all = Array.from(catalog.values()).filter((item) => matchesFilters(item, filters));
  // Newest first — stable ordering for pagination.
  all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const page = all.slice(offset, offset + limit);
  return { items: page, total: all.length, hasMore: offset + limit < all.length };
}
/**
 * Full-text-ish search over name/description/collection.
 * In production this maps to an indexed tsvector/trigram query.
 */
export function searchMarketItems(
  query: string,
  filters: MarketCatalogFilters = {},
  pagination: { limit?: number; offset?: number } = {},
): { items: MarketItem[]; total: number } {
  const q = query.trim().toLowerCase();
  let candidates = Array.from(catalog.values()).filter((item) => matchesFilters(item, filters));

  if (q.length > 0) {
    candidates = candidates.filter((item) => {
      const haystack = [
        item.name,
        item.description,
        item.type.replace(/_/g, ' '),
        item.collectionId?.replace(/^col_/, '').replace(/_/g, ' ') ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }

  candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    items: candidates.slice(pagination.offset ?? 0, (pagination.offset ?? 0) + (pagination.limit ?? MARKETPLACE_STORE_CONFIG.pageSize)),
    total: candidates.length,
  };
}

export function getMarketItem(itemId: string): MarketItem | null {
  return catalog.get(itemId) ?? null;
}

export function getAllMarketCollections(): MarketCollection[] {
  return Array.from(collections.values())
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMarketCollection(collectionId: string): MarketCollection | null {
  return collections.get(collectionId) ?? null;
}

export function getCollectionWithItems(collectionId: string): {
  collection: MarketCollection;
  items: MarketItem[];
} | null {
  const col = collections.get(collectionId);
  if (!col || col.status !== 'active') return null;
  const items = col.itemIds
    .map((id) => catalog.get(id))
    .filter((i): i is MarketItem => !!i && matchesFilters(i, {}));
  return { collection: col, items };
}

// ============================================================
// Validation
// ============================================================

export function validateMarketItemForPurchase(itemId: string): {
  valid: boolean;
  item?: MarketItem;
  price?: number;
  error?:
    | 'ITEM_NOT_FOUND'
    | 'ITEM_NOT_ACTIVE'
    | 'ITEM_NOT_AVAILABLE'
    | 'ITEM_NOT_PURCHASABLE'
    | 'PRICE_INACTIVE';
} {
  const item = catalog.get(itemId);
  if (!item) return { valid: false, error: 'ITEM_NOT_FOUND' };
  if (item.status !== 'active') return { valid: false, error: 'ITEM_NOT_ACTIVE' };

  // Server-time availability — never device clock.
  if (!isMarketItemAvailable(item)) return { valid: false, error: 'ITEM_NOT_AVAILABLE' };

  const price = getMarketPrice(itemId);
  if (price === null) return { valid: false, error: 'ITEM_NOT_PURCHASABLE' };

  return { valid: true, item, price };
}

export function validateMarketItemForGrant(itemId: string): {
  valid: boolean;
  item?: MarketItem;
  error?: 'ITEM_NOT_FOUND' | 'ITEM_NOT_ACTIVE';
} {
  const item = catalog.get(itemId);
  if (!item) return { valid: false, error: 'ITEM_NOT_FOUND' };
  if (item.status !== 'active') return { valid: false, error: 'ITEM_NOT_ACTIVE' };
  return { valid: true, item };
}

// ============================================================
// Item Detail & Cards
// ============================================================

/**
 * Cards are built with a caller-provided owned set so this service stays
 * independent from the inventory layer (avoids circular imports).
 */
export function buildMarketItemCard(item: MarketItem, owned: boolean): MarketItemCard {
  const price = getMarketPrice(item.itemId);
  const earnable = item.acquisitionMethods.includes('earnable');
  return {
    itemId: item.itemId,
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    image: item.image,
    price,
    currency: price !== null ? 'STARS' : null,
    earnable,
    owned,
    cta: owned ? 'OWNED' : price !== null ? 'BUY WITH STARS' : 'GET',
  };
}

export function getMarketItemCards(
  userId: string,
  items: MarketItem[],
  ownedItemIds: Set<string>,
): MarketItemCard[] {
  void userId;
  return items.map((item) => buildMarketItemCard(item, ownedItemIds.has(item.itemId)));
}

export function getMarketItemDetail(
  userId: string,
  itemId: string,
  context: { ownedItemIds?: Set<string>; favorited?: boolean; wishlisted?: boolean } = {},
): MarketItemDetail | null {
  const item = catalog.get(itemId);
  if (!item) return null;

  const collection = item.collectionId ? collections.get(item.collectionId) ?? null : null;
  const price = getMarketPrice(item.itemId);
  const owned = context.ownedItemIds?.has(itemId) ?? false;

  return {
    ...item,
    collectionName: collection?.name ?? null,
    price,
    currency: price !== null ? 'STARS' : null,
    earnMethod:
      item.acquisitionMethods.includes('earnable') && price !== null
        ? 'EARNABLE_OR_PURCHASE'
        : item.acquisitionMethods.includes('earnable')
          ? 'EARNABLE_ONLY'
          : 'PURCHASE_ONLY',
    ownership: {
      owned,
      acquiredAt: null, // filled by inventory layer when owned
      source: null,
    },
    favorited: context.favorited ?? false,
    wishlisted: context.wishlisted ?? false,
  };
}

// ============================================================
// Store Home Sections (GTX MARKET)
// ============================================================

export function getTrendingItems(limit = MARKETPLACE_STORE_CONFIG.maxItemsPerSection): MarketItem[] {
  const weights = { views: 1, purchaseClicks: 4, purchases: 8, equips: 6, favorites: 5 } as const;
  const scored = Array.from(catalog.values())
    .filter((item) => matchesFilters(item, {}))
    .map((item) => {
      const s = getItemEngagementSignals(item.itemId);
      const base =
        s.views * weights.views +
        s.purchaseClicks * weights.purchaseClicks +
        s.purchases * weights.purchases +
        s.equips * weights.equips +
        s.favorites * weights.favorites;
      // Recent activity boost — trending favors momentum, not totals.
      const recentBoost = s.lastEventAt && Date.now() - s.lastEventAt.getTime() < 24 * 3600e3 ? 1.25 : 1;
      return { item, score: base * recentBoost };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.item);
}

export interface MarketHomeResponse {
  featured: MarketItem[];
  trending: MarketItem[];
  new: MarketItem[];
  collections: MarketCollection[];
  free: MarketItem[];
  earnable: MarketItem[];
  creatorItems: MarketItem[];
  myItemIds: string[];
}

export function getMarketHome(): MarketHomeResponse {
  const visible = Array.from(catalog.values()).filter((i) => matchesFilters(i, {}));

  const featured = visible.filter(
    (i) => i.rarity === 'epic' || i.rarity === 'legendary' || i.rarity === 'mythic',
  );
  const newestFirst = [...visible].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    featured: featured.slice(0, MARKETPLACE_STORE_CONFIG.maxItemsPerSection),
    trending: getTrendingItems(),
    new: newestFirst.slice(0, MARKETPLACE_STORE_CONFIG.maxItemsPerSection),
    collections: getAllMarketCollections(),
    free: visible
      .filter((i) => getMarketPrice(i.itemId) === null)
      .slice(0, MARKETPLACE_STORE_CONFIG.maxItemsPerSection),
    earnable: visible
      .filter((i) => i.acquisitionMethods.includes('earnable'))
      .slice(0, MARKETPLACE_STORE_CONFIG.maxItemsPerSection),
    creatorItems: visible
      .filter((i) => i.creatorId !== null)
      .slice(0, MARKETPLACE_STORE_CONFIG.maxItemsPerSection),
    myItemIds: [], // filled by route using inventory service
  };
}

// ============================================================
// Admin Item Management (all changes audited by caller)
// ============================================================

export function createMarketItem(item: Omit<MarketItem, 'version' | 'createdAt' | 'updatedAt'>): MarketItem {
  const now = new Date();
  const created: MarketItem = {
    ...item,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  catalog.set(created.itemId, created);
  recordItemVersion(created.itemId, 'created');
  return created;
}

export function updateMarketItemStatus(
  itemId: string,
  status: MarketItemStatus,
  note: string,
): { success: boolean; item?: MarketItem; error?: string } {
  const item = catalog.get(itemId);
  if (!item) return { success: false, error: 'ITEM_NOT_FOUND' };

  // Never hard-delete items users own — DISABLED/ARCHIVED only.
  item.status = status;
  item.updatedAt = new Date();
  item.version += 1;
  recordItemVersion(itemId, `status:${status}`, { note });
  return { success: true, item };
}

/** Version snapshots preserve core identity of purchased items. */
const itemVersions = new Map<string, { version: number; changeNote: string; snapshotAt: Date }[]>();

export function recordItemVersion(
  itemId: string,
  changeNote: string,
  details: Record<string, unknown> = {},
): void {
  const list = itemVersions.get(itemId) ?? [];
  const item = catalog.get(itemId);
  list.push({
    version: item?.version ?? 1,
    changeNote: `${changeNote}${Object.keys(details).length > 0 ? `:${JSON.stringify(details)}` : ''}`,
    snapshotAt: new Date(),
  });
  itemVersions.set(itemId, list);
}

export function getItemVersions(itemId: string): { version: number; changeNote: string; snapshotAt: Date }[] {
  return [...(itemVersions.get(itemId) ?? [])].reverse();
}

// ============================================================
// Catalog Stats
// ============================================================

export function getCatalogStats(): {
  totalItems: number;
  activeItems: number;
  purchasableItems: number;
  freeItems: number;
  earnableItems: number;
  creatorItems: number;
} {
  const all = Array.from(catalog.values());
  const active = all.filter((i) => i.status === 'active');
  return {
    totalItems: all.length,
    activeItems: active.length,
    purchasableItems: active.filter((i) => getMarketPrice(i.itemId) !== null).length,
    freeItems: active.filter((i) => getMarketPrice(i.itemId) === null).length,
    earnableItems: active.filter((i) => i.acquisitionMethods.includes('earnable')).length,
    creatorItems: active.filter((i) => i.creatorId !== null).length,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketCatalog(): void {
  catalog.clear();
  collections.clear();
  itemVersions.clear();
}
