/**
 * Frontend Deep-Link Parser
 *
 * Parses Telegram start parameters into typed actions.
 * Used on the frontend to route users to the correct screen.
 */

export type DeepLinkAction =
  | { type: 'home' }
  | { type: 'game'; slug: string }
  | { type: 'challenge'; token: string }
  | { type: 'referral'; code: string }
  | { type: 'leaderboard' }
  | { type: 'profile' }
  | { type: 'referral_page' }
  | { type: 'unknown'; raw: string };

/**
 * Parse a Telegram start parameter into a typed action.
 *
 * Format: `prefix_value` or just `prefix`
 *
 * Examples:
 * - `game_reaction-rush` → { type: 'game', slug: 'reaction-rush' }
 * - `chal_abc123` → { type: 'challenge', token: 'abc123' }
 * - `ref_XY789` → { type: 'referral', code: 'XY789' }
 * - `leaderboard` → { type: 'leaderboard' }
 */
export function parseDeepLink(startParam: string | null | undefined): DeepLinkAction {
  if (!startParam) return { type: 'home' };

  const param = startParam.trim();

  // Game: game_<slug>
  if (param.startsWith('game_')) {
    const slug = param.slice(5);
    if (slug) return { type: 'game', slug };
    return { type: 'unknown', raw: param };
  }

  // Challenge: chal_<token>
  if (param.startsWith('chal_')) {
    const token = param.slice(5);
    if (token) return { type: 'challenge', token };
    return { type: 'unknown', raw: param };
  }

  // Referral: ref_<code>
  if (param.startsWith('ref_')) {
    const code = param.slice(4);
    if (code) return { type: 'referral', code };
    return { type: 'unknown', raw: param };
  }

  // Simple string commands
  switch (param) {
    case 'leaderboard':
    case 'rank':
      return { type: 'leaderboard' };
    case 'profile':
      return { type: 'profile' };
    case 'referral':
    case 'invite':
      return { type: 'referral_page' };
    case 'home':
    case 'start':
      return { type: 'home' };
    default:
      return { type: 'unknown', raw: param };
  }
}

/**
 * Validate a deep link parameter.
 * Returns true if the parameter is well-formed and the referenced entity exists.
 *
 * NOTE: This only validates format, not existence.
 * Existence checks require API calls.
 */
export function validateDeepLink(action: DeepLinkAction): {
  valid: boolean;
  error?: string;
} {
  switch (action.type) {
    case 'home':
    case 'leaderboard':
    case 'profile':
    case 'referral_page':
      return { valid: true };

    case 'game': {
      const validSlugs = ['reaction-rush', 'tap-rush', 'quiz-rush'];
      if (!validSlugs.includes(action.slug)) {
        return { valid: false, error: `Unknown game: ${action.slug}` };
      }
      return { valid: true };
    }

    case 'challenge': {
      if (action.token.length < 8 || action.token.length > 64) {
        return { valid: false, error: 'Invalid challenge token format' };
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(action.token)) {
        return { valid: false, error: 'Challenge token contains invalid characters' };
      }
      return { valid: true };
    }

    case 'referral': {
      if (action.code.length < 4 || action.code.length > 32) {
        return { valid: false, error: 'Invalid referral code format' };
      }
      return { valid: true };
    }

    case 'unknown':
      return { valid: false, error: `Unknown action: ${action.raw}` };

    default:
      return { valid: false, error: 'Unhandled deep link type' };
  }
}
