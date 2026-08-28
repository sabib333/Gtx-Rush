/**
 * /start Command Handler
 *
 * Handles the /start command with deep link parsing.
 * Supports:
 * - /start (no param) → Welcome message
 * - /start ref_CODE → Referral link
 * - /start chal_TOKEN → Challenge link
 * - /start game_SLUG → Direct game link
 */

import type { Context } from 'grammy';
import {
  buildMiniAppLink,
  mainMenuKeyboard,
  welcomeMessage,
  challengeReceivedMessage,
  challengeExpiredMessage,
  errorMessage,
} from '@gtx-rush/telegram';
import type { UserService } from '../services/user.service';
import type { ChallengeService } from '../services/challenge.service';

export function registerStartCommand(
  _bot: unknown,
  botUsername: string,
  userService: UserService,
  challengeService: ChallengeService
) {
  return async (ctx: Context) => {
    // ctx.match is the text after /start
    const rawMatch = ctx.match;
    const startParam = typeof rawMatch === 'string' ? rawMatch : undefined;
    const user = ctx.from;

    if (!user) {
      await ctx.reply(errorMessage('Could not identify user'));
      return;
    }

    // Ensure user exists in our system
    await userService.getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    // === Referral Link ===
    if (startParam?.startsWith('ref_')) {
      const miniAppLink = buildMiniAppLink(botUsername, startParam);

      await ctx.reply(
        `🎉 *Hey ${user.first_name}\\!*\n\n` +
          `You were invited by a friend to join *GTX Rush*\\!\n\n` +
          `Play fast games, climb the rankings, and compete with friends\\.`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Join & Play', web_app: { url: miniAppLink } }],
            ],
          },
        }
      );
      return;
    }

    // === Challenge Link ===
    if (startParam?.startsWith('chal_')) {
      const token = startParam.slice(5);
      const challenge = challengeService.getChallenge(token);

      if (!challenge || challengeService.isExpired(token)) {
        await ctx.reply(challengeExpiredMessage(), { parse_mode: 'MarkdownV2' });
        return;
      }

      // Don't let users challenge themselves
      if (challenge.challengerId === user.id) {
        const miniAppLink = buildMiniAppLink(botUsername, startParam);
        await ctx.reply(
          `⚡ *This is your own challenge\\!*\n\n` +
            `Play your turn to set the score\\.`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Play Your Turn', web_app: { url: miniAppLink } }],
              ],
            },
          }
        );
        return;
      }

      const miniAppLink = buildMiniAppLink(botUsername, startParam);
      await ctx.reply(
        challengeReceivedMessage(
          challenge.challengerName,
          challenge.gameName,
          0
        ),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚔️ Accept & Play', web_app: { url: miniAppLink } }],
              [{ text: '❌ Decline', callback_data: `challenge_decline_${token}` }],
            ],
          },
        }
      );
      return;
    }

    // === Direct Game Link ===
    if (startParam?.startsWith('game_')) {
      const slug = startParam.slice(5);
      const gameName = slug.replace(/-/g, ' ');
      const miniAppLink = buildMiniAppLink(botUsername, startParam);

      await ctx.reply(
        `🎮 *Ready to play ${gameName}?*\n\n` +
          `Tap below to start\\!`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Start Game', web_app: { url: miniAppLink } }],
            ],
          },
        }
      );
      return;
    }

    // === Leaderboard link ===
    if (startParam === 'leaderboard') {
      const miniAppLink = buildMiniAppLink(botUsername, 'leaderboard');
      await ctx.reply('🏆 *Leaderboard*', {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 View Leaderboard', web_app: { url: miniAppLink } }],
          ],
        },
      });
      return;
    }

    // === Default Welcome ===
    await ctx.reply(welcomeMessage(user.first_name), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: mainMenuKeyboard(botUsername),
      },
    });
  };
}
