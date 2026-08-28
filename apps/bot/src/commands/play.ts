/**
 * /play Command Handler
 *
 * Shows game selection menu with Mini App buttons.
 */

import type { Context } from 'grammy';
import { gameSelectKeyboard, gameSelectMessage } from '@gtx-rush/telegram';

export function registerPlayCommand(botUsername: string) {
  return async (ctx: Context) => {
    await ctx.reply(gameSelectMessage(), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: gameSelectKeyboard(botUsername),
      },
    });
  };
}
