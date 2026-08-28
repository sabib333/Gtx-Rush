/**
 * GTX Rush — Title System v1.0
 *
 * Manages profile titles:
 * - Unlock: Titles earned through badges/achievements
 * - Equip: Users select one title for their profile
 * - Display: Title shown on profile and leaderboards
 *
 * Titles are cosmetic/status features — no gameplay advantages.
 */

import { nanoid } from 'nanoid';
import type { Title, UserTitle, UserTitleWithTitle } from '@gtx-rush/types';
import { TITLE_DEFINITIONS, type TitleDefinition } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL)
// ============================================================

const userTitles = new Map<string, UserTitle>(); // key: userId:titleSlug

// ============================================================
// Title Operations
// ============================================================

/**
 * Unlock a title for a user.
 * Idempotent: if already unlocked, returns existing record.
 */
export function unlockTitle(userId: string, titleSlug: string): UserTitle {
  const key = `${userId}:${titleSlug}`;
  const existing = userTitles.get(key);

  if (existing) return existing;

  const def = TITLE_DEFINITIONS.find((t) => t.slug === titleSlug);
  if (!def) {
    throw new Error(`Title not found: ${titleSlug}`);
  }

  const userTitle: UserTitle = {
    id: nanoid(),
    userId,
    titleId: def.slug,
    unlockedAt: new Date(),
    isEquipped: false,
  };

  userTitles.set(key, userTitle);
  return userTitle;
}

/**
 * Equip a title for a user.
 * Un-equips any previously equipped title.
 */
export function equipTitle(userId: string, titleSlug: string): UserTitle | null {
  // Un-equip all current titles
  for (const [key, ut] of userTitles.entries()) {
    if (key.startsWith(`${userId}:`) && ut.isEquipped) {
      ut.isEquipped = false;
    }
  }

  // Equip the new title
  const key = `${userId}:${titleSlug}`;
  const userTitle = userTitles.get(key);
  if (!userTitle) return null;

  userTitle.isEquipped = true;
  return userTitle;
}

/**
 * Get the user's currently equipped title.
 */
export function getEquippedTitle(userId: string): UserTitleWithTitle | null {
  for (const [key, ut] of userTitles.entries()) {
    if (key.startsWith(`${userId}:`) && ut.isEquipped) {
      const def = TITLE_DEFINITIONS.find((t) => t.slug === ut.titleId);
      if (def) {
        return {
          ...ut,
          title: {
            id: def.slug,
            slug: def.slug,
            name: def.name,
            description: def.description,
            category: def.category,
            rarity: def.rarity,
            iconUrl: def.iconUrl,
            isActive: true,
            createdAt: new Date(),
          },
        };
      }
    }
  }
  return null;
}

/**
 * Get all titles for a user.
 */
export function getUserTitles(userId: string): UserTitleWithTitle[] {
  const titles: UserTitleWithTitle[] = [];

  for (const [key, ut] of userTitles.entries()) {
    if (key.startsWith(`${userId}:`)) {
      const def = TITLE_DEFINITIONS.find((t) => t.slug === ut.titleId);
      if (def) {
        titles.push({
          ...ut,
          title: {
            id: def.slug,
            slug: def.slug,
            name: def.name,
            description: def.description,
            category: def.category,
            rarity: def.rarity,
            iconUrl: def.iconUrl,
            isActive: true,
            createdAt: ut.unlockedAt,
          },
        });
      }
    }
  }

  return titles;
}

/**
 * Get a title definition by slug.
 */
export function getTitleDefinition(slug: string): TitleDefinition | undefined {
  return TITLE_DEFINITIONS.find((t) => t.slug === slug);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllTitles(): void {
  userTitles.clear();
}
