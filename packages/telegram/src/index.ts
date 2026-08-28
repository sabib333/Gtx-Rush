// Client (browser-side)
export { telegram } from './client';
export type {
  TelegramWebApp,
  WebAppUser,
  ThemeParams,
  HapticFeedback,
  MainButton,
  BackButton,
} from './client-types';

// Auth (server-side)
export {
  verifyTelegramInitData,
  buildMiniAppLink,
  buildBotLink,
} from './auth';
export type { VerifiedInitData, TelegramUserData } from './auth';

// Deep links
export {
  createChallengeDeepLink,
  createReferralDeepLink,
  createGameDeepLink,
  parseStartParam,
} from './deep-links';
export type { StartParamAction } from './deep-links';

// Keyboards (bot-side)
export {
  webAppButton,
  callbackButton,
  urlButton,
  mainMenuKeyboard,
  gameSelectKeyboard,
  challengeCreatedKeyboard,
  challengeReceivedKeyboard,
  challengeResultKeyboard,
  scoreShareKeyboard,
  referralKeyboard,
  statsKeyboard,
} from './keyboards';

// Messages (bot-side)
export {
  welcomeMessage,
  helpMessage,
  gameSelectMessage,
  challengeCreatedMessage,
  challengeReceivedMessage,
  challengeResultMessage,
  challengeExpiredMessage,
  scoreSharedMessage,
  statsMessage,
  referralMessage,
  errorMessage,
  rateLimitMessage,
  notFoundMessage,
} from './messages';

// API client (bot-side)
export { BotApiClient } from './api-client';
