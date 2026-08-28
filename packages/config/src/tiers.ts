/**
 * GTX Rush — Tier Definitions Configuration
 *
 * Configurable competitive tiers with score thresholds.
 * Each tier has divisions (I, II, III) for granular progression.
 * Thresholds are server-controlled and can be adjusted per season.
 */

import type { TierDefinition } from '@gtx-rush/types';

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: 'bronze',
    name: 'bronze',
    displayName: 'Bronze',
    minScore: 0,
    maxScore: 299,
    iconUrl: '🏆/bronze.png',
    color: '#CD7F32',
    DivisionConfig: [
      { division: 1, displayName: 'Bronze I', minScore: 0, maxScore: 99 },
      { division: 2, displayName: 'Bronze II', minScore: 100, maxScore: 199 },
      { division: 3, displayName: 'Bronze III', minScore: 200, maxScore: 299 },
    ],
  },
  {
    id: 'silver',
    name: 'silver',
    displayName: 'Silver',
    minScore: 300,
    maxScore: 699,
    iconUrl: '🏆/silver.png',
    color: '#C0C0C0',
    DivisionConfig: [
      { division: 1, displayName: 'Silver I', minScore: 300, maxScore: 432 },
      { division: 2, displayName: 'Silver II', minScore: 433, maxScore: 565 },
      { division: 3, displayName: 'Silver III', minScore: 566, maxScore: 699 },
    ],
  },
  {
    id: 'gold',
    name: 'gold',
    displayName: 'Gold',
    minScore: 700,
    maxScore: 1199,
    iconUrl: '🏆/gold.png',
    color: '#FFD700',
    DivisionConfig: [
      { division: 1, displayName: 'Gold I', minScore: 700, maxScore: 866 },
      { division: 2, displayName: 'Gold II', minScore: 867, maxScore: 1032 },
      { division: 3, displayName: 'Gold III', minScore: 1033, maxScore: 1199 },
    ],
  },
  {
    id: 'platinum',
    name: 'platinum',
    displayName: 'Platinum',
    minScore: 1200,
    maxScore: 1799,
    iconUrl: '🏆/platinum.png',
    color: '#E5E4E2',
    DivisionConfig: [
      { division: 1, displayName: 'Platinum I', minScore: 1200, maxScore: 1399 },
      { division: 2, displayName: 'Platinum II', minScore: 1400, maxScore: 1599 },
      { division: 3, displayName: 'Platinum III', minScore: 1600, maxScore: 1799 },
    ],
  },
  {
    id: 'diamond',
    name: 'diamond',
    displayName: 'Diamond',
    minScore: 1800,
    maxScore: 2499,
    iconUrl: '🏆/diamond.png',
    color: '#B9F2FF',
    DivisionConfig: [
      { division: 1, displayName: 'Diamond I', minScore: 1800, maxScore: 2032 },
      { division: 2, displayName: 'Diamond II', minScore: 2033, maxScore: 2265 },
      { division: 3, displayName: 'Diamond III', minScore: 2266, maxScore: 2499 },
    ],
  },
  {
    id: 'master',
    name: 'master',
    displayName: 'Master',
    minScore: 2500,
    maxScore: 3499,
    iconUrl: '🏆/master.png',
    color: '#9B59B6',
    DivisionConfig: [
      { division: 1, displayName: 'Master I', minScore: 2500, maxScore: 2832 },
      { division: 2, displayName: 'Master II', minScore: 2833, maxScore: 3165 },
      { division: 3, displayName: 'Master III', minScore: 3166, maxScore: 3499 },
    ],
  },
  {
    id: 'legend',
    name: 'legend',
    displayName: 'Legend',
    minScore: 3500,
    maxScore: null,
    iconUrl: '🏆/legend.png',
    color: '#FF6B6B',
    DivisionConfig: [
      { division: 1, displayName: 'Legend', minScore: 3500, maxScore: null },
    ],
  },
];

/**
 * Get tier definition by name.
 */
export function getTierByName(name: string): TierDefinition | undefined {
  return TIER_DEFINITIONS.find((t) => t.name === name);
}

/**
 * Get tier for a given score.
 */
export function getTierForScore(score: number): { tier: TierDefinition; division: number } {
  for (const tier of TIER_DEFINITIONS) {
    if (score >= tier.minScore && (tier.maxScore === null || score <= tier.maxScore)) {
      // Find division
      for (const div of tier.DivisionConfig) {
        if (score >= div.minScore && (div.maxScore === null || score <= div.maxScore)) {
          return { tier, division: div.division };
        }
      }
      // Fallback to first division
      return { tier, division: tier.DivisionConfig[0]?.division ?? 1 };
    }
  }
  // Default to bronze
  return { tier: TIER_DEFINITIONS[0]!, division: 1 };
}

/**
 * Get next tier for promotion.
 */
export function getNextTier(currentTierName: string): TierDefinition | null {
  const currentIndex = TIER_DEFINITIONS.findIndex((t) => t.name === currentTierName);
  if (currentIndex < 0 || currentIndex >= TIER_DEFINITIONS.length - 1) return null;
  return TIER_DEFINITIONS[currentIndex + 1] ?? null;
}

/**
 * Get previous tier for demotion.
 */
export function getPreviousTier(currentTierName: string): TierDefinition | null {
  const currentIndex = TIER_DEFINITIONS.findIndex((t) => t.name === currentTierName);
  if (currentIndex <= 0) return null;
  return TIER_DEFINITIONS[currentIndex - 1] ?? null;
}
