// Context
export { TelegramProvider, useTelegramContext } from './context';

// Hooks
export {
  useTelegram,
  useBackButton,
  useMainButton,
  useHaptic,
  useViewport,
  useTheme,
  useShare,
  useDialog,
  useClosingConfirmation,
} from './hooks';

// Deep links
export { parseDeepLink, validateDeepLink } from './deep-links';
export type { DeepLinkAction } from './deep-links';
