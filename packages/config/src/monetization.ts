/**
 * GTX Rush — Monetization Configuration v1.0
 *
 * Configuration for products, ads, premium features, and monetization mechanics.
 * All values are configurable and version-controlled.
 *
 * Contract: Monetization Contract v1.0
 */

import type {
  Product,
  ProductType,
  CosmeticCategory,
  Rarity,
  AdConfiguration,
  PremiumFeature,
  SubscriptionPlan,
  MonetizationFeatureFlags,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags (Default Values)
// ============================================================

export const DEFAULT_FEATURE_FLAGS: MonetizationFeatureFlags = {
  adsEnabled: true,
  rewardedAdsEnabled: true,
  storeEnabled: true,
  starsEnabled: true,
  premiumEnabled: false, // Disabled in MVP until Telegram subscription support confirmed
  limitedItemsEnabled: false, // Disabled in MVP
};

// ============================================================
// Product Catalog
// ============================================================

export const PRODUCT_CATALOG: Product[] = [
  // === COSMETIC PRODUCTS ===
  // Profile Frames
  {
    id: 'frame_neon_rush',
    slug: 'neon-rush-frame',
    name: 'Neon Rush Frame',
    description: 'A vibrant neon frame for your profile',
    type: 'cosmetic',
    category: 'avatar_frame',
    priceStars: 120,
    rarity: 'epic',
    assetUrl: '/assets/cosmetics/frames/neon_rush.png',
    previewUrl: '/assets/cosmetics/frames/neon_rush_preview.png',
    metadata: {
      visual: { color: '#00ff88', glow: true, style: 'neon' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 1,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'frame_flame',
    slug: 'flame-frame',
    name: 'Flame Frame',
    description: 'A fiery frame that shows your passion',
    type: 'cosmetic',
    category: 'avatar_frame',
    priceStars: 150,
    rarity: 'epic',
    assetUrl: '/assets/cosmetics/frames/flame.png',
    previewUrl: '/assets/cosmetics/frames/flame_preview.png',
    metadata: {
      visual: { color: '#ff4400', animated: true, style: 'flame' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 5,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'frame_diamond',
    slug: 'diamond-frame',
    name: 'Diamond Frame',
    description: 'A prestigious diamond frame',
    type: 'cosmetic',
    category: 'avatar_frame',
    priceStars: 250,
    rarity: 'legendary',
    assetUrl: '/assets/cosmetics/frames/diamond.png',
    previewUrl: '/assets/cosmetics/frames/diamond_preview.png',
    metadata: {
      visual: { color: '#00ccff', sparkle: true, style: 'diamond' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 10,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Name Effects
  {
    id: 'effect_fire_name',
    slug: 'fire-name-effect',
    name: 'Fire Name Effect',
    description: 'Your name burns with fiery letters',
    type: 'cosmetic',
    category: 'name_effect',
    priceStars: 80,
    rarity: 'rare',
    assetUrl: '/assets/cosmetics/effects/fire_name.json',
    previewUrl: null,
    metadata: {
      visual: { animation: 'fire', color: '#ff6600' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 3,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'effect_electric_name',
    slug: 'electric-name-effect',
    name: 'Electric Name Effect',
    description: 'Your name crackles with electric energy',
    type: 'cosmetic',
    category: 'name_effect',
    priceStars: 100,
    rarity: 'rare',
    assetUrl: '/assets/cosmetics/effects/electric_name.json',
    previewUrl: null,
    metadata: {
      visual: { animation: 'electric', color: '#00ccff' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 5,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Profile Themes
  {
    id: 'theme_neon_night',
    slug: 'neon-night-theme',
    name: 'Neon Night Theme',
    description: 'A dark theme with neon accents',
    type: 'cosmetic',
    category: 'theme',
    priceStars: 200,
    rarity: 'epic',
    assetUrl: '/assets/cosmetics/themes/neon_night.json',
    previewUrl: '/assets/cosmetics/themes/neon_night_preview.png',
    metadata: {
      visual: { primary: '#0a0a1a', accent: '#00ff88', style: 'dark' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 1,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Titles
  {
    id: 'title_rush_master',
    slug: 'rush-master-title',
    name: 'Rush Master',
    description: 'A title for true rush enthusiasts',
    type: 'cosmetic',
    category: 'title',
    priceStars: 180,
    rarity: 'legendary',
    assetUrl: '',
    previewUrl: null,
    metadata: {
      visual: { color: '#ffd700', style: 'premium' },
    },
    availability: {
      startsAt: null,
      endsAt: null,
      maxUnits: null,
      unitsSold: 0,
      minLevel: 15,
      segments: [],
    },
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ============================================================
// Ad Configuration
// ============================================================

export const DEFAULT_AD_CONFIG: AdConfiguration = {
  enabled: true,
  rewardedAdsEnabled: true,
  interstitialAdsEnabled: true,
  minIntervalMs: 60_000, // 1 minute between ads
  maxPerSession: 5,
  maxPerDay: 10,
  eligibleScreens: ['game_complete', 'daily_rush_complete', 'mission_complete'],
  provider: {
    name: 'telegram',
    config: {
      /** Telegram Mini App ads integration */
      appId: 'YOUR_TELEGRAM_APP_ID',
      /** Testing mode in development */
      testMode: true,
    },
  },
};

// ============================================================
// Rewarded Ad Rewards
// ============================================================

export interface RewardedAdRewardConfig {
  type: 'xp' | 'cosmetic_progression' | 'mission_progress';
  amount: number;
  dailyCap: number;
  /** Minimum user level to see this reward */
  minLevel: number;
}

export const REWARDED_AD_REWARDS: RewardedAdRewardConfig[] = [
  {
    type: 'xp',
    amount: 25,
    dailyCap: 100, // Max 100 XP per day from ads
    minLevel: 1,
  },
  {
    type: 'mission_progress',
    amount: 1,
    dailyCap: 3, // Max 3 mission progress boosts per day
    minLevel: 3,
  },
];

// ============================================================
// Premium Features (GTX Rush Plus)
// ============================================================

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: 'ad_free',
    slug: 'ad-free',
    name: 'Ad-Free Experience',
    description: 'Enjoy GTX Rush without ads',
    includedInPremium: true,
    standalonePriceStars: null, // Only available via subscription
    category: 'experience',
    isActive: true,
  },
  {
    id: 'exclusive_cosmetics',
    slug: 'exclusive-cosmetics',
    name: 'Exclusive Cosmetics',
    description: 'Access to premium-only cosmetic items',
    includedInPremium: true,
    standalonePriceStars: null,
    category: 'cosmetics',
    isActive: true,
  },
  {
    id: 'profile_customization',
    slug: 'profile-customization',
    name: 'Advanced Profile Customization',
    description: 'Custom backgrounds, effects, and frames',
    includedInPremium: true,
    standalonePriceStars: 50, // Can also be purchased separately
    category: 'profile',
    isActive: true,
  },
  {
    id: 'double_xp_weekends',
    slug: 'double-xp-weekends',
    name: 'Double XP Weekends',
    description: 'Earn double XP during weekend events',
    includedInPremium: true,
    standalonePriceStars: null,
    category: 'progression',
    isActive: true,
  },
];

// ============================================================
// Subscription Plans
// ============================================================

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plus_monthly',
    name: 'GTX Rush Plus',
    description: 'Unlock premium features and ad-free experience',
    priceStars: 500, // ~$10 USD equivalent
    durationDays: 30,
    features: ['ad_free', 'exclusive_cosmetics', 'profile_customization', 'double_xp_weekends'],
    isActive: true,
  },
  {
    id: 'plus_quarterly',
    name: 'GTX Rush Plus Quarterly',
    description: 'Save 20% with quarterly billing',
    priceStars: 1200, // ~$24 USD equivalent (20% discount)
    durationDays: 90,
    features: ['ad_free', 'exclusive_cosmetics', 'profile_customization', 'double_xp_weekends'],
    isActive: true,
  },
];

// ============================================================
// Economy Caps
// ============================================================

export const ECONOMY_CAPS = {
  /** Maximum rewarded ads per day */
  maxRewardedAdsPerDay: 10,
  /** Maximum XP from ads per day */
  maxXpFromAdsPerDay: 100,
  /** Maximum mission progress boosts per day */
  maxMissionBoostsPerDay: 3,
  /** Maximum cosmetic purchases per day (prevent abuse) */
  maxPurchasesPerDay: 50,
  /** Maximum Stars that can be spent per day */
  maxStarsSpentPerDay: 10000,
};

// ============================================================
// Store Configuration
// ============================================================

export const STORE_CONFIG = {
  /** Products to feature on home page */
  featuredProductIds: ['frame_neon_rush', 'effect_fire_name', 'theme_neon_night'],
  /** Maximum products per category display */
  maxProductsPerCategory: 20,
  /** Enable product previews */
  enablePreviews: true,
  /** Enable ownership badges */
  enableOwnershipBadges: true,
};

// ============================================================
// Telegram Stars Configuration
// ============================================================

export const TELEGRAM_STARS_CONFIG = {
  /** Currency code for Telegram Stars */
  currency: 'XTR',
  /** Minimum purchase amount */
  minAmount: 1,
  /** Maximum purchase amount */
  maxAmount: 10000,
  /** Provider token (loaded from env) */
  providerToken: '', // Set from env STARS_PAYMENT_TOKEN
  /** Test mode in development */
  testMode: true,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get product by ID from catalog.
 */
export function getProductById(productId: string): Product | undefined {
  return PRODUCT_CATALOG.find((p) => p.id === productId);
}

/**
 * Get products by category.
 */
export function getProductsByCategory(category: CosmeticCategory): Product[] {
  return PRODUCT_CATALOG.filter((p) => p.category === category && p.isActive);
}

/**
 * Get products by type.
 */
export function getProductsByType(type: ProductType): Product[] {
  return PRODUCT_CATALOG.filter((p) => p.type === type && p.isActive);
}

/**
 * Get featured products.
 */
export function getFeaturedProducts(): Product[] {
  return STORE_CONFIG.featuredProductIds
    .map((id: string) => getProductById(id))
    .filter((p): p is Product => p !== undefined);
}

/**
 * Check if a product is available for a user.
 */
export function isProductAvailable(
  product: Product,
  userLevel: number,
  userSegments: string[] = [],
): boolean {
  // Check if product is active
  if (!product.isActive) return false;

  // Check availability window
  const now = new Date();
  if (product.availability.startsAt && now < product.availability.startsAt) return false;
  if (product.availability.endsAt && now > product.availability.endsAt) return false;

  // Check max units
  if (product.availability.maxUnits !== null) {
    if (product.availability.unitsSold >= product.availability.maxUnits) return false;
  }

  // Check minimum level
  if (userLevel < product.availability.minLevel) return false;

  // Check segments (empty means available to all)
  if (product.availability.segments.length > 0) {
    const hasMatchingSegment = product.availability.segments.some((seg) =>
      userSegments.includes(seg),
    );
    if (!hasMatchingSegment) return false;
  }

  return true;
}

/**
 * Calculate discounted price (for future promotions).
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discountPercent: number,
): number {
  const discount = Math.min(100, Math.max(0, discountPercent));
  return Math.round(originalPrice * (1 - discount / 100));
}
