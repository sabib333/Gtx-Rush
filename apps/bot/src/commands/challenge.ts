/**
 * /challenge Command Handler
 *
 * Interactive challenge creation flow:
 * 1. User selects game
 * 2. Bot generates challenge token + link
 * 3. User shares link with friend
 */

import type { Context } from 'grammy';
import {
  callbackButton,
  webAppButton,
  errorMessage,
} from '@gtx-rush/telegram';
import { buildBotLink } from '@gtx-rush/telegram';
import type { ChallengeService } from '../services/challenge.service';
import type { UserService } from '../services/user.service';

const GAMES = [
  { slug: 'reaction-rush', name: 'Reaction Rush', icon: '⚡' },
  { slug: 'tap-rush', name: 'Tap Rush', icon: '👆' },
  { slug: 'quiz-rush', name: 'Quiz Rush', icon: '🧠' },
];

export function registerChallengeCommand(
  botUsername: string,
  challengeService: ChallengeService,
  userService: UserService
) {
  return async (ctx: Context) => {
    const user = ctx.from;
    if (!user) {
      await ctx.reply(errorMessage('Could not identify user'));
      return;
    }

    // Show game selection for challenge
    const keyboard = GAMES.map((game) => [
      callbackButton(
        `${game.icon} ${game.name}`,
        `challenge_select_${game.slug}`
      ),
    ]);

    keyboard.push([callbackButton('← Back', 'menu')]);

    await ctx.reply('⚔️ *Create a Challenge*\n\nPick a game to challenge a friend:', {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: keyboard },
    });
  };
}

/**
 * Handle game selection for challenge creation.
 * Called from callback query handler.
 */
export async function handleChallengeGameSelect(
  ctx: Context,
  gameSlug: string,
  botUsername: string,
  challengeService: ChallengeService,
  userService: UserService
) {
  const user = ctx.from;
  if (!user) return;

  const userData = await userService.getOrCreateUser({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
  });

  // Create the challenge
  const challenge = challengeService.createChallenge(
    user.id,
    userData.displayName,
    gameSlug
  );

  // Build the shareable link
  const challengeLink = buildBotLink(botUsername, `chal_${challenge.token}`);
  const gameName = challenge.gameName;

  // Answer callback query
  await ctx.answerCallbackQuery();

  // Edit the message with the challenge link
  await ctx.editMessageText(
    `⚡ *Challenge Created\\!*\n\n` +
      `Game: *${gameName}*\n\n` +
      `Send this link to your friend\\. ` +
      `When they accept, you'll both play and the winner takes the crown\\!`,
    {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Send to Friend', url: challengeLink }],
          [webAppButton('🎮 Play Your Turn', botUsername, `chal_${challenge.token}`)],
          [callbackButton('← Back', 'menu')],
        ],
      },
    }
  );
}
