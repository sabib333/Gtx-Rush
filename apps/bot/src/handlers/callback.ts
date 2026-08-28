/**
 * Callback Query Handler
 *
 * Handles all inline keyboard button presses.
 * Routes to the appropriate handler based on callback_data prefix.
 */

import type { Context } from 'grammy';
import { mainMenuKeyboard, errorMessage } from '@gtx-rush/telegram';
import { handleChallengeGameSelect } from '../commands/challenge';
import type { ChallengeService } from '../services/challenge.service';
import type { UserService } from '../services/user.service';

export function createCallbackHandler(
  botUsername: string,
  challengeService: ChallengeService,
  userService: UserService
) {
  return async (ctx: Context) => {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    try {
      // === Menu Navigation ===
      if (data === 'menu') {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `⚡ *GTX Rush*\n\nPlay\\. Compete\\. Rise\\.`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: mainMenuKeyboard(botUsername),
            },
          }
        );
        return;
      }

      // === Stats ===
      if (data === 'stats') {
        const user = ctx.from;
        if (!user) {
          await ctx.answerCallbackQuery({ text: 'Error' });
          return;
        }

        const userData = await userService.getOrCreateUser({
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
        });

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `📊 *Your Stats*\n\n` +
            `👤 *${userData.displayName}*\n` +
            `Level *${userData.level}*\n` +
            `XP: *${userData.xpTotal.toLocaleString()}*\n\n` +
            `🔥 Streak: *${userData.currentStreak}* days\n` +
            `🎮 Games: *${userData.totalGamesPlayed}*\n` +
            `🏆 Score: *${userData.totalScore.toLocaleString()}*`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Play Now', web_app: { url: `https://t.me/${botUsername}` } }],
                [{ text: '← Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        return;
      }

      // === Referral ===
      if (data === 'referral') {
        const user = ctx.from;
        if (!user) {
          await ctx.answerCallbackQuery({ text: 'Error' });
          return;
        }

        const referralCode = `ref_${Buffer.from(String(user.id)).toString('base64url').slice(0, 8)}`;
        const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `👥 *Invite Friends*\n\n` +
            `Share your link and earn bonus XP when friends join\\!\n\n` +
            `Your code: \`${referralCode}\``,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📤 Share Link', url: referralLink }],
                [{ text: '← Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        return;
      }

      // === Challenge Game Selection ===
      if (data.startsWith('challenge_select_')) {
        const gameSlug = data.slice('challenge_select_'.length);
        await handleChallengeGameSelect(
          ctx,
          gameSlug,
          botUsername,
          challengeService,
          userService
        );
        return;
      }

      // === Challenge Decline ===
      if (data.startsWith('challenge_decline_')) {
        const token = data.slice('challenge_decline_'.length);
        await ctx.answerCallbackQuery({ text: 'Challenge declined' });
        await ctx.editMessageText(
          `❌ *Challenge Declined*\n\nYou declined the challenge\\.`,
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      // === Challenge Result ===
      if (data.startsWith('challenge_result_')) {
        const token = data.slice('challenge_result_'.length);
        const result = challengeService.getResult(token);

        await ctx.answerCallbackQuery();

        if (!result) {
          await ctx.editMessageText(
            `❌ *Result Not Found*\n\nThis challenge result is no longer available\\.`,
            { parse_mode: 'MarkdownV2' }
          );
          return;
        }

        const trophy = result.winner === 'challenger' ? '🏆' : '😤';
        await ctx.editMessageText(
          `${trophy} *Challenge Result*\n\n` +
            `*${result.challengerName}* — *${result.challengerScore.toLocaleString()}*\n` +
            `*${result.opponentName}* — *${result.opponentScore.toLocaleString()}*\n\n` +
            `Winner: *${result.winner === 'challenger' ? result.challengerName : result.opponentName}*`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '← Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        return;
      }

      // === Unknown callback ===
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.error('Callback handler error:', err);
      await ctx.answerCallbackQuery({ text: 'Something went wrong' });
    }
  };
}
