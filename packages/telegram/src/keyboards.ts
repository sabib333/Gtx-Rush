/**
 * GTX Rush Telegram Keyboard Builders
 *
 * Reusable keyboard builders for bot messages.
 * All keyboards follow consistent patterns.
 *
 * Uses inline type definitions to avoid grammy dependency in shared package.
 * The bot app maps these to grammy's InlineKeyboardButton type.
 */

// Inline type — mirrors grammy's InlineKeyboardButton
type KeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

// ============================================================
// Mini App Buttons (open the web app)
// ============================================================

/**
 * Create a button that opens the Mini App.
 */
export function webAppButton(text: string, botUsername: string, startParam?: string): KeyboardButton {
  const url = startParam
    ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`
    : `https://t.me/${botUsername}`;

  return { text, web_app: { url } };
}

// ============================================================
// Callback Buttons (trigger bot callback queries)
// ============================================================

/**
 * Create a callback button.
 */
export function callbackButton(text: string, data: string): KeyboardButton {
  return { text, callback_data: data };
}

/**
 * Create a URL button.
 */
export function urlButton(text: string, url: string): KeyboardButton {
  return { text, url };
}

// ============================================================
// Common Keyboard Layouts
// ============================================================

/**
 * Main menu keyboard — shown after /start.
 */
export function mainMenuKeyboard(botUsername: string): KeyboardButton[][] {
  return [
    [webAppButton('🎮 Play Now', botUsername)],
    [
      webAppButton('⚡ Quick Play', botUsername, 'game_home'),
      webAppButton('🏆 Rank', botUsername, 'leaderboard'),
    ],
    [
      callbackButton('📋 My Stats', 'stats'),
      callbackButton('👥 Invite Friends', 'referral'),
    ],
  ];
}

/**
 * Game selection keyboard — shown after /play.
 */
export function gameSelectKeyboard(botUsername: string): KeyboardButton[][] {
  return [
    [webAppButton('⚡ Reaction Rush', botUsername, 'game_reaction-rush')],
    [webAppButton('👆 Tap Rush', botUsername, 'game_tap-rush')],
    [webAppButton('🧠 Quiz Rush', botUsername, 'game_quiz-rush')],
    [callbackButton('← Back', 'menu')],
  ];
}

/**
 * Challenge created keyboard — shown when challenge link is generated.
 */
export function challengeCreatedKeyboard(
  challengeLink: string,
  botUsername: string
): KeyboardButton[][] {
  return [
    [{ text: '📤 Send to Friend', url: challengeLink }],
    [webAppButton('🎮 Play Your Turn', botUsername, 'challenge_self')],
    [callbackButton('← Back', 'menu')],
  ];
}

/**
 * Challenge received keyboard — shown to the challenged user.
 */
export function challengeReceivedKeyboard(
  challengeToken: string,
  botUsername: string
): KeyboardButton[][] {
  return [
    [webAppButton('⚔️ Accept & Play', botUsername, `chal_${challengeToken}`)],
    [callbackButton('❌ Decline', `challenge_decline_${challengeToken}`)],
  ];
}

/**
 * Challenge result keyboard — shown after challenge completes.
 */
export function challengeResultKeyboard(
  challengeToken: string,
  botUsername: string
): KeyboardButton[][] {
  return [
    [webAppButton('🔄 Rematch', botUsername, `chal_${challengeToken}`)],
    [callbackButton('📊 Full Result', `challenge_result_${challengeToken}`)],
    [callbackButton('← Back', 'menu')],
  ];
}

/**
 * Score share keyboard — shown after a game.
 */
export function scoreShareKeyboard(
  gameSlug: string,
  score: number,
  botUsername: string
): KeyboardButton[][] {
  const shareText = encodeURIComponent(
    `⚡ I scored ${score.toLocaleString()} in ${gameSlug.replace(/-/g, ' ')} on GTX Rush! Can you beat me? 🏆`
  );
  const shareUrl = `https://t.me/share/url?url=&text=${shareText}`;

  return [
    [webAppButton('🎮 Play Again', botUsername, `game_${gameSlug}`)],
    [{ text: '📤 Share Score', url: shareUrl }],
    [callbackButton('⚔️ Challenge Friend', `challenge_new_${gameSlug}`)],
    [callbackButton('← Back', 'menu')],
  ];
}

/**
 * Referral keyboard — shown after /referral.
 */
export function referralKeyboard(
  referralLink: string,
  _botUsername: string
): KeyboardButton[][] {
  return [
    [{ text: '📤 Invite Friends', url: referralLink }],
    [callbackButton('← Back', 'menu')],
  ];
}

/**
 * Stats keyboard — shown after /stats.
 */
export function statsKeyboard(botUsername: string): KeyboardButton[][] {
  return [
    [webAppButton('🎮 Play Now', botUsername)],
    [callbackButton('← Back', 'menu')],
  ];
}
