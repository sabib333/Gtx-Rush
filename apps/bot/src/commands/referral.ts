/**
 * /referral Command Handler
 *
 * Shows referral information and generates invite link.
 */

import type { Context } from 'grammy';
import { referralMessage, errorMessage } from '@gtx-rush/telegram';
import { buildBotLink } from '@gtx-rush/telegram';
import type { UserService } from '../services/user.service';

export function registerReferralCommand(userService: UserService, botUsername: string) {
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

    // Generate referral code from user ID
    const referralCode = `ref_${Buffer.from(String(user.id)).toString('base64url').slice(0, 8)}`;
    const referralLink = buildBotLink(botUsername, referralCode);

    await ctx.reply(
      referralMessage({
        friendsJoined: 0,
        friendsActivated: 0,
        referralCode,
      }),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Invite Friends', url: referralLink }],
            [{ text: '🎮 Play Now', web_app: { url: `https://t.me/${botUsername}` } }],
          ],
        },
      }
    );
  };
}
