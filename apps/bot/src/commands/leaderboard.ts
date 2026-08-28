/**
 * /leaderboard Command Handler
 *
 * Shows leaderboard in the Mini App.
 */

import type { Context } from 'grammy';
import { buildMiniAppLink } from '@gtx-rush/telegram';

export function registerLeaderboardCommand(botUsername: string) {
  return async (ctx: Context) => {
    const link = buildMiniAppLink(botUsername, 'leaderboard');

    await ctx.reply('🏆 *Leaderboard*\n\nSee how you rank against other players\\!', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏆 View Leaderboard', web_app: { url: link } }],
        ],
      },
    });
  };
}
