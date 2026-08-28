import type { AnalyticsEventName } from '@gtx-rush/types';

/**
 * Complete analytics event taxonomy.
 * Every new feature MUST track events from this list.
 */

export interface EventDefinition {
  name: AnalyticsEventName;
  description: string;
  requiredProperties: string[];
  optionalProperties: string[];
}

export const EVENT_DEFINITIONS: Record<AnalyticsEventName, EventDefinition> = {
  app_open: {
    name: 'app_open',
    description: 'User opens the Mini App',
    requiredProperties: [],
    optionalProperties: ['platform', 'telegramVersion', 'startParam'],
  },
  onboarding_complete: {
    name: 'onboarding_complete',
    description: 'User completes first interaction',
    requiredProperties: [],
    optionalProperties: ['timeToCompleteMs'],
  },
  game_start: {
    name: 'game_start',
    description: 'User starts a game session',
    requiredProperties: ['gameId'],
    optionalProperties: ['gameVersion', 'source'],
  },
  game_complete: {
    name: 'game_complete',
    description: 'User completes a game session',
    requiredProperties: ['gameId', 'score', 'durationMs'],
    optionalProperties: ['inputCount', 'isPersonalBest', 'rank'],
  },
  score_submitted: {
    name: 'score_submitted',
    description: 'Score validated and recorded',
    requiredProperties: ['gameId', 'score'],
    optionalProperties: ['isPersonalBest', 'rank', 'antiCheatFlags'],
  },
  challenge_created: {
    name: 'challenge_created',
    description: 'Friend challenge created',
    requiredProperties: ['gameId', 'challengeId'],
    optionalProperties: [],
  },
  challenge_completed: {
    name: 'challenge_completed',
    description: 'Friend challenge completed',
    requiredProperties: ['challengeId', 'winnerId'],
    optionalProperties: ['scores'],
  },
  referral_created: {
    name: 'referral_created',
    description: 'Referral code generated',
    requiredProperties: ['referrerId'],
    optionalProperties: [],
  },
  referral_activated: {
    name: 'referral_activated',
    description: 'Referral milestone met and activated',
    requiredProperties: ['referrerId', 'referredId', 'activationEvent'],
    optionalProperties: [],
  },
  daily_challenge_started: {
    name: 'daily_challenge_started',
    description: 'User starts daily challenge',
    requiredProperties: ['challengeId', 'gameId', 'attemptNumber'],
    optionalProperties: [],
  },
  daily_challenge_completed: {
    name: 'daily_challenge_completed',
    description: 'User completes daily challenge',
    requiredProperties: ['challengeId', 'score'],
    optionalProperties: ['rank', 'attemptNumber'],
  },
  purchase_started: {
    name: 'purchase_started',
    description: 'Purchase initiated',
    requiredProperties: ['itemType', 'itemId', 'priceStars'],
    optionalProperties: [],
  },
  purchase_completed: {
    name: 'purchase_completed',
    description: 'Purchase verified and completed',
    requiredProperties: ['itemType', 'itemId', 'priceStars', 'paymentId'],
    optionalProperties: [],
  },
  ad_impression: {
    name: 'ad_impression',
    description: 'Ad shown to user',
    requiredProperties: ['placement', 'adProvider'],
    optionalProperties: [],
  },
  ad_completed: {
    name: 'ad_completed',
    description: 'Ad finished playing',
    requiredProperties: ['placement', 'adProvider'],
    optionalProperties: ['rewardType'],
  },
  streak_started: {
    name: 'streak_started',
    description: 'New streak begun',
    requiredProperties: ['streakCount'],
    optionalProperties: [],
  },
  streak_extended: {
    name: 'streak_extended',
    description: 'Streak continued for another day',
    requiredProperties: ['streakCount'],
    optionalProperties: [],
  },
  badge_unlocked: {
    name: 'badge_unlocked',
    description: 'Badge earned by user',
    requiredProperties: ['badgeId', 'badgeSlug', 'rarity'],
    optionalProperties: [],
  },
  leaderboard_rank_changed: {
    name: 'leaderboard_rank_changed',
    description: 'User rank changed significantly',
    requiredProperties: ['leaderboardType', 'oldRank', 'newRank'],
    optionalProperties: ['gameId'],
  },
  share_score: {
    name: 'share_score',
    description: 'User shares their score',
    requiredProperties: ['gameId'],
    optionalProperties: ['platform', 'score'],
  },
};
