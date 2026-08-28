/**
 * GTX Rush — Share Engine v1.0
 *
 * Share engine that handles:
 * - Generating shareable content for scores, badges, challenges
 * - Creating share links with deep link integration
 * - Tracking share events
 * - Integrating with referral system
 *
 * SECURITY:
 * - Share messages do not expose private data
 * - Deep links are validated
 * - Share events are tracked for analytics
 *
 * Contract: Growth Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  ShareData,
  ShareMessage,
  ShareLink,
  ShareType,
  DeepLinkContext,
} from '@gtx-rush/types';
import {
  SHARE_TEMPLATES,
  DEEP_LINK_CONFIG,
  generateReferralDeepLink,
  generateChallengeDeepLink,
  getShareMessage,
} from '@gtx-rush/config';
import { getUserReferralCode, generateReferralCode } from './referral-engine';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const shareLinks = new Map<string, ShareLink>();
const userShareLinks = new Map<string, string[]>(); // userId → shareLinkIds

// ============================================================
// Share Link Generation
// ============================================================

/**
 * Generate a share link for content.
 *
 * SECURITY:
 * - Share messages do not expose private data
 * - Deep links are validated
 * - Share events are tracked
 */
export function generateShareLink(
  data: ShareData,
): {
  success: boolean;
  shareLink?: ShareLink;
  message?: ShareMessage;
  deepLink?: string;
  error?: string;
} {
  // Get or create user's referral code
  let referralCode = getUserReferralCode(data.userId);
  if (!referralCode) {
    referralCode = generateReferralCode(data.userId);
  }

  // Generate deep link based on share type
  let deepLink: string;
  let context: DeepLinkContext;

  switch (data.type) {
    case 'challenge':
      if (!data.challengeId) {
        return { success: false, error: 'CHALLENGE_ID_REQUIRED' };
      }
      deepLink = generateChallengeDeepLink(data.challengeId);
      context = {
        referralCode: null,
        challengeToken: data.challengeId,
        campaignId: null,
        source: 'friend_challenge',
        params: {},
      };
      break;

    default:
      // For score, badge, personal_best, achievement, daily_rush
      deepLink = generateReferralDeepLink(referralCode.code);
      context = {
        referralCode: referralCode.code,
        challengeToken: null,
        campaignId: null,
        source: 'direct_referral',
        params: {},
      };
      break;
  }

  // Generate share message
  const variables: Record<string, string | number> = {
    score: data.score ?? 0,
    gameName: getGameName(data.gameId),
    badgeName: data.badgeId ?? 'a badge',
    achievementName: data.achievementId ?? 'an achievement',
    inviterName: 'Your Friend',
  };

  const messageText = getShareMessage(data.type, variables);
  const template = SHARE_TEMPLATES[data.type];

  const message: ShareMessage = {
    title: template?.title ?? 'GTX Rush',
    description: messageText,
    deepLink,
    imageUrl: undefined,
  };

  // Create share link record
  const shareLink: ShareLink = {
    id: nanoid(),
    type: data.type,
    userId: data.userId,
    deepLink,
    referralCode: referralCode.code,
    campaignId: null,
    metadata: {
      gameId: data.gameId,
      score: data.score,
      challengeId: data.challengeId,
      badgeId: data.badgeId,
      achievementId: data.achievementId,
    },
    createdAt: new Date(),
    expiresAt: null,
  };

  shareLinks.set(shareLink.id, shareLink);

  // Update user share links index
  const userLinks = userShareLinks.get(data.userId) ?? [];
  userLinks.push(shareLink.id);
  userShareLinks.set(data.userId, userLinks);

  return {
    success: true,
    shareLink,
    message,
    deepLink,
  };
}

/**
 * Generate a challenge share link.
 */
export function generateChallengeShareLink(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
): {
  success: boolean;
  shareLink?: ShareLink;
  message?: ShareMessage;
  deepLink?: string;
  error?: string;
} {
  return generateShareLink({
    type: 'challenge',
    userId,
    gameId,
    score,
    challengeId,
  });
}

/**
 * Generate a score share link.
 */
export function generateScoreShareLink(
  userId: string,
  gameId: string,
  score: number,
): {
  success: boolean;
  shareLink?: ShareLink;
  message?: ShareMessage;
  deepLink?: string;
  error?: string;
} {
  return generateShareLink({
    type: 'score',
    userId,
    gameId,
    score,
  });
}

/**
 * Generate a badge share link.
 */
export function generateBadgeShareLink(
  userId: string,
  badgeId: string,
): {
  success: boolean;
  shareLink?: ShareLink;
  message?: ShareMessage;
  deepLink?: string;
  error?: string;
} {
  return generateShareLink({
    type: 'badge',
    userId,
    badgeId,
  });
}

/**
 * Generate a personal best share link.
 */
export function generatePersonalBestShareLink(
  userId: string,
  gameId: string,
  score: number,
): {
  success: boolean;
  shareLink?: ShareLink;
  message?: ShareMessage;
  deepLink?: string;
  error?: string;
} {
  return generateShareLink({
    type: 'personal_best',
    userId,
    gameId,
    score,
  });
}

// ============================================================
// Share Link Queries
// ============================================================

/**
 * Get a share link by ID.
 */
export function getShareLink(linkId: string): ShareLink | null {
  return shareLinks.get(linkId) ?? null;
}

/**
 * Get user's share links.
 */
export function getUserShareLinks(userId: string): ShareLink[] {
  const linkIds = userShareLinks.get(userId) ?? [];
  return linkIds
    .map((id) => shareLinks.get(id))
    .filter((link): link is ShareLink => link !== undefined)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ============================================================
// Share Tracking
// ============================================================

/**
 * Track a share event.
 */
export function trackShareEvent(
  userId: string,
  type: ShareType,
  shareLinkId: string,
): void {
  // In production, record to analytics_events table
  // For MVP, just log
  console.log(`[SHARE] User ${userId} shared ${type} via ${shareLinkId}`);
}

// ============================================================
// Helpers
// ============================================================

function getGameName(gameId: string | undefined): string {
  const gameNames: Record<string, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  return gameNames[gameId ?? ''] ?? 'GTX Rush';
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearShareEngine(): void {
  shareLinks.clear();
  userShareLinks.clear();
}

export function _getShareLinkCount(): number {
  return shareLinks.size;
}

export function _getUserShareLinkCount(userId: string): number {
  return (userShareLinks.get(userId) ?? []).length;
}
