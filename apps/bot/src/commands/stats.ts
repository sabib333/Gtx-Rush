/**
 * /stats Command Handler
 *
 * Shows user statistics in a formatted message.
 */

import type { Context } from 'grammy';
import { statsMessage, statsKeyboard, errorMessage } from '@gtx-rush/telegram';
import type { UserService } from '../services/user.service';

export function registerStatsCommand(userService: UserService, botUsername: string) {
  return async (ctx: Context) => {
    const user = ctx.from;
    if (!user) {
      await ctx.reply(errorMessage('Could not identify user'));
      return;
    }

    const userData = await userService.getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    await ctx.reply(
      statsMessage({
        displayName: userData.displayName,
        level: userData.level,
        xpTotal: userData.xpTotal,
        currentStreak: userData.currentStreak,
        longestStreak: userData.longestStreak,
        totalGames: userData.totalGamesPlayed,
        totalScore: userData.totalScore,
        globalRank: userData.globalRank,
      }),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: statsKeyboard(botUsername),
        },
      }
    );
  };
}

/**
 * /profile Command Handler
 *
 * Opens the profile page in the Mini App.
 */

import { buildMiniAppLink } from '@gtx-rush/telegram';

export function registerProfileCommand(botUsername: string) {
  return async (ctx: Context) => {
    const link = buildMiniAppLink(botUsername, 'profile');

    await ctx.reply('👤 *Your Profile*', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👤 Open Profile', web_app: { url: link } }],
        ],
      },
    });
  };
}
