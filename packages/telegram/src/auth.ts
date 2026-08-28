import { createHmac } from 'node:crypto';
import { getEnv } from '@gtx-rush/config';

/**
 * Telegram Mini App init data verification.
 * This is the CRITICAL security component — never trust client data.
 *
 * Flow:
 * 1. Telegram sends init_data to client as URL params
 * 2. Client sends it to our server
 * 3. Server verifies HMAC-SHA256 using bot token
 * 4. If valid, extract user data
 */

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramUserData;
  authDate: Date;
  startParam?: string;
  chatInstance?: string;
  chatType?: string;
}

/**
 * Parse the init_data string into key-value pairs.
 */
function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData);
  return new Map(params.entries());
}

/**
 * Compute HMAC-SHA256 for Telegram init data verification.
 * Uses bot token as the secret key.
 */
function computeHash(dataCheckString: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(dataCheckString);
  return hmac.digest('hex');
}

/**
 * Verify Telegram Mini App init data.
 *
 * @param initData - The raw init_data string from Telegram
 * @returns Verified user data or null if verification fails
 *
 * @throws Never throws — returns null on failure
 */
export function verifyTelegramInitData(initData: string): VerifiedInitData | null {
  try {
    const env = getEnv();
    const params = parseInitData(initData);

    // Extract and remove hash from params
    const hash = params.get('hash');
    if (!hash) {
      return null;
    }
    params.delete('hash');

    // Sort remaining parameters alphabetically
    const sortedParams = Array.from(params.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    // Build data-check-string
    const dataCheckString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Compute expected hash using bot token
    const secret = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest('hex');
    const expectedHash = computeHash(dataCheckString, secret);

    // Compare hashes (constant-time comparison)
    if (hash.length !== expectedHash.length) {
      return null;
    }

    let mismatch = 0;
    for (let i = 0; i < hash.length; i++) {
      mismatch |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    if (mismatch !== 0) {
      return null;
    }

    // Check auth_date is recent (within 24 hours)
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return null;
    }

    const authDate = new Date(Number(authDateStr) * 1000);
    const now = new Date();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now.getTime() - authDate.getTime() > twentyFourHours) {
      return null; // Auth data too old
    }

    // Extract user data
    const userStr = params.get('user');
    if (!userStr) {
      return null;
    }

    const user: TelegramUserData = JSON.parse(userStr);

    return {
      user,
      authDate,
      startParam: params.get('start_param') ?? undefined,
      chatInstance: params.get('chat_instance') ?? undefined,
      chatType: params.get('chat_type') ?? undefined,
    };
  } catch {
    return null; // Never throw — verification failure is not exceptional
  }
}

/**
 * Build a deep link for the Telegram Mini App.
 */
export function buildMiniAppLink(botUsername: string, startParam?: string): string {
  const base = `https://t.me/${botUsername}`;
  if (startParam) {
    return `${base}?startapp=${encodeURIComponent(startParam)}`;
  }
  return base;
}

/**
 * Build a bot deep link (for /start command).
 */
export function buildBotLink(botUsername: string, startParam?: string): string {
  const base = `https://t.me/${botUsername}`;
  if (startParam) {
    return `${base}?start=${encodeURIComponent(startParam)}`;
  }
  return base;
}
