/**
 * GTX Rush Message Formatters
 *
 * Consistent message templates for bot responses.
 * Uses MarkdownV2 for rich formatting.
 */

// ============================================================
// Helper: Escape MarkdownV2 special characters
// ============================================================

function esc(text: string): string {
  // Escape characters that have special meaning in MarkdownV2
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ============================================================
// Welcome & Menu
// ============================================================

export function welcomeMessage(username?: string): string {
  const greeting = username ? `Hey ${esc(username)}\\!` : 'Welcome\\!';
  return (
    `⚡ *GTX Rush*\n` +
    `\n` +
    `${greeting}\n` +
    `\n` +
    `Play fast\\. Compete hard\\. Rise to the top\\.\n` +
    `\n` +
    `🎮 3 games • 🏆 Global rankings • ⚡ Instant play`
  );
}

export function helpMessage(): string {
  return (
    `*GTX Rush Commands*\n` +
    `\n` +
    `/play — Start playing a game\n` +
    `/challenge — Challenge a friend\n` +
    `/stats — View your statistics\n` +
    `/profile — Open your profile\n` +
    `/referral — Invite friends\n` +
    `/leaderboard — View rankings\n` +
    `/help — Show this message`
  );
}

// ============================================================
// Game
// ============================================================

export function gameSelectMessage(): string {
  return (
    `🎮 *Choose Your Game*\n` +
    `\n` +
    `Pick a game to start playing\\.`
  );
}

// ============================================================
// Challenge
// ============================================================

export function challengeCreatedMessage(
  gameName: string,
  challengeLink: string
): string {
  return (
    `⚡ *Challenge Created\\!*\n` +
    `\n` +
    `Game: *${esc(gameName)}*\n` +
    `\n` +
    `Send the link to your friend\\. ` +
    `When they accept, you'll both play and the winner takes the crown\\!`
  );
}

export function challengeReceivedMessage(
  challengerName: string,
  gameName: string,
  challengerScore: number
): string {
  return (
    `⚔️ *You've Been Challenged\\!*\n` +
    `\n` +
    `*${esc(challengerName)}* scored *${challengerScore.toLocaleString()}* ` +
    `in *${esc(gameName)}*\n` +
    `\n` +
    `Can you beat them\\?`
  );
}

export function challengeResultMessage(
  winnerName: string,
  loserName: string,
  winnerScore: number,
  loserScore: number,
  iWon: boolean
): string {
  const trophy = iWon ? '🏆' : '😤';
  const result = iWon ? 'You Won\\!' : 'You Lost\\!';

  return (
    `${trophy} *${esc(result)}*\n` +
    `\n` +
    `*${esc(winnerName)}* — *${winnerScore.toLocaleString()}*\n` +
    `*${esc(loserName)}* — *${loserScore.toLocaleString()}*\n` +
    `\n` +
    `${iWon ? 'Congratulations\\!' : 'Better luck next time\\!'}`
  );
}

export function challengeExpiredMessage(): string {
  return (
    `⏰ *Challenge Expired*\n` +
    `\n` +
    `This challenge has expired\\. Create a new one to play again\\!`
  );
}

// ============================================================
// Score
// ============================================================

export function scoreSharedMessage(
  gameName: string,
  score: number,
  rank: number | null
): string {
  let msg =
    `⚡ *New Score\\!*\n` +
    `\n` +
    `*${esc(gameName)}*\n` +
    `Score: *${score.toLocaleString()}*`;

  if (rank != null) {
    msg += `\nRank: *#${rank.toLocaleString()}*`;
  }

  return msg;
}

// ============================================================
// Stats
// ============================================================

export function statsMessage(stats: {
  displayName: string;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGames: number;
  totalScore: number;
  globalRank: number | null;
}): string {
  return (
    `📊 *Your Stats*\n` +
    `\n` +
    `👤 *${esc(stats.displayName)}*\n` +
    `Level *${stats.level}*\n` +
    `XP: *${stats.xpTotal.toLocaleString()}*\n` +
    `\n` +
    `🔥 Streak: *${stats.currentStreak}* days \\(best: ${stats.longestStreak}\\)\n` +
    `🎮 Games: *${stats.totalGames.toLocaleString()}*\n` +
    `🏆 Total Score: *${stats.totalScore.toLocaleString()}*\n` +
    (stats.globalRank != null
      ? `🌍 Global Rank: *#${stats.globalRank.toLocaleString()}*`
      : `🌍 Global Rank: *Unranked*`)
  );
}

// ============================================================
// Referral
// ============================================================

export function referralMessage(stats: {
  friendsJoined: number;
  friendsActivated: number;
  referralCode: string;
}): string {
  return (
    `👥 *Invite Friends*\n` +
    `\n` +
    `Friends joined: *${stats.friendsJoined}*\n` +
    `Activated: *${stats.friendsActivated}*\n` +
    `\n` +
    `Share your link\\. When friends reach Level 3 and play 10 games, ` +
    `you both earn bonus XP\\!`
  );
}

// ============================================================
// Error Messages
// ============================================================

export function errorMessage(details?: string): string {
  let msg = `❌ *Something went wrong*\n\nPlease try again later.`;
  if (details) {
    msg += `\n\n_${esc(details)}_`;
  }
  return msg;
}

export function rateLimitMessage(): string {
  return (
    `⏳ *Slow down\\!*\n` +
    `\n` +
    `You're sending commands too fast\\. Please wait a moment\\.`
  );
}

export function notFoundMessage(thing: string): string {
  return `❌ *${esc(thing)} not found*`;
}
