/**
 * GTX Rush — Marketplace Favorites & Wishlist Service v1.0
 *
 * - Favorite / unfavorite items (discovery signal)
 * - Wishlist with availability notifications (respects preferences)
 *
 * SECURITY:
 * - Rate limited at route layer; favorites never grant rewards (#32)
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { nanoid } from 'nanoid';
import type { MarketFavorite, MarketWishlistEntry } from '@gtx-rush/types';
import { MARKETPLACE_FLAGS } from '@gtx-rush/config';
import { getMarketItem } from './marketplace-catalog';
import {
  recordFavoriteAdded,
  recordFavoriteRemoved,
} from './marketplace-engagement';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const favorites = new Map<string, MarketFavorite>(); // `${userId}:${itemId}` → fav
const wishlists = new Map<string, MarketWishlistEntry>();

function favKey(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}

// ============================================================
// Favorites
// ============================================================

export function addFavorite(userId: string, itemId: string): { success: boolean; error?: string } {
  if (!getMarketItem(itemId)) return { success: false, error: 'ITEM_NOT_FOUND' };
  const key = favKey(userId, itemId);
  if (favorites.has(key)) return { success: true };

  favorites.set(key, { userId, itemId, createdAt: new Date() });
  recordFavoriteAdded(itemId);
  return { success: true };
}

export function removeFavorite(userId: string, itemId: string): boolean {
  const key = favKey(userId, itemId);
  const existed = favorites.delete(key);
  if (existed) recordFavoriteRemoved(itemId);
  return existed;
}

export function isFavorited(userId: string, itemId: string): boolean {
  return favorites.has(favKey(userId, itemId));
}

export function getUserFavorites(userId: string): MarketFavorite[] {
  return Array.from(favorites.values())
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ============================================================
// Wishlist
// ============================================================

export function addToWishlist(
  userId: string,
  itemId: string,
  notifyOnAvailable = MARKETPLACE_FLAGS.wishlistNotificationsEnabled,
): { success: boolean; error?: 'ITEM_NOT_FOUND' } {
  if (!getMarketItem(itemId)) return { success: false, error: 'ITEM_NOT_FOUND' };
  const key = favKey(userId, itemId);
  if (!wishlists.has(key)) {
    wishlists.set(key, { userId, itemId, notifyOnAvailable, createdAt: new Date() });
  }
  return { success: true };
}

export function removeFromWishlist(userId: string, itemId: string): boolean {
  return wishlists.delete(favKey(userId, itemId));
}

export function isInWishlist(userId: string, itemId: string): boolean {
  return wishlists.has(favKey(userId, itemId));
}

export function getUserWishlist(userId: string): MarketWishlistEntry[] {
  return Array.from(wishlists.values())
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Called when an item becomes available again — returns user IDs that
 * should be notified (respecting per-user notification preference).
 */
export function getWishlistNotifyTargets(itemId: string): string[] {
  return Array.from(wishlists.values())
    .filter((w) => w.itemId === itemId && w.notifyOnAvailable)
    .map((w) => w.userId);
}

/** Internal id helper for tests/audit references. */
export function _newId(): string {
  return nanoid(12);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceFavorites(): void {
  favorites.clear();
  wishlists.clear();
}
