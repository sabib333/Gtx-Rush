/**
 * Notification Handlers
 *
 * Sends Telegram messages when game events occur:
 * - Score submitted → optional notification
 * - Challenge completed → notify both players
 * - Daily challenge available → broadcast
 * - Streak milestone → congratulate
 * - Badge earned → celebrate
 *
 * These are called by the API via webhook or event system.
 * For MVP, they're triggered from the bot's own game flows.
 */

import type { Bot } from 'grammy';
import {
  scoreShareKeyboard,
  challengeResultKeyboard,
  buildMiniAppLink,
} from '@gtx-rush/telegram';

export class NotificationService {
  private bot: Bot;
  private botUsername: string;

  constructor(bot: Bot, botUsername: string) {
    this.bot = bot;
    this.botUsername = botUsername;
  }

  /**
   * Notify a user about their score after a game.
   */
  async notifyScore(
    telegramId: number,
    gameSlug: string,
    score: number,
    rank: number | null
  ) {
    const gameName = gameSlug.replace(/-/g, ' ');
    let msg = `⚡ *New Score\\!*\n\n*${gameName}*\nScore: *${score.toLocaleString()}*`;

    if (rank != null) {
      msg += `\nRank: *#${rank.toLocaleString()}*`;
    }

    try {
      await this.bot.api.sendMessage(telegramId, msg, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: scoreShareKeyboard(gameSlug, score, this.botUsername),
        },
      });
    } catch (err) {
      console.error(`Failed to notify score to ${telegramId}:`, err);
    }
  }

  /**
   * Notify both players when a challenge is completed.
   */
  async notifyChallengeResult(
    challengerTelegramId: number,
    opponentTelegramId: number,
    challengeToken: string,
    challengerName: string,
    challengerScore: number,
    opponentName: string,
    opponentScore: number
  ) {
    const challengerWon = challengerScore > opponentScore;
    const opponentWon = opponentScore > challengerScore;

    // Notify challenger
    try {
      const cTrophy = challengerWon ? '🏆' : '😤';
      const cResult = challengerWon ? 'You Won\\!' : 'You Lost\\!';
      await this.bot.api.sendMessage(
        challengerTelegramId,
        `${cTrophy} *${cResult}*\n\n` +
          `*${challengerName}* — *${challengerScore.toLocaleString()}*\n` +
          `*${opponentName}* — *${opponentScore.toLocaleString()}*`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: challengeResultKeyboard(challengeToken, this.botUsername),
          },
        }
      );
    } catch (err) {
      console.error(`Failed to notify challenger:`, err);
    }

    // Notify opponent
    try {
      const oTrophy = opponentWon ? '🏆' : '😤';
      const oResult = opponentWon ? 'You Won\\!' : 'You Lost\\!';
      await this.bot.api.sendMessage(
        opponentTelegramId,
        `${oTrophy} *${oResult}*\n\n` +
          `*${opponentName}* — *${opponentScore.toLocaleString()}*\n` +
          `*${challengerName}* — *${challengerScore.toLocaleString()}*`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: challengeResultKeyboard(challengeToken, this.botUsername),
          },
        }
      );
    } catch (err) {
      console.error(`Failed to notify opponent:`, err);
    }
  }

  /**
   * Notify a user about a streak milestone.
   */
  async notifyStreakMilestone(telegramId: number, days: number) {
    const milestones: Record<number, string> = {
      7: '🔥 *7 Day Streak\\!*\n\nYou\'ve been playing for a week straight\\!',
      14: '🔥🔥 *14 Day Streak\\!*\n\nTwo weeks of dedication\\!',
      30: '🔥🔥🔥 *30 Day Streak\\!*\n\nA whole month\\! You\'re a legend\\!',
    };

    const message = milestones[days];
    if (!message) return;

    try {
      await this.bot.api.sendMessage(telegramId, message, {
        parse_mode: 'MarkdownV2',
      });
    } catch (err) {
      console.error(`Failed to notify streak to ${telegramId}:`, err);
    }
  }

  /**
   * Notify a user about a badge unlock.
   */
  async notifyBadgeUnlock(
    telegramId: number,
    badgeName: string,
    badgeIcon: string
  ) {
    try {
      await this.bot.api.sendMessage(
        telegramId,
        `${badgeIcon} *Badge Unlocked\\!*\n\nYou earned the *${badgeName}* badge\\!`,
        {
          parse_mode: 'MarkdownV2',
        }
      );
    } catch (err) {
      console.error(`Failed to notify badge to ${telegramId}:`, err);
    }
  }

  /**
   * Notify a user about a level up.
   */
  async notifyLevelUp(telegramId: number, newLevel: number, title: string) {
    try {
      await this.bot.api.sendMessage(
        telegramId,
        `🎉 *Level Up\\!*\n\nYou reached *Level ${newLevel}*\\!\nTitle: *${title}*`,
        {
          parse_mode: 'MarkdownV2',
        }
      );
    } catch (err) {
      console.error(`Failed to notify level up to ${telegramId}:`, err);
    }
  }
}
