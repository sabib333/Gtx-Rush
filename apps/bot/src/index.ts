/**
 * GTX Rush Telegram Bot
 *
 * Architecture:
 * - Commands: Handle /start, /play, /challenge, /stats, /referral, /leaderboard
 * - Handlers: Process callback queries from inline keyboards
 * - Services: Business logic for users, challenges
 * - Notifications: Send proactive messages for game events
 */

import { Bot, GrammyError, HttpError } from 'grammy';
import { getEnv } from '@gtx-rush/config';
import { BotApiClient } from '@gtx-rush/telegram';

// Services
import { UserService } from './services/user.service';
import { ChallengeService } from './services/challenge.service';

// Commands
import { registerStartCommand } from './commands/start';
import { registerPlayCommand } from './commands/play';
import { registerChallengeCommand } from './commands/challenge';
import { registerStatsCommand, registerProfileCommand } from './commands/stats';
import { registerReferralCommand } from './commands/referral';
import { registerLeaderboardCommand } from './commands/leaderboard';

// Handlers
import { createCallbackHandler } from './handlers/callback';
import { NotificationService } from './handlers/notifications';

// ============================================================
// Initialization
// ============================================================

const env = getEnv();

// In dev mock mode, skip bot startup if no real token is provided
if (env.DEV_TELEGRAM_MOCK === 'true' && !process.env.TELEGRAM_BOT_TOKEN) {
  console.log('⚡ GTX Rush Bot: Skipped in DEV_TELEGRAM_MOCK mode (no TELEGRAM_BOT_TOKEN)');
  console.log('   To run the bot, provide TELEGRAM_BOT_TOKEN in .env');
  process.exit(0);
}

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const botUsername: string = env.TELEGRAM_BOT_USERNAME ?? 'gtxrushbot';

// Initialize services
const apiClient = new BotApiClient(
  `http://localhost:${env.API_PORT ?? 3001}`,
  env.ADMIN_JWT_SECRET ?? env.JWT_SECRET
);
const userService = new UserService(apiClient);
const challengeService = new ChallengeService(apiClient);

// ============================================================
// Register Commands
// ============================================================

// /start — Welcome + deep link handling
bot.command('start', registerStartCommand(bot, botUsername, userService, challengeService));

// /play — Game selection
bot.command('play', registerPlayCommand(botUsername));

// /challenge — Challenge creation flow
bot.command('challenge', registerChallengeCommand(botUsername, challengeService, userService));

// /stats — User statistics
bot.command('stats', registerStatsCommand(userService, botUsername));

// /profile — Open profile in Mini App
bot.command('profile', registerProfileCommand(botUsername));

// /referral — Invite friends
bot.command('referral', registerReferralCommand(userService, botUsername));

// /leaderboard — View rankings
bot.command('leaderboard', registerLeaderboardCommand(botUsername));

// /help — Show commands
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*GTX Rush Commands*\n\n` +
      `/play — Start playing a game\n` +
      `/challenge — Challenge a friend\n` +
      `/stats — View your statistics\n` +
      `/profile — Open your profile\n` +
      `/referral — Invite friends\n` +
      `/leaderboard — View rankings\n` +
      `/help — Show this message`,
    { parse_mode: 'MarkdownV2' }
  );
});

// ============================================================
// Register Callback Query Handler
// ============================================================

bot.on('callback_query:data', createCallbackHandler(
  botUsername,
  challengeService,
  userService
));

// ============================================================
// Error Handling
// ============================================================

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error handling update ${ctx.update.update_id}:`);

  const e = err.error;
  if (e instanceof GrammyError) {
    console.error(`Grammy error: ${e.description}`);
  } else if (e instanceof HttpError) {
    console.error(`HTTP error: ${e}`);
  } else {
    console.error('Unknown error:', e);
  }
});

// ============================================================
// Start Bot
// ============================================================

async function main() {
  console.log('⚡ Starting GTX Rush Bot...');

  // Set bot commands for the Telegram menu
  await bot.api.setMyCommands([
    { command: 'start', description: 'Open GTX Rush' },
    { command: 'play', description: 'Choose a game to play' },
    { command: 'challenge', description: 'Challenge a friend' },
    { command: 'stats', description: 'View your statistics' },
    { command: 'profile', description: 'Open your profile' },
    { command: 'referral', description: 'Invite friends' },
    { command: 'leaderboard', description: 'View rankings' },
    { command: 'help', description: 'Show commands' },
  ]);

  console.log('✅ Bot commands registered');
  console.log(`🎮 Bot username: @${botUsername}`);

  // Start polling
  await bot.start();
  console.log('🚀 Bot is running!');
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

// Export for testing
export { bot, userService, challengeService };
