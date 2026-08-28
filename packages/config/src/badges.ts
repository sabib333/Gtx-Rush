/**
 * GTX Rush — Badge Definitions Configuration
 *
 * Initial badge set with event-driven evaluation criteria.
 * Badges are configuration-driven and can be extended without code changes.
 *
 * Categories:
 * - gameplay: Game-specific achievements
 * - social: Friend challenge and sharing
 * - progression: Level and XP milestones
 * - competition: Ranking and tier achievements
 * - special: Limited-time or unique achievements
 */

import type { Badge, BadgeCriteriaType } from '@gtx-rush/types';

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  category: Badge['category'];
  rarity: Badge['rarity'];
  criteriaType: BadgeCriteriaType;
  threshold: number;
  gameId?: string;
  timeWindowDays?: number;
  rewardXp: number;
  rewardTitleId?: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── Gameplay ──────────────────────────────────────────
  {
    slug: 'first_rush',
    name: 'First Rush',
    description: 'Play your first game.',
    iconUrl: '🏅/first_rush.png',
    category: 'gameplay',
    rarity: 'common',
    criteriaType: 'first_game',
    threshold: 1,
    rewardXp: 25,
  },
  {
    slug: 'speed_demon',
    name: 'Speed Demon',
    description: 'Achieve a Reaction Rush score of 8,000+.',
    iconUrl: '🏅/speed_demon.png',
    category: 'gameplay',
    rarity: 'rare',
    criteriaType: 'score_reached',
    threshold: 8000,
    gameId: 'reaction-rush',
    rewardXp: 100,
    rewardTitleId: 'speed_demon',
  },
  {
    slug: 'tap_master',
    name: 'Tap Master',
    description: 'Achieve a Tap Rush score of 10,000+.',
    iconUrl: '🏅/tap_master.png',
    category: 'gameplay',
    rarity: 'rare',
    criteriaType: 'score_reached',
    threshold: 10000,
    gameId: 'tap-rush',
    rewardXp: 100,
    rewardTitleId: 'tap_master',
  },
  {
    slug: 'quiz_brain',
    name: 'Quiz Brain',
    description: 'Achieve a Quiz Rush score of 5,000+.',
    iconUrl: '🏅/quiz_brain.png',
    category: 'gameplay',
    rarity: 'rare',
    criteriaType: 'score_reached',
    threshold: 5000,
    gameId: 'quiz-rush',
    rewardXp: 100,
    rewardTitleId: 'quiz_master',
  },
  {
    slug: 'perfect_game',
    name: 'Perfect Game',
    description: 'Complete a game with a perfect score (no mistakes).',
    iconUrl: '🏅/perfect_game.png',
    category: 'gameplay',
    rarity: 'epic',
    criteriaType: 'perfect_game',
    threshold: 1,
    rewardXp: 200,
  },
  {
    slug: 'games_100',
    name: 'Dedicated Rusher',
    description: 'Play 100 games.',
    iconUrl: '🏅/games_100.png',
    category: 'gameplay',
    rarity: 'uncommon',
    criteriaType: 'games_played',
    threshold: 100,
    rewardXp: 75,
  },
  {
    slug: 'games_1000',
    name: 'Rush Veteran',
    description: 'Play 1,000 games.',
    iconUrl: '🏅/games_1000.png',
    category: 'gameplay',
    rarity: 'epic',
    criteriaType: 'games_played',
    threshold: 1000,
    rewardXp: 300,
  },

  // ── Social ────────────────────────────────────────────
  {
    slug: 'challenger',
    name: 'Challenger',
    description: 'Complete your first friend challenge.',
    iconUrl: '🏅/challenger.png',
    category: 'social',
    rarity: 'common',
    criteriaType: 'challenges_completed',
    threshold: 1,
    rewardXp: 50,
    rewardTitleId: 'challenger',
  },
  {
    slug: 'champion',
    name: 'Champion',
    description: 'Win 10 friend challenges.',
    iconUrl: '🏅/champion.png',
    category: 'social',
    rarity: 'rare',
    criteriaType: 'challenges_won',
    threshold: 10,
    rewardXp: 150,
    rewardTitleId: 'champion',
  },
  {
    slug: 'unstoppable',
    name: 'Unstoppable',
    description: 'Win 50 friend challenges.',
    iconUrl: '🏅/unstoppable.png',
    category: 'social',
    rarity: 'legendary',
    criteriaType: 'challenges_won',
    threshold: 50,
    rewardXp: 500,
    rewardTitleId: 'legend',
  },

  // ── Progression ───────────────────────────────────────
  {
    slug: 'rising_star',
    name: 'Rising Star',
    description: 'Reach Level 5.',
    iconUrl: '🏅/rising_star.png',
    category: 'progression',
    rarity: 'common',
    criteriaType: 'level_reached',
    threshold: 5,
    rewardXp: 50,
  },
  {
    slug: 'hot_streak',
    name: 'Hot Streak',
    description: 'Complete a 7-day activity streak.',
    iconUrl: '🏅/hot_streak.png',
    category: 'progression',
    rarity: 'uncommon',
    criteriaType: 'streak_days',
    threshold: 7,
    rewardXp: 75,
  },
  {
    slug: 'iron_will',
    name: 'Iron Will',
    description: 'Complete a 30-day activity streak.',
    iconUrl: '🏅/iron_will.png',
    category: 'progression',
    rarity: 'epic',
    criteriaType: 'streak_days',
    threshold: 30,
    rewardXp: 300,
    rewardTitleId: 'legend',
  },
  {
    slug: 'daily_warrior',
    name: 'Daily Warrior',
    description: 'Complete 30 daily challenges.',
    iconUrl: '🏅/daily_warrior.png',
    category: 'progression',
    rarity: 'rare',
    criteriaType: 'daily_challenges_completed',
    threshold: 30,
    rewardXp: 150,
  },
  {
    slug: 'xp_collector',
    name: 'XP Collector',
    description: 'Earn 10,000 total XP.',
    iconUrl: '🏅/xp_collector.png',
    category: 'progression',
    rarity: 'uncommon',
    criteriaType: 'total_xp_earned',
    threshold: 10000,
    rewardXp: 100,
  },

  // ── Competition ───────────────────────────────────────
  {
    slug: 'top_10k',
    name: 'Top 10K',
    description: 'Reach the global top 10,000.',
    iconUrl: '🏅/top_10k.png',
    category: 'competition',
    rarity: 'rare',
    criteriaType: 'rank_reached',
    threshold: 10000,
    rewardXp: 100,
  },
  {
    slug: 'top_1k',
    name: 'Top 1K',
    description: 'Reach the global top 1,000.',
    iconUrl: '🏅/top_1k.png',
    category: 'competition',
    rarity: 'epic',
    criteriaType: 'rank_reached',
    threshold: 1000,
    rewardXp: 300,
    rewardTitleId: 'elite',
  },
  {
    slug: 'top_100',
    name: 'Top 100',
    description: 'Reach the global top 100.',
    iconUrl: '🏅/top_100.png',
    category: 'competition',
    rarity: 'legendary',
    criteriaType: 'rank_reached',
    threshold: 100,
    rewardXp: 500,
    rewardTitleId: 'legend',
  },
  {
    slug: 'diamond_tier',
    name: 'Diamond Tier',
    description: 'Reach Diamond tier.',
    iconUrl: '🏅/diamond_tier.png',
    category: 'competition',
    rarity: 'epic',
    criteriaType: 'tier_reached',
    threshold: 4, // Diamond is index 4 (0-indexed: bronze=0, silver=1, gold=2, platinum=3, diamond=4)
    rewardXp: 200,
  },
  {
    slug: 'legend_tier',
    name: 'Legend Tier',
    description: 'Reach Legend tier.',
    iconUrl: '🏅/legend_tier.png',
    category: 'competition',
    rarity: 'legendary',
    criteriaType: 'tier_reached',
    threshold: 6, // Legend is index 6
    rewardXp: 500,
    rewardTitleId: 'legend',
  },

  // ── Special ───────────────────────────────────────────
  {
    slug: 'season_champion',
    name: 'Season Champion',
    description: 'Finish a season in the top 10.',
    iconUrl: '🏅/season_champion.png',
    category: 'special',
    rarity: 'legendary',
    criteriaType: 'rank_reached',
    threshold: 10,
    timeWindowDays: 30, // Per season
    rewardXp: 1000,
    rewardTitleId: 'season_champion',
  },
];

/**
 * Get badge definition by slug.
 */
export function getBadgeBySlug(slug: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.slug === slug);
}

/**
 * Get all badges for a category.
 */
export function getBadgesByCategory(category: Badge['category']): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}
