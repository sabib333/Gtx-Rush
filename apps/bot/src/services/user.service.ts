/**
 * Bot User Service
 *
 * Handles user lookups and creation from the bot side.
 * The bot receives Telegram user data from /start commands
 * and needs to look up or create users in the backend.
 */

import { BotApiClient } from '@gtx-rush/telegram';

export interface BotUser {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  totalScore: number;
  globalRank: number | null;
}

// In-memory user cache for the bot (maps telegramId -> user)
// In production, this would be backed by the API
const userCache = new Map<number, BotUser>();

export class UserService {
  private api: BotApiClient;

  constructor(api: BotApiClient) {
    this.api = api;
  }

  /**
   * Get or create a user from Telegram data.
   * Called when a user interacts with the bot.
   */
  async getOrCreateUser(telegramData: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  }): Promise<BotUser> {
    // Check cache first
    const cached = userCache.get(telegramData.id);
    if (cached) return cached;

    // Try API lookup
    const apiUser = await this.api.getUserByTelegramId(telegramData.id);
    if (apiUser) {
      const user: BotUser = {
        id: apiUser.id,
        telegramId: apiUser.telegramId,
        username: apiUser.username,
        displayName: apiUser.displayName,
        level: apiUser.level,
        xpTotal: apiUser.xpTotal,
        currentStreak: apiUser.currentStreak,
        longestStreak: apiUser.longestStreak,
        totalGamesPlayed: apiUser.totalGamesPlayed,
        totalScore: apiUser.totalScore,
        globalRank: null,
      };
      userCache.set(telegramData.id, user);
      return user;
    }

    // Create mock user for development
    // In production, this would call the API to create
    const displayName = telegramData.last_name
      ? `${telegramData.first_name} ${telegramData.last_name}`
      : telegramData.first_name;

    const user: BotUser = {
      id: `tg_${telegramData.id}`,
      telegramId: telegramData.id,
      username: telegramData.username ?? `user_${telegramData.id}`,
      displayName,
      level: 1,
      xpTotal: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalGamesPlayed: 0,
      totalScore: 0,
      globalRank: null,
    };

    userCache.set(telegramData.id, user);
    return user;
  }

  /**
   * Get user stats for the stats command.
   */
  async getStats(telegramId: number): Promise<BotUser | null> {
    return userCache.get(telegramId) ?? null;
  }

  /**
   * Update user in cache (after game completion, etc.)
   */
  updateUser(telegramId: number, updates: Partial<BotUser>): void {
    const existing = userCache.get(telegramId);
    if (existing) {
      userCache.set(telegramId, { ...existing, ...updates });
    }
  }
}
