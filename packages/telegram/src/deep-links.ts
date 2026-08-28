import { getEnv } from '@gtx-rush/config';

/**
 * Deep link helpers for Telegram Mini App.
 * Used for friend challenges, referrals, and direct navigation.
 */

/**
 * Generate a challenge deep link.
 * Opens the Mini App directly to the challenge screen.
 */
export function createChallengeDeepLink(challengeToken: string): string {
  const env = getEnv();
  const botUsername = env.TELEGRAM_BOT_USERNAME;
  return `https://t.me/${botUsername}?startapp=chal_${challengeToken}`;
}

/**
 * Generate a referral deep link.
 */
export function createReferralDeepLink(referralCode: string): string {
  const env = getEnv();
  const botUsername = env.TELEGRAM_BOT_USERNAME;
  return `https://t.me/${botUsername}?start=ref_${referralCode}`;
}

/**
 * Generate a direct game launch link.
 */
export function createGameDeepLink(gameSlug: string): string {
  const env = getEnv();
  const botUsername = env.TELEGRAM_BOT_USERNAME;
  return `https://t.me/${botUsername}?startapp=game_${gameSlug}`;
}

/**
 * Parse a start_param to determine the action type.
 */
export type StartParamAction =
  | { type: 'challenge'; token: string }
  | { type: 'referral'; code: string }
  | { type: 'game'; slug: string }
  | { type: 'unknown'; raw: string };

export function parseStartParam(startParam: string): StartParamAction {
  if (startParam.startsWith('chal_')) {
    return { type: 'challenge', token: startParam.slice(5) };
  }
  if (startParam.startsWith('ref_')) {
    return { type: 'referral', code: startParam.slice(4) };
  }
  if (startParam.startsWith('game_')) {
    return { type: 'game', slug: startParam.slice(5) };
  }
  return { type: 'unknown', raw: startParam };
}
