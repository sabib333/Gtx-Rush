/**
 * GTX Rush — Marketplace & Digital Items Configuration
 *
 * Server-authoritative catalog seed data:
 * - Digital items across all item types & rarities
 * - Collections
 * - Store sections (GTX MARKET home)
 * - Safety flags, rate limits & creator revenue rules
 *
 * SECURITY: Prices live ONLY here (server-side). The frontend never
 * hard-codes or supplies prices.
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import type {
  MarketCollection,
  MarketItem,
  MarketItemType,
  MarketEquipmentSlot,
} from '@gtx-rush/types';

// ============================================================
// Catalog Seed Data
// ============================================================

/**
 * A healthy mix of earnable (free) and premium (Stars) items.
 * Every item is cosmetic-only. Rarity never implies monetary value.
 */
export const MARKETPLACE_ITEM_CATALOG: MarketItem[] = [
  // --- GTX Origins collection ---
  {
    itemId: 'origins_avatar_rookie',
    name: 'Rookie Avatar',
    description: 'The classic GTX Rush starter look. Earned by every player.',
    type: 'avatar',
    rarity: 'common',
    image: '/assets/market/origins/rookie-avatar.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_gtx_origins',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },
  {
    itemId: 'origins_frame_bronze',
    name: 'Bronze Origin Frame',
    description: 'A timeless bronze frame from the very first season.',
    type: 'avatar_frame',
    rarity: 'common',
    image: '/assets/market/origins/frame-bronze.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_gtx_origins',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase', 'earnable'],
  },
  {
    itemId: 'origins_title_first_rush',
    name: 'First Rush',
    description: 'Title awarded for completing your first Daily Rush.',
    type: 'title',
    rarity: 'rare',
    image: null,
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_gtx_origins',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },

  // --- Neon Rush collection ---
  {
    itemId: 'neon_frame_pulse',
    name: 'Neon Pulse Frame',
    description: 'An animated frame that pulses with your reaction speed.',
    type: 'avatar_frame',
    rarity: 'epic',
    image: '/assets/market/neon/frame-pulse.png',
    animation: '/assets/market/neon/frame-pulse.webm',
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_neon_rush',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  },
  {
    itemId: 'neon_theme_cyberpunk',
    name: 'Cyberpunk Profile Theme',
    description: 'Turn your profile into a neon cityscape.',
    type: 'profile_theme',
    rarity: 'rare',
    image: '/assets/market/neon/theme-cyberpunk.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_neon_rush',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  },
  {
    itemId: 'neon_effect_reaction_trail',
    name: 'Reaction Trail Effect',
    description: 'Leaves a neon trail when you hit a personal best.',
    type: 'effect',
    rarity: 'epic',
    image: '/assets/market/neon/effect-trail.png',
    animation: '/assets/market/neon/effect-trail.webm',
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_neon_rush',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  },
  {
    itemId: 'neon_emote_gg',
    name: 'GG Neon Emote',
    description: 'Say good game in glowing style.',
    type: 'emote',
    rarity: 'common',
    image: '/assets/market/neon/emote-gg.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_neon_rush',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase', 'earnable'],
  },

  // --- Cyber Season (seasonal, real availability window) ---
  {
    itemId: 'cyber_skin_reactor',
    name: 'Reactor Game Skin',
    description: 'Cyber Season exclusive skin for Reaction Rush.',
    type: 'game_skin',
    rarity: 'legendary',
    image: '/assets/market/cyber/skin-reactor.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_cyber_season',
    eventId: null,
    seasonId: 'season_cyber_1',
    limited: true,
    availableFrom: new Date('2026-06-01T00:00:00Z'),
    availableUntil: new Date(2026, 11, 31, 23, 59, 59), // end of Cyber Season
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase', 'earnable'],
  },
  {
    itemId: 'cyber_badge_netrunner',
    name: 'Netrunner Badge',
    description: 'Awarded to top 100 players of the Cyber Season finale.',
    type: 'profile_badge',
    rarity: 'mythic',
    image: '/assets/market/cyber/badge-netrunner.png',
    animation: '/assets/market/cyber/badge-netrunner.webm',
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_cyber_season',
    eventId: 'evt_cyber_finale',
    seasonId: 'season_cyber_1',
    limited: true,
    availableFrom: new Date('2026-08-20T00:00:00Z'),
    availableUntil: new Date(2026, 8, 10, 23, 59, 59),
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },

  // --- Weekend Champions (event earnables) ---
  {
    itemId: 'wknd_banner_champ',
    name: 'Weekend Champion Banner',
    description: 'Banner for winning a Weekend Champions event.',
    type: 'banner',
    rarity: 'epic',
    image: '/assets/market/wknd/banner-champ.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_weekend_champions',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },
  {
    itemId: 'wknd_collectible_trophy',
    name: 'Champion Trophy Collectible',
    description: 'A trophy collectible earned through weekend tournaments.',
    type: 'collectible',
    rarity: 'legendary',
    image: '/assets/market/wknd/trophy.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    version: 1,
    collectionId: 'col_weekend_champions',
    eventId: null,
    seasonId: null,
    limited: true,
    availableFrom: null,
    availableUntil: new Date(2026, 11, 31, 23, 59, 59),
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },

  // --- Achievement cosmetics (always earnable) ---
  {
    itemId: 'ach_badge_streak_master',
    name: 'Streak Master Badge',
    description: 'Maintain a 30-day play streak.',
    type: 'achievement_cosmetic',
    rarity: 'legendary',
    image: '/assets/market/ach/badge-streak.png',
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    version: 1,
    collectionId: null,
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },
  {
    itemId: 'ach_frame_reflex_legend',
    name: 'Reflex Legend Frame',
    description: 'Reach Legend tier in Reaction Rush.',
    type: 'achievement_cosmetic',
    rarity: 'mythic',
    image: '/assets/market/ach/frame-reflex.png',
    animation: '/assets/market/ach/frame-reflex.webm',
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    version: 1,
    collectionId: null,
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['earnable'],
  },

  // --- Standalone premium items ---
  {
    itemId: 'std_avatar_hologram',
    name: 'Hologram Avatar',
    description: 'A shimmering holographic avatar.',
    type: 'avatar',
    rarity: 'epic',
    image: '/assets/market/std/avatar-hologram.png',
    animation: '/assets/market/std/avatar-hologram.webm',
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    version: 1,
    collectionId: null,
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  },
  {
    itemId: 'std_title_speed_demon',
    name: 'Speed Demon',
    description: 'For players who never blink.',
    type: 'title',
    rarity: 'rare',
    image: null,
    animation: null,
    status: 'active',
    creatorId: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    version: 1,
    collectionId: null,
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  },
];

/** Server-authoritative Stars prices. currency is always STARS. */
export const MARKETPLACE_PRICES: Record<string, number> = {
  origins_frame_bronze: 25,
  neon_frame_pulse: 120,
  neon_theme_cyberpunk: 80,
  neon_effect_reaction_trail: 100,
  neon_emote_gg: 15,
  cyber_skin_reactor: 250,
  std_avatar_hologram: 150,
  std_title_speed_demon: 60,
};

// ============================================================
// Collections
// ============================================================

export const MARKETPLACE_COLLECTIONS: MarketCollection[] = [
  {
    collectionId: 'col_gtx_origins',
    name: 'GTX Origins',
    slug: 'gtx-origins',
    description: 'Where it all began — the original GTX Rush looks.',
    image: '/assets/market/collections/origins.png',
    status: 'active',
    startsAt: null,
    endsAt: null,
    itemIds: ['origins_avatar_rookie', 'origins_frame_bronze', 'origins_title_first_rush'],
  },
  {
    collectionId: 'col_neon_rush',
    name: 'Neon Rush',
    slug: 'neon-rush',
    description: 'Glow hard. Animated frames, effects and emotes.',
    image: '/assets/market/collections/neon.png',
    status: 'active',
    startsAt: null,
    endsAt: null,
    itemIds: [
      'neon_frame_pulse',
      'neon_theme_cyberpunk',
      'neon_effect_reaction_trail',
      'neon_emote_gg',
    ],
  },
  {
    collectionId: 'col_cyber_season',
    name: 'Cyber Season',
    slug: 'cyber-season',
    description: 'Limited seasonal items with real availability windows.',
    image: '/assets/market/collections/cyber.png',
    status: 'active',
    startsAt: new Date('2026-06-01T00:00:00Z'),
    endsAt: new Date(2026, 11, 31, 23, 59, 59),
    itemIds: ['cyber_skin_reactor', 'cyber_badge_netrunner'],
  },
  {
    collectionId: 'col_weekend_champions',
    name: 'Weekend Champions',
    slug: 'weekend-champions',
    description: 'Earn it on the leaderboard — weekend event rewards.',
    image: '/assets/market/collections/wknd.png',
    status: 'active',
    startsAt: null,
    endsAt: null,
    itemIds: ['wknd_banner_champ', 'wknd_collectible_trophy'],
  },
  {
    collectionId: 'col_creator_series',
    name: 'Creator Series',
    slug: 'creator-series',
    description: 'Community-designed cosmetics, moderated before release.',
    image: '/assets/market/collections/creators.png',
    status: 'active',
    startsAt: null,
    endsAt: null,
    itemIds: [],
  },
];

// ============================================================
// Equipment Slot Rules
// ============================================================

/**
 * Each slot accepts specific item types; one equipped item per slot.
 */
export const MARKETPLACE_SLOT_RULES: Record<MarketEquipmentSlot, MarketItemType[]> = {
  avatar: ['avatar'],
  frame: ['avatar_frame'],
  theme: ['profile_theme'],
  badge: ['profile_badge', 'achievement_cosmetic', 'event_cosmetic'],
  effect: ['effect'],
  title: ['title'],
};

// ============================================================
// Store Sections (GTX MARKET Home)
// ============================================================

export const MARKETPLACE_STORE_CONFIG = {
  sections: [
    { id: 'featured', name: 'Featured' },
    { id: 'trending', name: 'Trending' },
    { id: 'new', name: 'New' },
    { id: 'collections', name: 'Collections' },
    { id: 'free', name: 'Free' },
    { id: 'earnable', name: 'Earnable' },
    { id: 'creator_items', name: 'Creator Items' },
    { id: 'my_items', name: 'My Items' },
  ],
  maxItemsPerSection: 12,
  pageSize: 24,
  maxPageSize: 100,
} as const;

// ============================================================
// Safety Flags & Rate Limits
// ============================================================

export const MARKETPLACE_FLAGS = {
  /** Trading is disabled by default in MVP (Contract rule #14). */
  tradingEnabled: false,
  /** Gifting architecture implemented but gated behind this flag. */
  giftingEnabled: true,
  giftingRequiresConfirmation: true,
  inventoryEnabled: true,
  recommendationsEnabled: true,
  wishlistNotificationsEnabled: true,
} as const;

export const MARKETPLACE_LIMITS = {
  maxInventorySize: 500,
  /** Purchases per user per day. */
  maxPurchasesPerDay: 20,
  /** Gift requests per sender per day. */
  maxGiftsPerDay: 5,
  /** Wishlist mutations per minute. */
  maxWishlistActionsPerMinute: 30,
  /** Favorite mutations per minute. */
  maxFavoriteActionsPerMinute: 30,
  /** Marketplace search requests per minute. */
  maxSearchesPerMinute: 60,
  /** Refunds per user per month (fraud control). */
  maxRefundsPerMonth: 3,
} as const;

export const MARKETPLACE_TRENDING_WEIGHTS = {
  views: 1,
  purchaseClicks: 4,
  purchases: 8,
  equips: 6,
  favorites: 5,
  recentGrowthBoost: 1.25,
} as const;

// ============================================================
// Creator Revenue Rules
// ============================================================

export const MARKETPLACE_CREATOR_REVENUE = {
  /**
   * Platform share in basis points (30%). Creator receives 70% of gross.
   * Published rule — applied server-side only.
   */
  platformShareBps: 3000,
  minPriceStars: 10,
  maxPriceStars: 5000,
} as const;

// ============================================================
// Helpers
// ============================================================

/**
 * Availability check against SERVER time only (never device clock).
 */
export function isMarketItemAvailable(
  item: Pick<MarketItem, 'availableFrom' | 'availableUntil'>,
  now: Date = new Date(),
): boolean {
  if (item.availableFrom && now < item.availableFrom) return false;
  if (item.availableUntil && now > item.availableUntil) return false;
  return true;
}

export function getMarketItemById(itemId: string): MarketItem | undefined {
  return MARKETPLACE_ITEM_CATALOG.find((item: MarketItem) => item.itemId === itemId);
}

export function getMarketItemsByType(type: MarketItemType): MarketItem[] {
  return MARKETPLACE_ITEM_CATALOG.filter((item: MarketItem) => item.type === type);
}
